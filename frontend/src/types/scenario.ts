import type { Feature, Polygon } from "geojson";

export type ScenarioType = "toxic-cloud" | "flood";

export interface ScenarioZone {
  zone: string;
  label: string;
  description: string;
  feature: Feature<Polygon>;
  color: string;
  opacity: number;
}
