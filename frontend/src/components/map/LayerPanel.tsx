"use client";

import { useState, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { Filter, Search, Hexagon, MapPin } from "lucide-react";
import type { LayerConfig, LayerState } from "@/types/layer";
import type { GeoFeature, GeoFeatureCollection } from "@/types/feature";
import { getLayersByGroup, isLayerInMode, type MapMode } from "@/lib/layer-registry";

interface LayerPanelProps {
  layerStates: Record<string, LayerState>;
  layerData: Record<string, GeoFeatureCollection | undefined>;
  onToggle: (id: string) => void;
  onFeatureClick?: (feature: GeoFeature, layerId: string) => void;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
}

function featureName(f: GeoFeature, idx: number): string {
  const p = f.properties ?? {};
  return (
    (p.name as string) ??
    (p.station_name as string) ??
    (p.id as string) ??
    `#${idx + 1}`
  );
}

function matchesSearch(f: GeoFeature, query: string): boolean {
  const q = query.toLowerCase();
  const props = f.properties ?? {};
  return Object.values(props).some(
    (v) => typeof v === "string" && v.toLowerCase().includes(q),
  );
}

function LayerRow({
  layer,
  state,
  featureCount,
  features,
  onToggle,
  onFeatureClick,
}: {
  layer: LayerConfig;
  state: LayerState;
  featureCount: number;
  features: GeoFeature[];
  onToggle: () => void;
  onFeatureClick?: (feature: GeoFeature) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");

  const legendColor =
    layer.legend?.color ?? layer.style.paint["circle-color"] ?? "#888";

  const filteredFeatures = useMemo(() => {
    if (!search.trim()) return features.map((f, i) => ({ f, i, match: true }));
    return features.map((f, i) => ({ f, i, match: matchesSearch(f, search) }));
  }, [features, search]);

  const matchCount = filteredFeatures.filter((x) => x.match).length;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: typeof legendColor === "string" ? legendColor : "#888" }}
        />
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span className="text-sm truncate">{layer.name}</span>
          {state.visible && featureCount > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              ({search.trim() ? `${matchCount}/` : ""}{featureCount})
            </span>
          )}
        </div>
        {state.visible && features.length > 0 && (
          <button
            onClick={() => { setExpanded(!expanded); if (expanded) setSearch(""); }}
            className={`p-1 rounded hover:bg-accent transition-colors ${expanded ? "text-foreground bg-accent" : "text-muted-foreground"}`}
            title="Filtruj obiekty"
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
        )}
        <Switch checked={state.visible} onCheckedChange={onToggle} />
      </div>

      {expanded && state.visible && features.length > 0 && (
        <div className="pl-5 space-y-1">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2 top-1.5 w-3 h-3 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj..."
              className="w-full rounded border border-border bg-background pl-6 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Feature list */}
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filteredFeatures.map(({ f, i, match }) => (
              <button
                key={i}
                onClick={() => { if (onFeatureClick) onFeatureClick(f); }}
                className={`w-full text-left text-xs px-2 py-1 rounded truncate transition-colors ${
                  match
                    ? "text-foreground hover:bg-accent"
                    : "text-muted-foreground/30"
                }`}
              >
                {featureName(f, i)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function LayerPanel({
  layerStates,
  layerData,
  onToggle,
  onFeatureClick,
  mapMode,
  onMapModeChange,
}: LayerPanelProps) {
  const groups = getLayersByGroup();

  return (
    <div className="space-y-4">
      {/* Map mode toggle */}
      <div className="flex rounded-lg border border-border bg-background overflow-hidden">
        <button
          onClick={() => onMapModeChange("h3")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
            mapMode === "h3"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          <Hexagon className="w-3.5 h-3.5" />
          Widok analityczny
        </button>
        <button
          onClick={() => onMapModeChange("points")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
            mapMode === "points"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Warstwy
        </button>
      </div>

      {Object.entries(groups).map(([group, layers]) => {
        const filtered = layers.filter((l) => isLayerInMode(l, mapMode));
        if (filtered.length === 0) return null;
        return (
        <div key={group}>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {group}
          </h3>
          <div className="space-y-3">
            {filtered.map((layer) => {
              const data = layerData[layer.id];
              const features = data?.features ?? [];
              return (
                <LayerRow
                  key={layer.id}
                  layer={layer}
                  state={layerStates[layer.id] ?? { visible: false, opacity: 1 }}
                  featureCount={features.length}
                  features={features}
                  onToggle={() => onToggle(layer.id)}
                  onFeatureClick={onFeatureClick ? (f) => onFeatureClick(f, layer.id) : undefined}
                />
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}
