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

function formatValue(value: unknown, field?: string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toLocaleString("pl-PL");
  if (Array.isArray(value)) return value.join(", ");
  const s = String(value);
  // Format comma-separated lists (e.g. amenity_types)
  if (field === "amenity_types" && s.includes(",")) {
    return s.split(",").map((t) => t.trim()).join(", ");
  }
  return s;
}

function isLongValue(value: unknown, field?: string): boolean {
  if (field === "amenity_types") return true;
  const s = String(value ?? "");
  return s.length > 30;
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
  created_at: "Data zgłoszenia",
  audio_url: "Nagranie audio",
  image_url: "Zdjęcie",
  id: "ID zgłoszenia",
  feature_id: "ID strefy",
  likelihood_description: "Scenariusz",
  location_name: "Region wodny",
  return_period_years: "Okres powrotu (lata)",
  hazard_category: "Kategoria zagrożenia",
  flood_risk: "Ryzyko powodziowe",
  distance_to_river_km: "Odl. od rzeki (km)",
  length_km: "Długość (km)",
  river_name: "Rzeka",
  water_level_cm: "Poziom wody (cm)",
  alarm_level_cm: "Poziom alarmowy (cm)",
  warning_level_cm: "Poziom ostrzegawczy (cm)",
  status: "Status",
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
      <div className="space-y-1.5 min-w-[200px] max-w-[320px]">
        {layer && (
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {layer.name}
          </div>
        )}
        {fields.map((field) => {
          const value = properties[field];
          const isImageUrl =
            field === "image_url" &&
            typeof value === "string" &&
            value.startsWith("http");

          if (isImageUrl) {
            return (
              <div key={field} className="space-y-1">
                <span className="text-xs text-muted-foreground">{formatLabel(field)}</span>
                <img
                  src={value as string}
                  alt="Zdjęcie zgłoszenia"
                  className="w-full max-w-[280px] rounded border border-border"
                />
              </div>
            );
          }

          if (isLongValue(value, field)) {
            return (
              <div key={field} className="space-y-0.5 text-sm">
                <div className="text-muted-foreground text-xs">{formatLabel(field)}</div>
                <div className="font-medium break-words leading-snug">
                  {formatValue(value, field)}
                </div>
              </div>
            );
          }

          return (
            <div key={field} className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground shrink-0">{formatLabel(field)}</span>
              <span className="font-medium text-right truncate">
                {formatValue(value, field)}
              </span>
            </div>
          );
        })}
      </div>
    </Popup>
  );
}
