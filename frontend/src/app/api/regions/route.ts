import { query } from "@/lib/snowflake";
import { cached } from "@/lib/cache";
import { isDemoMode, DEMO_REGIONS } from "@/lib/demo";

interface RegionRow {
  NAME: string;
  LEVEL: string;
  TERYT: string;
  MIN_LNG: number;
  MIN_LAT: number;
  MAX_LNG: number;
  MAX_LAT: number;
}

export async function GET() {
  if (isDemoMode()) {
    return Response.json({ regions: DEMO_REGIONS });
  }

  try {
    const regions = await cached("regions:all:v2", 3600000, async () => {
      const rows = await query<RegionRow>(
        `SELECT name, level, teryt,
          ST_XMIN(geo) AS min_lng, ST_YMIN(geo) AS min_lat,
          ST_XMAX(geo) AS max_lng, ST_YMAX(geo) AS max_lat
        FROM raw_admin_boundaries
        WHERE teryt IS NOT NULL
        ORDER BY level, name`,
      );
      return rows.map((r) => ({
        name: r.NAME,
        level: r.LEVEL,
        teryt: r.TERYT,
        bbox: [r.MIN_LNG, r.MIN_LAT, r.MAX_LNG, r.MAX_LAT] as [number, number, number, number],
      }));
    });

    return Response.json({ regions });
  } catch (error) {
    console.error("Regions fetch error:", (error as Error).message);
    return Response.json({ regions: [] });
  }
}
