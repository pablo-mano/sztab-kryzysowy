"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Layers, BarChart3, AlertTriangle, PanelLeftClose, PanelLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayerPanel } from "@/components/map/LayerPanel";
import { KpiGrid } from "./KpiGrid";
import { DataTimestamp } from "./DataTimestamp";
import { ScenarioPanel } from "@/components/scenario/ScenarioPanel";
import type { LayerState } from "@/types/layer";
import type { KpiConfig } from "@/types/dashboard";
import type { ScenarioState } from "@/hooks/useScenario";

interface SidebarProps {
  layerStates: Record<string, LayerState>;
  onToggle: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  kpis: KpiConfig[];
  lastUpdate: Date | null;
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
  onOpacityChange,
  kpis,
  lastUpdate,
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

      {/* Tabs */}
      <Tabs defaultValue={0} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value={0}>
              <Layers className="w-3.5 h-3.5" />
              Warstwy
            </TabsTrigger>
            <TabsTrigger value={1}>
              <BarChart3 className="w-3.5 h-3.5" />
              Dane
            </TabsTrigger>
            <TabsTrigger value={2}>
              <AlertTriangle className="w-3.5 h-3.5" />
              Scenariusz
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <TabsContent value={0} className="p-4 space-y-4">
            <LayerPanel
              layerStates={layerStates}
              onToggle={onToggle}
              onOpacityChange={onOpacityChange}
            />
          </TabsContent>

          <TabsContent value={1} className="p-4 space-y-4">
            <KpiGrid items={kpis} />
            {kpis.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Włącz warstwy, aby zobaczyć statystyki
              </p>
            )}
          </TabsContent>

          <TabsContent value={2} className="p-4 space-y-4">
            <ScenarioPanel
              state={scenario}
              onActivate={onScenarioActivate}
              onDeactivate={onScenarioDeactivate}
              onTogglePlay={onScenarioTogglePlay}
              onHoursChange={onScenarioHoursChange}
              onWindDirectionChange={onScenarioWindDirectionChange}
              onWindSpeedChange={onScenarioWindSpeedChange}
            />
            <DataTimestamp timestamp={lastUpdate} />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </aside>
  );
}
