"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Layers, AlertTriangle, PanelLeftClose, PanelLeft, MapPin, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayerPanel } from "@/components/map/LayerPanel";
import { DataTimestamp } from "./DataTimestamp";
import { ScenarioPanel } from "@/components/scenario/ScenarioPanel";
import type { LayerState } from "@/types/layer";
import type { GeoFeature, GeoFeatureCollection } from "@/types/feature";
import type { ScenarioState } from "@/hooks/useScenario";
import type { RegionFilter } from "@/hooks/useLayerData";

const LEVEL_LABELS: Record<string, string> = {
  wojewodztwo: "Województwo",
  powiat: "Powiat",
  gmina: "Gmina",
};

interface SidebarProps {
  layerStates: Record<string, LayerState>;
  onToggle: (id: string) => void;
  lastUpdate: Date | null;
  layerData: Record<string, GeoFeatureCollection | undefined>;
  onFeatureClick?: (feature: GeoFeature, layerId: string) => void;
  regionFilter: RegionFilter | null;
  onClearRegion: () => void;
  scenario: ScenarioState;
  onScenarioActivate: () => void;
  onScenarioDeactivate: () => void;
  onScenarioTogglePlay: () => void;
  onScenarioHoursChange: (hours: number) => void;
  onScenarioWindDirectionChange: (deg: number) => void;
  onScenarioWindSpeedChange: (speed: number) => void;
}

export function Sidebar({
  layerStates,
  onToggle,
  lastUpdate,
  layerData,
  onFeatureClick,
  regionFilter,
  onClearRegion,
  scenario,
  onScenarioActivate,
  onScenarioDeactivate,
  onScenarioTogglePlay,
  onScenarioHoursChange,
  onScenarioWindDirectionChange,
  onScenarioWindSpeedChange,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="w-10 border-r border-border bg-card flex flex-col items-center py-3 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Rozwiń panel"
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
            Mapa zarządzania kryzysowego
          </h1>
          <p className="text-xs text-muted-foreground">
            Geospatial Decision Support
          </p>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Zwiń panel"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Active region filter */}
      {regionFilter && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2">
          <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-blue-300/70">{LEVEL_LABELS[regionFilter.level] ?? regionFilter.level}: </span>
            <span className="text-sm font-medium text-blue-200 truncate">{regionFilter.name}</span>
          </div>
          <button
            onClick={onClearRegion}
            className="p-0.5 rounded hover:bg-blue-500/20 text-blue-300 hover:text-blue-100 transition-colors"
            title="Wyczyść filtr regionu"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue={0} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value={0}>
              <Layers className="w-3.5 h-3.5" />
              Warstwy
            </TabsTrigger>
            <TabsTrigger value={1}>
              <AlertTriangle className="w-3.5 h-3.5" />
              Scenariusz
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <TabsContent value={0} className="p-4 space-y-4">
            <LayerPanel
              layerStates={layerStates}
              layerData={layerData}
              onToggle={onToggle}
              onFeatureClick={onFeatureClick}
            />
          </TabsContent>

          <TabsContent value={1} className="p-4 space-y-4">
            <ScenarioPanel
              state={scenario}
              onActivate={onScenarioActivate}
              onDeactivate={onScenarioDeactivate}
              onTogglePlay={onScenarioTogglePlay}
              onHoursChange={onScenarioHoursChange}
              onWindDirectionChange={onScenarioWindDirectionChange}
              onWindSpeedChange={onScenarioWindSpeedChange}
            />
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border">
        <DataTimestamp timestamp={lastUpdate} />
      </div>
    </aside>
  );
}
