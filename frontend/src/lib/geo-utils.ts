import * as turf from "@turf/turf";
import type { BBox } from "geojson";
import type { GeoFeatureCollection } from "@/types/feature";
import riversData from "@/data/rivers.json";

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

/** Wisła through Lubelskie — 153-point centerline from OSM. */
export const VISTULA_LUBELSKIE: [number, number][] = riversData.vistula as [number, number][];

/** Wieprz — 152-point centerline from OSM relation (source to Wisła confluence). */
export const WIEPRZ_LUBELSKIE: [number, number][] = riversData.wieprz as [number, number][];

/** All rivers data keyed by slug. */
export const ALL_RIVERS: Record<string, { name: string; coords: [number, number][] }> = {
  vistula: { name: "Wisła", coords: VISTULA_LUBELSKIE },
  wieprz: { name: "Wieprz", coords: WIEPRZ_LUBELSKIE },
  bystrzyca: { name: "Bystrzyca", coords: riversData.bystrzyca as [number, number][] },
  tysmienica: { name: "Tyśmienica", coords: riversData.tysmienica as [number, number][] },
  bug: { name: "Bug", coords: riversData.bug as [number, number][] },
  tanew: { name: "Tanew", coords: riversData.tanew as [number, number][] },
  kamienna: { name: "Kamienna", coords: riversData.kamienna as [number, number][] },
  huczwa: { name: "Huczwa", coords: riversData.huczwa as [number, number][] },
  chodelka: { name: "Chodelka", coords: riversData.chodelka as [number, number][] },
  por: { name: "Por", coords: riversData.por as [number, number][] },
  kurowka: { name: "Kurówka", coords: riversData.kurowka as [number, number][] },
};
