import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { getLayer } from "@/lib/layer-registry";
import { query } from "@/lib/snowflake";
import { cached } from "@/lib/cache";
import type { GeoFeatureCollection } from "@/types/feature";

/**
 * Build SQL for H3 layers — always uses the finest pre-computed res7 views.
 */
function buildH3Sql(layerId: string): string {
  if (layerId === "h3-poi-density") {
    return `SELECT h3_index, poi_count, total_population, amenity_types, ST_ASGEOJSON(hex_boundary) AS hex_boundary FROM v_h3_poi_density`;
  }
  if (layerId === "h3-air-quality") {
    return `SELECT h3_index, avg_value, max_value, param_code, ST_ASGEOJSON(hex_boundary) AS hex_boundary FROM v_h3_air_quality`;
  }
  if (layerId === "h3-risk-score") {
    return `SELECT h3_index, poi_count, total_population, amenity_types, avg_pm10, risk_score, ST_ASGEOJSON(hex_boundary) AS hex_boundary FROM v_h3_risk_score`;
  }
  if (layerId === "h3-flood-risk") {
    return `SELECT h3_index, poi_count, total_population, distance_to_river_km, flood_risk, ST_ASGEOJSON(hex_boundary) AS hex_boundary FROM v_h3_flood_risk`;
  }
  return `SELECT * FROM v_h3_poi_density`;
}

/** Snowflake returns UPPERCASE column names — normalize to lowercase */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

function rowsToGeoJSON(
  rows: Record<string, unknown>[],
  geoColumn?: string,
): GeoFeatureCollection {
  const geoKey = geoColumn?.toLowerCase();

  const features = rows.map((raw) => {
    const row = normalizeRow(raw);
    let geometry;
    const properties: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      if (geoKey && key === geoKey) {
        geometry =
          typeof value === "string" ? JSON.parse(value) : value;
      } else if (
        !geoKey &&
        (key === "latitude" || key === "lat") &&
        (row["longitude"] !== undefined || row["lon"] !== undefined)
      ) {
        geometry = {
          type: "Point" as const,
          coordinates: [
            Number(row["longitude"] ?? row["lon"]),
            Number(value),
          ],
        };
      } else if (key === "latitude" || key === "lat" || key === "longitude" || key === "lon" || key === "ingested_at" || key === "osm_id" || key === "tags" || key === "h3_res7" || key === "h3_res9" || key === "aqi_level" || (!geoKey && key === "geo")) {
        // skip internal/geo fields from properties
      } else {
        properties[key] = value;
      }
    }

    if (!geometry && (row["latitude"] || row["lat"]) && (row["longitude"] || row["lon"])) {
      geometry = {
        type: "Point" as const,
        coordinates: [
          Number(row["longitude"] ?? row["lon"]),
          Number(row["latitude"] ?? row["lat"]),
        ],
      };
    }

    return {
      type: "Feature" as const,
      geometry: geometry ?? { type: "Point" as const, coordinates: [0, 0] },
      properties,
    };
  });

  return { type: "FeatureCollection", features };
}

async function loadFallback(layerId: string): Promise<GeoFeatureCollection | null> {
  try {
    const filePath = join(process.cwd(), "public", "data", "fallback", `${layerId}.geojson`);
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as GeoFeatureCollection;
  } catch {
    return null;
  }
}

/**
 * Build a spatial filter clause for point-based layers.
 * Uses ST_WITHIN to filter points inside a selected admin boundary.
 */
function buildRegionFilter(
  region: string,
  regionLevel: string,
  tableAlias: string,
  latCol: string,
  lonCol: string,
): { join: string; where: string } {
  return {
    join: ` JOIN raw_admin_boundaries __region ON ST_WITHIN(ST_MAKEPOINT(${tableAlias}.${lonCol}, ${tableAlias}.${latCol}), __region.geo)`,
    where: ` AND __region.name = '${region.replace(/'/g, "''")}' AND __region.level = '${regionLevel.replace(/'/g, "''")}'`,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ layerId: string }> },
) {
  const { layerId } = await params;
  const layer = getLayer(layerId);

  if (!layer) {
    return Response.json({ error: `Layer "${layerId}" not found` }, { status: 404 });
  }

  const { searchParams } = request.nextUrl;
  const region = searchParams.get("region");
  const regionLevel = searchParams.get("regionLevel");
  const hasRegionFilter = region && regionLevel;

  // Skip region filter for admin layers themselves and for layers with geoColumn (polygons/H3)
  const isAdminLayer = layerId.startsWith("admin-");
  const isH3Layer = !!layer.source.h3;
  const isPolygonLayer = !!layer.source.geoColumn;
  const applyRegion = hasRegionFilter && !isAdminLayer && !isPolygonLayer;

  const cacheKey = applyRegion
    ? `layer:${layerId}:${regionLevel}:${region}`
    : `layer:${layerId}`;

  try {
    const geojson = await cached<GeoFeatureCollection>(
      cacheKey,
      layer.source.cacheTTL,
      async () => {
        let sql: string;

        if (isH3Layer) {
          sql = buildH3Sql(layerId);
        } else if (layer.source.sql) {
          // Custom SQL (e.g. civil-reports with GET_PRESIGNED_URL)
          sql = layer.source.sql;
          if (applyRegion) {
            // Wrap custom SQL as subquery and apply spatial filter
            // Detect lat/lon column names from the custom SQL
            const hasLat = /\bLAT\b/i.test(sql);
            const latCol = hasLat ? "LAT" : "LATITUDE";
            const lonCol = hasLat ? "LON" : "LONGITUDE";
            sql = `SELECT __src.* FROM (${sql}) __src JOIN raw_admin_boundaries __region ON ST_WITHIN(ST_MAKEPOINT(__src.${lonCol}, __src.${latCol}), __region.geo) WHERE __region.name = '${region!.replace(/'/g, "''")}' AND __region.level = '${regionLevel!.replace(/'/g, "''")}'`;
          }
        } else {
          const view = layer.source.view;
          const geoSelect = layer.source.geoColumn
            ? `, ST_ASGEOJSON(${layer.source.geoColumn}) AS ${layer.source.geoColumn}`
            : "";
          const where = layer.source.where
            ? ` WHERE ${layer.source.where}`
            : "";

          if (applyRegion) {
            // Detect lat/lon column names
            // For raw_osm_pois it's latitude/longitude, for others check
            const latCol = view.includes("gios") || view.includes("air") ? "LATITUDE" : "LATITUDE";
            const lonCol = "LONGITUDE";
            const rf = buildRegionFilter(region!, regionLevel!, "t", latCol, lonCol);
            sql = `SELECT t.*${geoSelect} FROM ${view} t${rf.join}${where ? where + rf.where : ` WHERE 1=1${rf.where}`}`;
          } else {
            sql = `SELECT *${geoSelect} FROM ${view}${where}`;
          }
        }

        const rows = await query(sql);
        return rowsToGeoJSON(
          rows as Record<string, unknown>[],
          layer.source.geoColumn,
        );
      },
    );

    return Response.json(geojson, {
      headers: { "Content-Type": "application/geo+json" },
    });
  } catch (error) {
    console.error(`Layer ${layerId} fetch error:`, (error as Error).message);

    // Fallback: try static file
    const fallback = await loadFallback(layerId);
    if (fallback) {
      return Response.json(fallback, {
        headers: { "Content-Type": "application/geo+json" },
      });
    }

    return Response.json(
      { error: "Failed to fetch layer data" },
      { status: 500 },
    );
  }
}
