"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayerPanel } from "@/components/map/LayerPanel";
import { RegionPicker } from "./RegionPicker";
import { DataTimestamp } from "./DataTimestamp";
import type { LayerState } from "@/types/layer";
import type { GeoFeature, GeoFeatureCollection } from "@/types/feature";
import type { RegionFilter } from "@/hooks/useLayerData";
import type { MapMode } from "@/lib/layer-registry";

interface SidebarProps {
  layerStates: Record<string, LayerState>;
  onToggle: (id: string) => void;
  lastUpdate: Date | null;
  layerData: Record<string, GeoFeatureCollection | undefined>;
  onFeatureClick?: (feature: GeoFeature, layerId: string) => void;
  regionFilter: RegionFilter | null;
  onRegionChange: (filter: RegionFilter | null) => void;
  mapMode: MapMode;
  onMapModeChange: (mode: MapMode) => void;
}

export function Sidebar({
  layerStates,
  onToggle,
  lastUpdate,
  layerData,
  onFeatureClick,
  regionFilter,
  onRegionChange,
  mapMode,
  onMapModeChange,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="w-10 border-r border-border bg-card flex flex-col items-center py-3 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Rozwin panel"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[380px] border-r border-border bg-card flex flex-col shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Mapa zarzadzania kryzysowego
          </h1>
          <p className="text-xs text-muted-foreground">
            Geospatial Decision Support
          </p>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Zwin panel"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Region picker */}
      <RegionPicker
        regionFilter={regionFilter}
        onRegionChange={onRegionChange}
      />

      {/* Layer panel */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <LayerPanel
            layerStates={layerStates}
            layerData={layerData}
            onToggle={onToggle}
            onFeatureClick={onFeatureClick}
            mapMode={mapMode}
            onMapModeChange={onMapModeChange}
          />
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border">
        <DataTimestamp timestamp={lastUpdate} />
      </div>
    </aside>
  );
}
