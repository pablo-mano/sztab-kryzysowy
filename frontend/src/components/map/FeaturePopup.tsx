"use client";

import { Popup } from "@vis.gl/react-maplibre";
import { getLayer } from "@/lib/layer-registry";
import type { GeoFeature } from "@/types/feature";

interface FeaturePopupProps {
  feature: GeoFeature;
  layerId: string;
  lngLat: [number, number];
  onClose: () => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString("pl-PL");
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FeaturePopup({
  feature,
  layerId,
  lngLat,
  onClose,
}: FeaturePopupProps) {
  const layer = getLayer(layerId);
  const properties = feature.properties ?? {};

  const fields = layer?.popupFields ?? Object.keys(properties).slice(0, 6);

  return (
    <Popup
      longitude={lngLat[0]}
      latitude={lngLat[1]}
      onClose={onClose}
      closeButton
      closeOnClick={false}
      className="[&_.maplibregl-popup-content]:!bg-card [&_.maplibregl-popup-content]:!text-card-foreground [&_.maplibregl-popup-content]:!border [&_.maplibregl-popup-content]:!border-border [&_.maplibregl-popup-content]:!rounded-lg [&_.maplibregl-popup-content]:!shadow-xl [&_.maplibregl-popup-content]:!p-3"
    >
      <div className="space-y-1 min-w-[180px]">
        {layer && (
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {layer.name}
          </div>
        )}
        {fields.map((field) => (
          <div key={field} className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{formatLabel(field)}</span>
            <span className="font-medium text-right">
              {formatValue(properties[field])}
            </span>
          </div>
        ))}
      </div>
    </Popup>
  );
}
