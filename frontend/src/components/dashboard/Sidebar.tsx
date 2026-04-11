"use client";

import { useState, useMemo, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Layers, AlertTriangle, PanelLeftClose, PanelLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayerPanel } from "@/components/map/LayerPanel";
import { KpiGrid } from "./KpiGrid";
import { DataTimestamp } from "./DataTimestamp";
import { FilterPanel } from "./FilterPanel";
import { FeatureList } from "./FeatureList";
import { ScenarioPanel } from "@/components/scenario/ScenarioPanel";
import type { LayerConfig, LayerState } from "@/types/layer";
import type { KpiConfig } from "@/types/dashboard";
import type { GeoFeature, GeoFeatureCollection } from "@/types/feature";
import type { ScenarioState } from "@/hooks/useScenario";

/** Pick fields that have low cardinality (good for dropdown filters) */
function inferFilterableFields(features: GeoFeature[]): string[] {
  if (features.length === 0) return [];
  const props = features[0].properties ?? {};
  const candidates: string[] = [];

  for (const key of Object.keys(props)) {
    if (key === "name" || key === "id" || key === "osm_id") continue;
    const values = new Set<string>();
    let allString = true;
    for (const f of features) {
      const v = f.properties?.[key];
      if (v === null || v === undefined) continue;
      if (typeof v !== "string") { allString = false; break; }
      values.add(v);
      if (values.size > 20) break;
    }
    if (allString && values.size >= 2 && values.size <= 20) {
      candidates.push(key);
    }
  }
  return candidates.slice(0, 4);
}

interface SidebarProps {
  layerStates: Record<string, LayerState>;
  onToggle: (id: string) => void;
  kpis: KpiConfig[];
  lastUpdate: Date | null;
  visibleLayers: LayerConfig[];
  layerData: Record<string, GeoFeatureCollection | undefined>;
  onFeatureClick?: (feature: GeoFeature, layerId: string) => void;
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
  kpis,
  lastUpdate,
  visibleLayers,
  layerData,
  onFeatureClick,
  scenario,
  onScenarioActivate,
  onScenarioDeactivate,
  onScenarioTogglePlay,
  onScenarioHoursChange,
  onScenarioWindDirectionChange,
  onScenarioWindSpeedChange,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedDataLayer, setSelectedDataLayer] = useState<string | null>(null);
  const [filteredProps, setFilteredProps] = useState<Record<string, unknown>[] | null>(null);

  // Layers with data for the data tab
  const layersWithData = useMemo(
    () => visibleLayers.filter((l) => layerData[l.id]?.features?.length),
    [visibleLayers, layerData],
  );

  // Auto-select first layer with data
  const activeDataLayerId = selectedDataLayer && layersWithData.some(l => l.id === selectedDataLayer)
    ? selectedDataLayer
    : layersWithData[0]?.id ?? null;

  const activeDataLayer = layersWithData.find(l => l.id === activeDataLayerId);
  const activeFeatures = activeDataLayerId ? layerData[activeDataLayerId]?.features ?? [] : [];

  // Features to show (filtered or all)
  const displayFeatures = useMemo(() => {
    if (!filteredProps) return activeFeatures;
    const filteredSet = new Set(filteredProps);
    return activeFeatures.filter(f => filteredSet.has(f.properties as Record<string, unknown>));
  }, [activeFeatures, filteredProps]);

  const handleDataLayerChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDataLayer(e.target.value || null);
    setFilteredProps(null);
  }, []);

  const handleFilter = useCallback((filtered: Record<string, unknown>[]) => {
    setFilteredProps(filtered);
  }, []);

  const handleFeatureClick = useCallback((feature: GeoFeature) => {
    if (activeDataLayerId && onFeatureClick) {
      onFeatureClick(feature, activeDataLayerId);
    }
  }, [activeDataLayerId, onFeatureClick]);

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

            <KpiGrid items={kpis} />

            {layersWithData.length > 0 && (
              <>
                {/* Layer selector for data view */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Przeglądaj warstwę
                  </label>
                  <select
                    value={activeDataLayerId ?? ""}
                    onChange={handleDataLayerChange}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {layersWithData.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({layerData[l.id]?.features?.length ?? 0})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filters */}
                {activeDataLayer && activeFeatures.length > 0 && (
                  <FilterPanel
                    features={activeFeatures.map(f => f.properties as Record<string, unknown>)}
                    filterableFields={inferFilterableFields(activeFeatures)}
                    onFilter={handleFilter}
                  />
                )}

                {/* Feature list */}
                <FeatureList
                  features={displayFeatures}
                  nameField="name"
                  secondaryField="city"
                  onFeatureClick={handleFeatureClick}
                />
              </>
            )}
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
