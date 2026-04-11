"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Filter } from "lucide-react";
import type { LayerConfig, LayerState } from "@/types/layer";
import type { GeoFeature, GeoFeatureCollection } from "@/types/feature";
import { getLayersByGroup } from "@/lib/layer-registry";

interface LayerPanelProps {
  layerStates: Record<string, LayerState>;
  layerData: Record<string, GeoFeatureCollection | undefined>;
  onToggle: (id: string) => void;
  onFeatureClick?: (feature: GeoFeature, layerId: string) => void;
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
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const legendColor =
    layer.legend?.color ?? layer.style.paint["circle-color"] ?? "#888";

  const toggleFeature = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const featureName = (f: GeoFeature, idx: number): string => {
    const p = f.properties ?? {};
    return (
      (p.name as string) ??
      (p.station_name as string) ??
      (p.id as string) ??
      `#${idx + 1}`
    );
  };

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
              ({featureCount})
            </span>
          )}
        </div>
        {state.visible && features.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`p-1 rounded hover:bg-accent transition-colors ${expanded ? "text-foreground bg-accent" : "text-muted-foreground"}`}
            title="Filtruj obiekty"
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
        )}
        <Switch checked={state.visible} onCheckedChange={onToggle} />
      </div>

      {expanded && state.visible && features.length > 0 && (
        <div className="pl-5 max-h-48 overflow-y-auto space-y-0.5">
          {features.map((f, idx) => {
            const isSelected = selected.size === 0 || selected.has(idx);
            return (
              <button
                key={idx}
                onClick={() => {
                  toggleFeature(idx);
                  if (onFeatureClick) onFeatureClick(f);
                }}
                className={`w-full text-left text-xs px-2 py-1 rounded truncate transition-colors ${
                  isSelected
                    ? "text-foreground hover:bg-accent"
                    : "text-muted-foreground/50 hover:bg-accent/50"
                }`}
              >
                {featureName(f, idx)}
              </button>
            );
          })}
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
}: LayerPanelProps) {
  const groups = getLayersByGroup();

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([group, layers]) => (
        <div key={group}>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {group}
          </h3>
          <div className="space-y-3">
            {layers.map((layer) => {
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
      ))}
    </div>
  );
}
