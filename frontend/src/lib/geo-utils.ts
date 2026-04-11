import * as turf from "@turf/turf";
import type { BBox } from "geojson";
import type { GeoFeatureCollection } from "@/types/feature";

export function getBBox(fc: GeoFeatureCollection): BBox {
  return turf.bbox(fc);
}

export function getCenter(fc: GeoFeatureCollection): [number, number] {
  const center = turf.center(fc);
  return center.geometry.coordinates as [number, number];
}

export function distanceKm(
  from: [number, number],
  to: [number, number],
): number {
  return turf.distance(turf.point(from), turf.point(to), { units: "kilometers" });
}

export function bufferKm(
  center: [number, number],
  radiusKm: number,
) {
  return turf.buffer(turf.point(center), radiusKm, { units: "kilometers" });
}

export const LUBLIN_CENTER: [number, number] = [22.57, 51.25];
export const PULAWY_CENTER: [number, number] = [21.9667, 51.4167];
export const LUBELSKIE_BOUNDS: [[number, number], [number, number]] = [
  [21.1, 50.3],
  [24.2, 52.3],
];

/**
 * Wisła through Lubelskie voivodeship — simplified centerline.
 * From Zawichost (south) to Dęblin (north).
 * Coordinates: [longitude, latitude]
 */
export const VISTULA_LUBELSKIE: [number, number][] = [
  [21.86, 50.81],  // Zawichost
  [21.83, 50.86],  // near Annopol
  [21.80, 50.92],  // Annopol
  [21.78, 50.98],  // Solec nad Wisłą
  [21.80, 51.04],  // Józefów nad Wisłą
  [21.82, 51.10],  // Łaziska
  [21.84, 51.15],  // Bochotnica
  [21.85, 51.19],  // Kazimierz Dolny
  [21.87, 51.24],  // Celejów
  [21.91, 51.30],  // Wąwolnica area
  [21.94, 51.35],  // Nałęczów area
  [21.97, 51.40],  // Puławy (south)
  [21.97, 51.42],  // Puławy (center)
  [21.95, 51.46],  // Puławy (north)
  [21.91, 51.50],  // Gołąb
  [21.87, 51.53],  // Stężyca
  [21.84, 51.56],  // near Dęblin
  [21.82, 51.59],  // Dęblin
  [21.80, 51.62],  // Irena
];
