/**
 * Demo mode utilities.
 * When NEXT_PUBLIC_DEMO_MODE=true, the app serves static fallback data
 * instead of querying Snowflake — useful for demos without active SF account.
 */
import { readFile } from "fs/promises";
import { join } from "path";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export async function loadFallbackGeoJSON(name: string) {
  const filePath = join(process.cwd(), "public", "data", "fallback", `${name}.geojson`);
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}

export async function loadFallbackJSON(name: string) {
  const filePath = join(process.cwd(), "public", "data", "fallback", `${name}.json`);
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content);
}

// ---------------------------------------------------------------------------
// Static demo data for non-layer endpoints
// ---------------------------------------------------------------------------

export const DEMO_REGIONS = [
  { name: "lubelskie", level: "wojewodztwo", teryt: "06", bbox: [21.32, 50.40, 24.10, 52.50] as [number, number, number, number] },
  { name: "puławski", level: "powiat", teryt: "0617", bbox: [21.55, 51.20, 22.15, 51.62] as [number, number, number, number] },
  { name: "lubelski", level: "powiat", teryt: "0609", bbox: [22.15, 50.95, 23.05, 51.55] as [number, number, number, number] },
  { name: "zamojski", level: "powiat", teryt: "0626", bbox: [22.80, 50.48, 23.58, 51.00] as [number, number, number, number] },
  { name: "chełmski", level: "powiat", teryt: "0601", bbox: [23.05, 50.92, 23.90, 51.48] as [number, number, number, number] },
  { name: "łukowski", level: "powiat", teryt: "0608", bbox: [21.88, 51.62, 22.82, 52.22] as [number, number, number, number] },
  { name: "świdnicki", level: "powiat", teryt: "0621", bbox: [22.40, 51.05, 22.92, 51.42] as [number, number, number, number] },
  { name: "opolski", level: "powiat", teryt: "0614", bbox: [21.78, 50.82, 22.35, 51.22] as [number, number, number, number] },
  { name: "hrubieszowski", level: "powiat", teryt: "0605", bbox: [23.55, 50.52, 24.10, 50.92] as [number, number, number, number] },
  { name: "biłgorajski", level: "powiat", teryt: "0602", bbox: [22.55, 50.32, 23.18, 50.78] as [number, number, number, number] },
];

// Simplified flood zone GeoJSON — Wisła river valley near Puławy (Q100 scenario)
export const DEMO_FLOOD_ZONE_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: {
        feature_id: "demo-wisla-q100",
        hazard_category: "strefa zagrożenia powodziowego",
        likelihood_description: "scenariusz Q 100-letni",
        return_period_years: 100,
        location_name: "Wisła — Puławy/Dęblin",
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[
          [21.80, 51.68], [21.84, 51.60], [21.88, 51.52], [21.93, 51.43],
          [21.96, 51.38], [22.03, 51.30], [22.08, 51.20], [22.13, 51.10],
          [22.22, 51.10], [22.17, 51.20], [22.11, 51.30], [22.06, 51.38],
          [22.03, 51.43], [21.99, 51.52], [21.96, 51.60], [21.91, 51.68],
          [21.80, 51.68],
        ]],
      },
    },
    {
      type: "Feature" as const,
      properties: {
        feature_id: "demo-wieprz-q100",
        hazard_category: "strefa zagrożenia powodziowego",
        likelihood_description: "scenariusz Q 100-letni",
        return_period_years: 100,
        location_name: "Wieprz — ujście do Wisły",
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[
          [22.06, 51.49], [22.20, 51.49], [22.26, 51.42], [22.22, 51.36],
          [22.09, 51.36], [22.04, 51.42], [22.06, 51.49],
        ]],
      },
    },
  ],
};

interface ScenarioStatsResult {
  zone: string;
  objects: Array<{
    name: string;
    amenity_type: string;
    latitude: number;
    longitude: number;
    estimated_population: number | null;
    distance_m: number;
    evacuation_priority?: number | null;
  }>;
  stats: {
    zone: string;
    totalObjects: number;
    totalPopulation: number;
    byType: Record<string, number>;
  };
}

export function demoScenarioStats(
  zone: string,
  scenarioType?: string,
): ScenarioStatsResult {
  const isFlood = scenarioType === "flood";

  const objects = isFlood
    ? [
        { name: "SPZOZ w Puławach", amenity_type: "hospital", latitude: 51.4089, longitude: 21.9694, estimated_population: 450, distance_m: 180, evacuation_priority: 1320 },
        { name: "Szkoła Podstawowa nr 2 Puławy", amenity_type: "school", latitude: 51.4145, longitude: 21.9621, estimated_population: 420, distance_m: 540, evacuation_priority: null },
        { name: "Przedszkole nr 8 Puławy", amenity_type: "kindergarten", latitude: 51.4052, longitude: 21.9758, estimated_population: 95, distance_m: 710, evacuation_priority: null },
        { name: "Dom Pomocy Społecznej Puławy", amenity_type: "care_home", latitude: 51.4201, longitude: 21.9583, estimated_population: 120, distance_m: 920, evacuation_priority: null },
        { name: "Szkoła Podstawowa nr 5 Puławy", amenity_type: "school", latitude: 51.3980, longitude: 21.9840, estimated_population: 380, distance_m: 1100, evacuation_priority: null },
        { name: "Niepubliczny ZOZ Puławy", amenity_type: "clinic", latitude: 51.4162, longitude: 21.9513, estimated_population: 40, distance_m: 1350, evacuation_priority: null },
      ]
    : [
        { name: "SPZOZ w Puławach", amenity_type: "hospital", latitude: 51.4089, longitude: 21.9694, estimated_population: 450, distance_m: 620 },
        { name: "Szkoła Podstawowa nr 2 Puławy", amenity_type: "school", latitude: 51.4145, longitude: 21.9621, estimated_population: 420, distance_m: 1180 },
        { name: "Przedszkole nr 8 Puławy", amenity_type: "kindergarten", latitude: 51.4052, longitude: 21.9758, estimated_population: 95, distance_m: 1420 },
        { name: "Dom Pomocy Społecznej Puławy", amenity_type: "care_home", latitude: 51.4201, longitude: 21.9583, estimated_population: 120, distance_m: 1750 },
      ];

  const byType: Record<string, number> = {};
  let totalPopulation = 0;
  for (const o of objects) {
    byType[o.amenity_type] = (byType[o.amenity_type] ?? 0) + 1;
    totalPopulation += o.estimated_population ?? 0;
  }

  return {
    zone,
    objects,
    stats: { zone, totalObjects: objects.length, totalPopulation, byType },
  };
}
