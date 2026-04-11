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
