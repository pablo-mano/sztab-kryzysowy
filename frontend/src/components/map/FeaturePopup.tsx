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

const FIELD_LABELS: Record<string, string> = {
  name: "Nazwa",
  city: "Miasto",
  estimated_population: "Szac. populacja",
  population: "Populacja",
  area_km2: "Powierzchnia (km²)",
  station_name: "Stacja",
  param_code: "Parametr",
  value: "Wartość",
  aqi_label: "Jakość powietrza",
  measure_date: "Data pomiaru",
  amenity_type: "Typ obiektu",
  poi_count: "Liczba POI",
  total_population: "Populacja łączna",
  amenity_types: "Typy obiektów",
  avg_value: "Średnia wartość",
  avg_pm10: "Średnie PM10",
  risk_score: "Wskaźnik ryzyka",
  teryt: "TERYT",
};

function formatLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
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
