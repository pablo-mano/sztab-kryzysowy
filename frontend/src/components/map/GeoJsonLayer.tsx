"use client";

import { Source, Layer, type LayerProps } from "@vis.gl/react-maplibre";
import type { LayerConfig } from "@/types/layer";
import type { GeoFeatureCollection } from "@/types/feature";

interface GeoJsonLayerProps {
  layerConfig: LayerConfig;
  data: GeoFeatureCollection;
  opacity: number;
}

function buildLayerSpec(config: LayerConfig, opacity: number): LayerProps {
  const { type, paint } = config.style;
  const adjustedPaint = { ...paint };

  // Apply opacity
  if (type === "fill") {
    adjustedPaint["fill-opacity"] =
      ((paint["fill-opacity"] as number) ?? 0.5) * opacity;
  } else if (type === "circle") {
    adjustedPaint["circle-opacity"] = opacity;
  } else if (type === "line") {
    adjustedPaint["line-opacity"] =
      ((paint["line-opacity"] as number) ?? 1) * opacity;
  } else if (type === "fill-extrusion") {
    adjustedPaint["fill-extrusion-opacity"] =
      ((paint["fill-extrusion-opacity"] as number) ?? 0.7) * opacity;
  }

  return {
    id: config.id,
    type,
    paint: adjustedPaint,
  } as LayerProps;
}

export function GeoJsonLayer({
  layerConfig,
  data,
  opacity,
}: GeoJsonLayerProps) {
  const layerSpec = buildLayerSpec(layerConfig, opacity);

  return (
    <Source id={`source-${layerConfig.id}`} type="geojson" data={data}>
      <Layer {...layerSpec} />
    </Source>
  );
}
