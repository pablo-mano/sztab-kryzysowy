import { NextRequest } from "next/server";
import { query } from "@/lib/snowflake";
import { cached } from "@/lib/cache";

interface AggregateRequest {
  type: "poi_by_powiat" | "radius_search" | "powiat_stats" | "air_quality_history";
  params?: Record<string, unknown>;
}

const QUERIES: Record<string, (params: Record<string, unknown>) => { sql: string; binds: (string | number)[] }> = {
  poi_by_powiat: () => ({
    sql: `SELECT teryt, powiat, amenity_type, count, total_population
          FROM v_poi_by_powiat
          ORDER BY count DESC`,
    binds: [],
  }),

  radius_search: (params) => ({
    sql: `SELECT name, amenity_type, latitude, longitude, estimated_population,
            ST_DISTANCE(geo, ST_MAKEPOINT(?, ?)) AS distance_m
          FROM raw_osm_pois
          WHERE ST_DWITHIN(geo, ST_MAKEPOINT(?, ?), ?)
          ORDER BY distance_m`,
    binds: [
      Number(params.lon), Number(params.lat),
      Number(params.lon), Number(params.lat),
      Number(params.radius || 5000),
    ],
  }),

  powiat_stats: () => ({
    sql: `SELECT teryt, name, population, area_km2, hospitals, schools, care_homes
          FROM v_powiat_stats
          ORDER BY population DESC`,
    binds: [],
  }),

  air_quality_history: (params) => ({
    sql: `SELECT measure_date, value, param_code
          FROM raw_gios_measurements
          WHERE station_id = ?
            AND param_code = ?
          ORDER BY measure_date DESC
          LIMIT 48`,
    binds: [
      Number(params.stationId),
      String(params.paramCode || "PM10"),
    ],
  }),
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AggregateRequest;
    const { type, params = {} } = body;

    const queryBuilder = QUERIES[type];
    if (!queryBuilder) {
      return Response.json(
        { error: `Unknown aggregate type: ${type}` },
        { status: 400 },
      );
    }

    const { sql, binds } = queryBuilder(params);
    const cacheKey = `agg:${type}:${JSON.stringify(params)}`;
    const ttl = type === "air_quality_history" ? 300_000 : 600_000;

    const rows = await cached(cacheKey, ttl, () => query(sql, binds));

    return Response.json({ type, data: rows });
  } catch (error) {
    console.error("Aggregate error:", error);
    return Response.json(
      { error: "Failed to run aggregate query" },
      { status: 500 },
    );
  }
}
