import type { Feature, FeatureCollection, Geometry } from "geojson";

export type GeoFeature = Feature<Geometry, Record<string, unknown>>;
export type GeoFeatureCollection = FeatureCollection<
  Geometry,
  Record<string, unknown>
>;
