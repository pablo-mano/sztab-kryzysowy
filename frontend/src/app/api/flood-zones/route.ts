import { NextRequest } from "next/server";
import { query } from "@/lib/snowflake";
import { cached } from "@/lib/cache";

const SCENARIO_FILTERS: Record<string, string> = {
  q10: "return_period_years = 10",
  q100: "return_period_years = 100 AND likelihood_description LIKE 'scenariusz Q 1%'",
  q500: "return_period_years = 500",
};

export async function GET(request: NextRequest) {
  const scenario = request.nextUrl.searchParams.get("scenario");

  if (!scenario || !SCENARIO_FILTERS[scenario]) {
    return Response.json(
      { error: "Invalid scenario. Use: q10, q100, q500" },
      { status: 400 },
    );
  }

  const cacheKey = `flood-zones:${scenario}`;

  try {
    const data = await cached(cacheKey, 3600000, async () => {
      const where = SCENARIO_FILTERS[scenario];
      const sql = `
        SELECT
          feature_id,
          hazard_category,
          likelihood_description,
          return_period_years,
          location_name,
          ST_ASGEOJSON(geo) AS geo
        FROM raw_hazard_areas
        WHERE ${where} AND geo IS NOT NULL
      `;

      const rows = await query(sql);

      const features = rows.map((raw) => {
        const row = raw as Record<string, unknown>;
        const geoStr = row.GEO ?? row.geo;
        const geometry =
          typeof geoStr === "string" ? JSON.parse(geoStr) : geoStr;

        return {
          type: "Feature" as const,
          properties: {
            feature_id: row.FEATURE_ID ?? row.feature_id,
            hazard_category: row.HAZARD_CATEGORY ?? row.hazard_category,
            likelihood_description:
              row.LIKELIHOOD_DESCRIPTION ?? row.likelihood_description,
            return_period_years:
              row.RETURN_PERIOD_YEARS ?? row.return_period_years,
            location_name: row.LOCATION_NAME ?? row.location_name,
          },
          geometry,
        };
      });

      return { type: "FeatureCollection", features };
    });

    return Response.json(data, {
      headers: { "Content-Type": "application/geo+json" },
    });
  } catch (error) {
    console.error("Flood zones error:", error);
    return Response.json(
      { error: "Failed to fetch flood zones" },
      { status: 500 },
    );
  }
}
