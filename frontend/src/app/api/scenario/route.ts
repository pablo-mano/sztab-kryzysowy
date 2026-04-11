import { NextRequest } from "next/server";
import { query } from "@/lib/snowflake";

interface ScenarioRequest {
  cloudGeoJson: string; // GeoJSON polygon of the cloud zone
  zone: "red" | "orange" | "yellow";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ScenarioRequest;
    const { cloudGeoJson, zone } = body;

    // Query objects within the cloud zone
    const sql = `
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

    const rows = await query(sql, [cloudGeoJson]);

    // Aggregate stats
    const stats = {
      zone,
      totalObjects: rows.length,
      totalPopulation: rows.reduce(
        (sum, r) => sum + (Number((r as Record<string, unknown>).estimated_population) || 0),
        0,
      ),
      byType: {} as Record<string, number>,
    };

    for (const row of rows) {
      const r = row as Record<string, unknown>;
      const type = String(r.amenity_type || "other");
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
