"use client";

import type { LayerConfig } from "@/types/layer";

interface MapLegendProps {
  layers: LayerConfig[];
}

function GradientLegend({ layer }: { layer: LayerConfig }) {
  const legend = layer.legend;
  if (!legend || legend.type !== "gradient" || !legend.stops || !legend.colors) return null;

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium">{layer.name}</span>
      <div
        className="h-2 rounded-full w-full"
        style={{
          background: `linear-gradient(to right, ${legend.colors.join(", ")})`,
        }}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        {legend.stops.map((stop, i) => (
          <span key={i}>{stop}</span>
        ))}
      </div>
    </div>
  );
}

function CategoricalLegend({ layer }: { layer: LayerConfig }) {
  const legend = layer.legend;
  if (!legend || legend.type !== "categorical" || !legend.stops || !legend.colors) return null;

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium">{layer.name}</span>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {legend.stops.map((label, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: legend.colors![i] ?? "#888" }}
            />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleLegend({ layer }: { layer: LayerConfig }) {
  const color = layer.legend?.color ?? layer.style.paint["circle-color"] ?? "#888";

  return (
    <div className="flex items-center gap-2">
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: typeof color === "string" ? color : "#888" }}
      />
      <span className="text-xs">{layer.name}</span>
    </div>
  );
}

export function MapLegend({ layers }: MapLegendProps) {
  if (layers.length === 0) return null;

  return (
    <div className="absolute bottom-8 left-3 z-10 max-w-[200px] rounded-lg border border-border bg-card/90 backdrop-blur-sm p-3 space-y-2">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        legenda
      </span>
      {layers.map((layer) => {
        const type = layer.legend?.type ?? "simple";
        if (type === "gradient") return <GradientLegend key={layer.id} layer={layer} />;
        if (type === "categorical") return <CategoricalLegend key={layer.id} layer={layer} />;
        return <SimpleLegend key={layer.id} layer={layer} />;
      })}
    </div>
  );
}
