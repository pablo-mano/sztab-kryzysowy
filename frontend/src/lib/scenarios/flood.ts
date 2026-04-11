import type { ScenarioZone } from "@/types/scenario";

export interface FloodParams {
  waterLevel: number; // meters
  rainfallIntensity: number; // mm/h
  hours: number;
}

/**
 * Generate flood scenario zones.
 * TODO: Implement with real elevation/river data.
 */
export function generateFloodZones(_params: FloodParams): ScenarioZone[] {
  return [];
}
