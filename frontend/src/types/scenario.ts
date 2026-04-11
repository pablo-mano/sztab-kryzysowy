import type { Feature, Polygon, MultiPolygon } from "geojson";

export type ScenarioType = "toxic-cloud" | "flood";

export interface ScenarioZone {
  zone: string;
  label: string;
  description: string;
  feature: Feature<Polygon | MultiPolygon>;
  color: string;
  opacity: number;
}
