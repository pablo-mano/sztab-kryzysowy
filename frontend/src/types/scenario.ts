import type { Feature, Polygon, MultiPolygon } from "geojson";

export type ScenarioType = "toxic-cloud" | "flood";

export type SubstanceId = "ammonia" | "nitrogen_dioxide" | "chlorine" | "nitric_acid";
export type ReleaseScenarioId = "small_leak" | "medium_leak" | "large_leak" | "catastrophic";
export type StabilityClass = "A" | "B" | "C" | "D" | "E" | "F";

export interface ScenarioZone {
  zone: string;
  label: string;
  description: string;
  feature: Feature<Polygon | MultiPolygon>;
  color: string;
  opacity: number;
}
