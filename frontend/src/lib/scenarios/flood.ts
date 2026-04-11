import type { ScenarioZone } from "@/types/scenario";

export type FloodScenarioId = "q10" | "q100" | "q500";

export interface FloodScenarioOption {
  id: FloodScenarioId;
  label: string;
  description: string;
  returnPeriodYears: number;
  color: string;
  opacity: number;
}

export const FLOOD_SCENARIOS: FloodScenarioOption[] = [
  {
    id: "q10",
    label: "Q 10% — raz na 10 lat",
    description: "Woda stuletnia — częste wezbrania, podtopienia terenów nadrzecznych",
    returnPeriodYears: 10,
    color: "#1e40af",
    opacity: 0.35,
  },
  {
    id: "q100",
    label: "Q 1% — raz na 100 lat",
    description: "Powódź stuletnia — zalanie szerokich obszarów doliny rzecznej",
    returnPeriodYears: 100,
    color: "#0891b2",
    opacity: 0.3,
  },
  {
    id: "q500",
    label: "Q 0,2% — raz na 500 lat",
    description: "Powódź ekstremalna — maksymalny zasięg zalania wg modelowania ISOK",
    returnPeriodYears: 500,
    color: "#38bdf8",
    opacity: 0.2,
  },
];

export function getFloodScenario(id: FloodScenarioId): FloodScenarioOption {
  return FLOOD_SCENARIOS.find((s) => s.id === id)!;
}

/**
 * Fetch official ISOK flood hazard zones from Snowflake for a given scenario.
 * Returns ScenarioZone[] ready for map rendering.
 */
export async function fetchFloodZones(scenarioId: FloodScenarioId): Promise<ScenarioZone[]> {
  const scenario = getFloodScenario(scenarioId);

  const res = await fetch(`/api/flood-zones?scenario=${scenarioId}`);
  if (!res.ok) throw new Error(`Flood zones API error: ${res.status}`);

  const data = await res.json();
  const features = data.features ?? [];

  // Each feature from the API becomes a separate zone entry,
  // but for the ThreatList we merge them into one logical zone per scenario
  if (features.length === 0) return [];

  // Merge all features into a single FeatureCollection-like MultiPolygon
  // For map rendering, we pass individual features as a single zone
  const mergedCoordinates: number[][][][] = [];
  for (const feat of features) {
    const geom = feat.geometry;
    if (geom.type === "Polygon") {
      mergedCoordinates.push(geom.coordinates);
    } else if (geom.type === "MultiPolygon") {
      mergedCoordinates.push(...geom.coordinates);
    }
  }

  return [
    {
      zone: scenarioId,
      label: scenario.label,
      description: scenario.description,
      feature: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "MultiPolygon",
          coordinates: mergedCoordinates,
        },
      },
      color: scenario.color,
      opacity: scenario.opacity,
    },
  ];
}
