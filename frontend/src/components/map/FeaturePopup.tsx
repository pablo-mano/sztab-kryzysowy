"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Popup } from "@vis.gl/react-maplibre";
import { X } from "lucide-react";
import { getLayer } from "@/lib/layer-registry";
import type { GeoFeature } from "@/types/feature";

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt="Podgląd zgłoszenia"
        className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

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
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const isScenarioZone = layerId.startsWith("scenario-fill-");
  const layer = isScenarioZone ? null : getLayer(layerId);
  const properties = feature.properties ?? {};

  // _all_ sentinel means show all non-internal properties
  const INTERNAL_KEYS = new Set(["image_path", "audio_path", "ingested_at", "lat", "lon", "latitude", "longitude"]);
  const rawFields = layer?.popupFields ?? (isScenarioZone ? [] : Object.keys(properties).slice(0, 6));
  const fields = rawFields.length === 1 && rawFields[0] === "_all_"
    ? Object.keys(properties).filter((k) => !INTERNAL_KEYS.has(k) && properties[k] != null && String(properties[k]).trim() !== "")
    : rawFields;

  // Scenario zone popup — dedicated layout
  if (isScenarioZone) {
    const label = String(properties._zone_label ?? "Strefa");
    const description = String(properties._zone_description ?? "");
    const color = String(properties._zone_color ?? "#f43f5e");

    return (
      <Popup
        longitude={lngLat[0]}
        latitude={lngLat[1]}
        onClose={onClose}
        closeButton
        closeOnClick={false}
        className="[&_.maplibregl-popup-content]:!bg-card [&_.maplibregl-popup-content]:!text-card-foreground [&_.maplibregl-popup-content]:!border [&_.maplibregl-popup-content]:!border-border [&_.maplibregl-popup-content]:!rounded-lg [&_.maplibregl-popup-content]:!shadow-xl [&_.maplibregl-popup-content]:!p-3"
      >
        <div className="min-w-[180px] max-w-[280px]">
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-sm font-bold" style={{ color }}>
              {label}
            </span>
          </div>
          <div className="space-y-0.5">
            {description.split("\n").map((line, i) => (
              <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                {line}
              </p>
            ))}
          </div>
        </div>
      </Popup>
    );
  }

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
                  className="w-full max-w-[280px] rounded border border-border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setLightboxSrc(value as string)}
                />
              </div>
            );
          }

          const isAudioUrl =
            field === "audio_url" &&
            typeof value === "string" &&
            value.startsWith("http");

          if (isAudioUrl) {
            return (
              <div key={field} className="space-y-1">
                <span className="text-xs text-muted-foreground">{formatLabel(field)}</span>
                <audio controls src={value as string} className="w-full h-8 rounded" />
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
      {lightboxSrc && (
        <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
      )}
    </Popup>
  );
}
