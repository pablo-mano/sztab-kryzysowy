import { query } from "@/lib/snowflake";

const IMGW_HYDRO_URL = "https://danepubliczne.imgw.pl/api/data/hydro/";

/** Station IDs we track in Snowflake (Wisła + Wieprz in Lubelskie region). */
const TRACKED_STATION_IDS = new Set([
  "150210150", // Koło
  "150210170", // Sandomierz
  "150210190", // Zawichost
  "150210180", // Annopol
  "151210190", // Puławy
  "151210120", // Dęblin
  "150230080", // Michałów
  "150230010", // Nielisz
  "150230040", // Krasnystaw
  "151230010", // Trawniki
  "151220090", // Lubartów
  "151220010", // Kośmin
]);

interface ImgwStation {
  id_stacji: string;
  stacja: string;
  rzeka: string;
  wojewodztwo: string | null;
  lon: string | null;
  lat: string | null;
  stan_wody: string | null;
  stan_wody_data_pomiaru: string | null;
  temperatura_wody: string | null;
  przelyw: string | null;
}

export async function POST() {
  try {
    const res = await fetch(IMGW_HYDRO_URL, { next: { revalidate: 0 } });
    if (!res.ok) {
      return Response.json(
        { error: `IMGW API returned ${res.status}` },
        { status: 502 },
      );
    }

    const allStations: ImgwStation[] = await res.json();
    const tracked = allStations.filter((s) =>
      TRACKED_STATION_IDS.has(s.id_stacji),
    );

    if (tracked.length === 0) {
      return Response.json(
        { error: "No tracked stations found in IMGW response" },
        { status: 404 },
      );
    }

    let inserted = 0;
    for (const s of tracked) {
      if (!s.stan_wody) continue;

      const waterLevel = parseInt(s.stan_wody, 10);
      const flow = s.przelyw ? parseFloat(s.przelyw) : null;
      const measureTime = s.stan_wody_data_pomiaru || new Date().toISOString();

      await query(
        `INSERT INTO raw_water_measurements (station_id, water_level_cm, flow_m3s, measure_time)
         SELECT :1, :2, :3, :4::TIMESTAMP
         WHERE NOT EXISTS (
           SELECT 1 FROM raw_water_measurements
           WHERE station_id = :1 AND measure_time = :4::TIMESTAMP
         )`,
        [parseInt(s.id_stacji, 10), waterLevel, flow, measureTime],
      );
      inserted++;
    }

    return Response.json({
      ok: true,
      synced: inserted,
      stations: tracked.map((s) => ({
        id: s.id_stacji,
        name: s.stacja,
        water_level: s.stan_wody,
        measure_time: s.stan_wody_data_pomiaru,
      })),
    });
  } catch (error) {
    console.error("IMGW sync error:", error);
    return Response.json(
      { error: "Failed to sync with IMGW" },
      { status: 500 },
    );
  }
}

/** GET: return current IMGW data without writing to Snowflake (read-only preview). */
export async function GET() {
  try {
    const res = await fetch(IMGW_HYDRO_URL, { next: { revalidate: 0 } });
    if (!res.ok) {
      return Response.json(
        { error: `IMGW API returned ${res.status}` },
        { status: 502 },
      );
    }

    const allStations: ImgwStation[] = await res.json();
    const tracked = allStations.filter((s) =>
      TRACKED_STATION_IDS.has(s.id_stacji),
    );

    return Response.json({
      source: "IMGW API (live)",
      fetched_at: new Date().toISOString(),
      stations: tracked.map((s) => ({
        id: s.id_stacji,
        name: s.stacja,
        river: s.rzeka,
        lat: s.lat ? parseFloat(s.lat) : null,
        lon: s.lon ? parseFloat(s.lon) : null,
        water_level_cm: s.stan_wody ? parseInt(s.stan_wody, 10) : null,
        flow_m3s: s.przelyw ? parseFloat(s.przelyw) : null,
        measure_time: s.stan_wody_data_pomiaru,
        temperature: s.temperatura_wody
          ? parseFloat(s.temperatura_wody)
          : null,
      })),
    });
  } catch (error) {
    console.error("IMGW fetch error:", error);
    return Response.json(
      { error: "Failed to fetch IMGW data" },
      { status: 500 },
    );
  }
}
