import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { getLayer } from "@/lib/layer-registry";
import { query } from "@/lib/snowflake";
import { cached } from "@/lib/cache";
import type { GeoFeatureCollection } from "@/types/feature";

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
        row["longitude"] !== undefined
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

    if (!geometry && row["latitude"] && row["longitude"]) {
      geometry = {
        type: "Point" as const,
        coordinates: [Number(row["longitude"]), Number(row["latitude"])],
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ layerId: string }> },
) {
  const { layerId } = await params;
  const layer = getLayer(layerId);

  if (!layer) {
    return Response.json({ error: `Layer "${layerId}" not found` }, { status: 404 });
  }

  try {
    const geojson = await cached<GeoFeatureCollection>(
      `layer:${layerId}`,
      layer.source.cacheTTL,
      async () => {
        const geoSelect = layer.source.geoColumn
          ? `, ST_ASGEOJSON(${layer.source.geoColumn}) AS ${layer.source.geoColumn}`
          : "";
        const where = layer.source.where
          ? ` WHERE ${layer.source.where}`
          : "";

        const sql = `SELECT *${geoSelect} FROM ${layer.source.view}${where}`;
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
