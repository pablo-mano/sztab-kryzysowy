"use client";

import { useMemo } from "react";
import { MapPin } from "lucide-react";
import type { GeoFeature } from "@/types/feature";

interface FeatureListProps {
  features: GeoFeature[];
  nameField?: string;
  secondaryField?: string;
  onFeatureClick?: (feature: GeoFeature) => void;
  maxItems?: number;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value.toLocaleString("pl-PL");
  return String(value);
}

export function FeatureList({
  features,
  nameField = "name",
  secondaryField,
  onFeatureClick,
  maxItems = 50,
}: FeatureListProps) {
  const items = useMemo(
    () => features.slice(0, maxItems),
    [features, maxItems],
  );

  if (features.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Brak wyników
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          {features.length} {features.length === 1 ? "obiekt" : features.length < 5 ? "obiekty" : "obiektów"}
        </span>
      </div>

      {items.map((feature, i) => {
        const name = formatValue(feature.properties?.[nameField]) || `Obiekt ${i + 1}`;
        const secondary = secondaryField
          ? formatValue(feature.properties?.[secondaryField])
          : null;

        return (
          <button
            key={i}
            onClick={() => onFeatureClick?.(feature)}
            className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{name}</div>
              {secondary && (
                <div className="text-xs text-muted-foreground truncate">
                  {secondary}
                </div>
              )}
            </div>
          </button>
        );
      })}

      {features.length > maxItems && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          ...i {features.length - maxItems} więcej
        </p>
      )}
    </div>
  );
}
