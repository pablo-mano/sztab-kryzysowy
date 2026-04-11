import * as turf from "@turf/turf";
import type { Feature, LineString } from "geojson";
import type { ScenarioZone } from "@/types/scenario";
import { VISTULA_LUBELSKIE, WIEPRZ_LUBELSKIE } from "@/lib/geo-utils";

export interface FloodParams {
  waterLevel: number; // 0-15 meters
  rainfallIntensity: number; // mm/h
  hours: number; // 0-72
}

const FLOOD_ZONES = [
  {
    zone: "warning",
    label: "Strefa ostrzegawcza",
    description: "Możliwe podtopienia — monitorowanie sytuacji",
    baseRadius: 3,
    color: "#38bdf8",
    opacity: 0.15,
  },
  {
    zone: "moderate",
    label: "Strefa zagrożenia",
    description: "Zalecana ewakuacja obiektów wrażliwych",
    baseRadius: 1.5,
    color: "#0891b2",
    opacity: 0.3,
  },
  {
    zone: "deep",
    label: "Strefa głębokiego zalania",
    description: "Natychmiastowa ewakuacja — bezpośrednie zagrożenie życia",
    baseRadius: 0.5,
    color: "#1e40af",
    opacity: 0.4,
  },
] as const;

/**
 * Generate flood zones as buffers around the Vistula river line.
 * Zones expand based on water level, rainfall intensity, and time.
 */
export function generateFloodZones(params: FloodParams): ScenarioZone[] {
  const { waterLevel, rainfallIntensity, hours } = params;

  if (hours <= 0) return [];

  const vistulaLine: Feature<LineString> = turf.lineString(VISTULA_LUBELSKIE);
  const wierzLine: Feature<LineString> = turf.lineString(WIEPRZ_LUBELSKIE);

  const waterLevelFactor = waterLevel / 5;
  const timeFactor = Math.min(1, hours / 24);
  const rainfallFactor = Math.max(1, rainfallIntensity / 20);

  return FLOOD_ZONES.map(({ zone, label, description, baseRadius, color, opacity }) => {
    const radius = baseRadius * waterLevelFactor * timeFactor * rainfallFactor;
    const safeRadius = Math.max(0.1, radius);

    // Buffer both rivers and merge into single zone
    const vistulaBuffer = turf.buffer(vistulaLine, safeRadius, { units: "kilometers" });
    // Wieprz gets slightly smaller flood zones (smaller river)
    const wierzBuffer = turf.buffer(wierzLine, safeRadius * 0.6, { units: "kilometers" });

    const merged = turf.union(
      turf.featureCollection([vistulaBuffer!, wierzBuffer!]),
    );

    return {
      zone,
      label,
      description,
      feature: merged!,
      color,
      opacity,
    };
  });
}

/**
 * Get combined bounding box of all flood zones.
 */
export function getFloodBounds(zones: ScenarioZone[]) {
  if (zones.length === 0) return null;
  const fc = turf.featureCollection(zones.map((z) => z.feature));
  return turf.bbox(fc);
}
