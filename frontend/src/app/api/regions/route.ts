import { query } from "@/lib/snowflake";
import { cached } from "@/lib/cache";

interface RegionRow {
  NAME: string;
  LEVEL: string;
  TERYT: string;
}

export async function GET() {
  try {
    const regions = await cached("regions:all", 3600000, async () => {
      const rows = await query<RegionRow>(
        "SELECT name, level, teryt FROM raw_admin_boundaries WHERE teryt IS NOT NULL ORDER BY level, name",
      );
      return rows.map((r) => ({
        name: r.NAME,
        level: r.LEVEL,
        teryt: r.TERYT,
      }));
    });

    return Response.json({ regions });
  } catch (error) {
    console.error("Regions fetch error:", (error as Error).message);
    return Response.json({ regions: [] });
  }
}
