"use client";

import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import type { LayerConfig, LayerState } from "@/types/layer";
import { getLayersByGroup } from "@/lib/layer-registry";

interface LayerPanelProps {
  layerStates: Record<string, LayerState>;
  onToggle: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
}

function LayerRow({
  layer,
  state,
  onToggle,
  onOpacityChange,
}: {
  layer: LayerConfig;
  state: LayerState;
  onToggle: () => void;
  onOpacityChange: (opacity: number) => void;
}) {
  const legendColor =
    layer.legend?.color ?? layer.style.paint["circle-color"] ?? "#888";

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: typeof legendColor === "string" ? legendColor : "#888" }}
        />
        <span className="text-sm flex-1 truncate">{layer.name}</span>
        <Switch checked={state.visible} onCheckedChange={onToggle} />
      </div>
      {state.visible && (
        <div className="pl-6">
          <Slider
            value={[state.opacity * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={(val) => onOpacityChange((Array.isArray(val) ? val[0] : val) / 100)}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}

export function LayerPanel({
  layerStates,
  onToggle,
  onOpacityChange,
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
            {layers.map((layer) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                state={
                  layerStates[layer.id] ?? { visible: false, opacity: 1 }
                }
                onToggle={() => onToggle(layer.id)}
                onOpacityChange={(o) => onOpacityChange(layer.id, o)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
