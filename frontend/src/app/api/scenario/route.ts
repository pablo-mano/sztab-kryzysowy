import { NextRequest } from "next/server";
import { query } from "@/lib/snowflake";

interface ScenarioRequest {
  cloudGeoJson?: string; // legacy: GeoJSON polygon of the cloud zone
  zoneGeoJson?: string;  // new: GeoJSON polygon of any scenario zone
  zone: string;
  scenarioType?: "toxic-cloud" | "flood" | "civil-reports";
}

/** Snowflake returns UPPERCASE column names — normalize to lowercase */
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key.toLowerCase()] = value;
  }
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScenarioRequest;
    const geoJson = body.zoneGeoJson ?? body.cloudGeoJson;
    const { zone, scenarioType } = body;

    if (!geoJson) {
      return Response.json({ error: "Missing zoneGeoJson or cloudGeoJson" }, { status: 400 });
    }

    // Query objects within the scenario zone
    // For flood scenarios, add evacuation priority scoring for hospitals
    const sql = scenarioType === "flood"
      ? `
        SELECT
          name,
          amenity_type,
          latitude,
          longitude,
          estimated_population,
          ST_DISTANCE(geo, ST_GEOGRAPHYFROMWKB(ST_ASWKB(TO_GEOGRAPHY(:1)))) AS distance_m,
          CASE WHEN amenity_type = 'hospital' THEN
            COALESCE(estimated_population, 0) * 3 - ROUND(ST_DISTANCE(geo, ST_GEOGRAPHYFROMWKB(ST_ASWKB(TO_GEOGRAPHY(:1)))) / 100)
          END AS evacuation_priority
        FROM raw_osm_pois
        WHERE ST_WITHIN(geo, TO_GEOGRAPHY(:1))
        ORDER BY evacuation_priority DESC NULLS LAST, estimated_population DESC NULLS LAST
      `
      : `
        SELECT
          name,
          amenity_type,
          latitude,
          longitude,
          estimated_population,
          ST_DISTANCE(geo, ST_GEOGRAPHYFROMWKB(ST_ASWKB(TO_GEOGRAPHY(:1)))) AS distance_m
        FROM raw_osm_pois
        WHERE ST_WITHIN(geo, TO_GEOGRAPHY(:1))
        ORDER BY estimated_population DESC NULLS LAST
      `;

    const rawRows = await query(sql, [geoJson]);
    const rows = rawRows.map((r) => normalizeRow(r as Record<string, unknown>));

    // Aggregate stats
    const stats = {
      zone,
      totalObjects: rows.length,
      totalPopulation: rows.reduce(
        (sum, r) => sum + (Number(r.estimated_population) || 0),
        0,
      ),
      byType: {} as Record<string, number>,
    };

    for (const row of rows) {
      const type = String(row.amenity_type || "other");
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }

    return Response.json({ zone, objects: rows, stats });
  } catch (error) {
    console.error("Scenario error:", error);
    return Response.json(
      { error: "Failed to run scenario analysis" },
      { status: 500 },
    );
  }
}
