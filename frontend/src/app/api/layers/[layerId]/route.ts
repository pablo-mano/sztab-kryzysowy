import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { getLayer } from "@/lib/layer-registry";
import { query } from "@/lib/snowflake";
import { cached } from "@/lib/cache";
import type { GeoFeatureCollection } from "@/types/feature";

/** Map zoom level → H3 resolution for dynamic hex sizing */
function zoomToH3Resolution(zoom: number): number {
  if (zoom <= 7) return 4;
  if (zoom <= 9) return 5;
  if (zoom <= 11) return 6;
  return 7;
}

/**
 * Build dynamic SQL for H3 layers at a given resolution.
 * At res7 uses existing views; at coarser resolutions aggregates via H3_CELL_TO_PARENT.
 */
function buildH3Sql(layerId: string, resolution: number): string {
  const gridView = `v_h3_grid_r${resolution}`;

  if (layerId === "h3-poi-density") {
    if (resolution === 7) {
      return `SELECT h3_index, poi_count, total_population, amenity_types, ST_ASGEOJSON(hex_boundary) AS hex_boundary FROM v_h3_poi_density`;
    }
    return `
      SELECT g.h3_index,
             COUNT(p.osm_id) AS poi_count,
             COALESCE(SUM(p.estimated_population), 0) AS total_population,
             COALESCE(ARRAY_TO_STRING(ARRAY_AGG(DISTINCT p.amenity_type), ','), '') AS amenity_types,
             ST_ASGEOJSON(H3_CELL_TO_BOUNDARY(g.h3_index)) AS hex_boundary
      FROM ${gridView} g
      LEFT JOIN raw_osm_pois p ON H3_CELL_TO_PARENT(p.h3_res7, ${resolution}) = g.h3_index
      GROUP BY g.h3_index`;
  }

  if (layerId === "h3-air-quality") {
    if (resolution === 7) {
      return `SELECT h3_index, avg_value, max_value, param_code, ST_ASGEOJSON(hex_boundary) AS hex_boundary FROM v_h3_air_quality`;
    }
    return `
      SELECT g.h3_index,
             AVG(sub.avg_value) AS avg_value,
             MAX(sub.max_value) AS max_value,
             'PM10' AS param_code,
             ST_ASGEOJSON(H3_CELL_TO_BOUNDARY(g.h3_index)) AS hex_boundary
      FROM ${gridView} g
      JOIN v_h3_air_quality sub ON H3_CELL_TO_PARENT(sub.h3_index, ${resolution}) = g.h3_index
      GROUP BY g.h3_index`;
  }

  if (layerId === "h3-risk-score") {
    if (resolution === 7) {
      return `SELECT h3_index, poi_count, total_population, amenity_types, avg_pm10, risk_score, ST_ASGEOJSON(hex_boundary) AS hex_boundary FROM v_h3_risk_score`;
    }
    return `
      SELECT g.h3_index,
             COUNT(p.osm_id) AS poi_count,
             COALESCE(SUM(p.estimated_population), 0) AS total_population,
             COALESCE(ARRAY_TO_STRING(ARRAY_AGG(DISTINCT p.amenity_type), ','), '') AS amenity_types,
             COALESCE(aq.avg_value, 0) AS avg_pm10,
             ROUND(COALESCE(SUM(p.estimated_population), 0) * COALESCE(aq.avg_value, 0) / 100, 2) AS risk_score,
             ST_ASGEOJSON(H3_CELL_TO_BOUNDARY(g.h3_index)) AS hex_boundary
      FROM ${gridView} g
      LEFT JOIN raw_osm_pois p ON H3_CELL_TO_PARENT(p.h3_res7, ${resolution}) = g.h3_index
      LEFT JOIN (
        SELECT H3_CELL_TO_PARENT(h3_index, ${resolution}) AS parent_h3,
               AVG(avg_value) AS avg_value
        FROM v_h3_air_quality
        GROUP BY parent_h3
      ) aq ON g.h3_index = aq.parent_h3
      GROUP BY g.h3_index, aq.avg_value`;
  }

  // Fallback — should not reach here
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
  const zoom = searchParams.get("zoom");
  const hasRegionFilter = region && regionLevel;

  // Skip region filter for admin layers themselves and for layers with geoColumn (polygons/H3)
  const isAdminLayer = layerId.startsWith("admin-");
  const isH3Layer = !!layer.source.h3;
  const isPolygonLayer = !!layer.source.geoColumn;
  const applyRegion = hasRegionFilter && !isAdminLayer && !isPolygonLayer;

  // H3 resolution from zoom
  const h3Resolution = isH3Layer && zoom ? zoomToH3Resolution(Number(zoom)) : null;

  const cacheKey = h3Resolution
    ? `layer:${layerId}:r${h3Resolution}`
    : applyRegion
      ? `layer:${layerId}:${regionLevel}:${region}`
      : `layer:${layerId}`;

  try {
    const geojson = await cached<GeoFeatureCollection>(
      cacheKey,
      layer.source.cacheTTL,
      async () => {
        let sql: string;

        if (isH3Layer && h3Resolution) {
          sql = buildH3Sql(layerId, h3Resolution);
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
