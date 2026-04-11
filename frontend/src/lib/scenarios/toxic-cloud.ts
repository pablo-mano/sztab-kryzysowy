import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";

export interface ToxicCloudParams {
  origin: [number, number]; // [lng, lat]
  windDirection: number; // degrees, 0 = N
  windSpeed: number; // m/s
  hours: number; // 0-8
}

export interface ToxicCloudZone {
  zone: "red" | "orange" | "yellow";
  label: string;
  description: string;
  feature: Feature<Polygon>;
}

/**
 * Generate toxic cloud zones based on wind and time.
 * Three zones:
 * - Red (0-2 km): lethal concentration
 * - Orange (2-5 km): health risk
 * - Yellow (5-12 km): precautionary
 *
 * Cloud shape: sector (wedge) in wind direction + buffer.
 * Size grows with time and wind speed.
 */
export function generateToxicCloud(params: ToxicCloudParams): ToxicCloudZone[] {
  const { origin, windDirection, windSpeed, hours } = params;

  if (hours <= 0) return [];

  // Distance factor: grows with time and wind speed
  const speedFactor = Math.max(0.5, windSpeed / 5);
  const timeFactor = Math.min(1, hours / 4); // reaches max at 4h

  const zones: { zone: ToxicCloudZone["zone"]; baseRadius: number; label: string; description: string }[] = [
    { zone: "yellow", baseRadius: 12, label: "Strefa ostrzegawcza", description: "Zalecane pozostanie w budynkach" },
    { zone: "orange", baseRadius: 5, label: "Strefa zagrożenia", description: "Ryzyko zdrowotne, ewakuacja zalecana" },
    { zone: "red", baseRadius: 2, label: "Strefa śmiertelna", description: "Natychmiastowa ewakuacja" },
  ];

  return zones.map(({ zone, baseRadius, label, description }) => {
    const radius = baseRadius * speedFactor * timeFactor;
    const feature = createCloudSector(origin, windDirection, radius);
    return { zone, label, description, feature };
  });
}

/**
 * Create a sector (wedge) shape pointing in wind direction.
 * The cloud spreads ~60° wide in the downwind direction.
 */
function createCloudSector(
  origin: [number, number],
  windDirection: number,
  radiusKm: number,
): Feature<Polygon> {
  // Wind blows FROM windDirection, cloud goes OPPOSITE
  const cloudDirection = (windDirection + 180) % 360;
  const spreadAngle = 30; // half-spread

  const steps = 24;
  const coords: [number, number][] = [origin];

  for (let i = 0; i <= steps; i++) {
    const angle = cloudDirection - spreadAngle + (2 * spreadAngle * i) / steps;
    const dest = turf.destination(turf.point(origin), radiusKm, angle, { units: "kilometers" });
    coords.push(dest.geometry.coordinates as [number, number]);
  }

  coords.push(origin); // close the polygon

  const sector = turf.polygon([coords]);

  // Smooth with buffer to make it look more natural
  const buffered = turf.buffer(sector, radiusKm * 0.15, { units: "kilometers" });

  return buffered as Feature<Polygon>;
}

/**
 * Get the combined bounding box of all cloud zones.
 */
export function getCloudBounds(zones: ToxicCloudZone[]) {
  if (zones.length === 0) return null;
  const fc = turf.featureCollection(zones.map((z) => z.feature));
  return turf.bbox(fc);
}
