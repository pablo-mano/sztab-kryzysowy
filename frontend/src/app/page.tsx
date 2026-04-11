"use client";

import { useMemo, useRef, useCallback } from "react";
import { type MapRef } from "@vis.gl/react-maplibre";
import { DashboardMap } from "@/components/map/DashboardMap";
import { MapLegend } from "@/components/map/MapLegend";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { useLayers } from "@/hooks/useLayers";
import { useLayerData } from "@/hooks/useLayerData";
import { useScenario } from "@/hooks/useScenario";
import type { GeoFeature, GeoFeatureCollection } from "@/types/feature";
import type { KpiConfig } from "@/types/dashboard";

function useAllLayerData(
  layerIds: string[],
  isVisible: (id: string) => boolean,
) {
  const results: Record<string, GeoFeatureCollection | undefined> = {};

  for (const id of layerIds) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data } = useLayerData(id, isVisible(id));
    results[id] = data;
  }

  return results;
}

export default function DashboardPage() {
  const {
    allLayers,
    layerStates,
    toggleLayer,
    setOpacity,
    isVisible,
    getOpacity,
  } = useLayers();

  const {
    state: scenarioState,
    activate: scenarioActivate,
    deactivate: scenarioDeactivate,
    togglePlay: scenarioTogglePlay,
    setHours: scenarioSetHours,
    setWindDirection: scenarioSetWindDirection,
    setWindSpeed: scenarioSetWindSpeed,
  } = useScenario();

  const layerIds = useMemo(() => allLayers.map((l) => l.id), [allLayers]);
  const layerData = useAllLayerData(layerIds, isVisible);

  const visibleLayers = useMemo(
    () => allLayers.filter((l) => isVisible(l.id)),
    [allLayers, isVisible],
  );

  const layerOpacity = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of allLayers) map[l.id] = getOpacity(l.id);
    return map;
  }, [allLayers, getOpacity]);

  const mapRef = useRef<MapRef>(null);

  const handleFeatureClick = useCallback((feature: GeoFeature, _layerId: string) => {
    const map = mapRef.current;
    if (!map) return;

    const geom = feature.geometry;
    if (geom.type === "Point") {
      const [lng, lat] = geom.coordinates as [number, number];
      map.flyTo({ center: [lng, lat], zoom: 14, duration: 1200 });
    }
  }, []);

  // Build KPIs from visible layers that have data
  const kpis = useMemo<KpiConfig[]>(() => {
    const items: KpiConfig[] = [];
    for (const layer of visibleLayers) {
      const data = layerData[layer.id];
      if (!data?.features?.length) continue;

      items.push({
        id: `${layer.id}-count`,
        label: layer.name,
        value: data.features.length,
        color: typeof layer.style.paint["circle-color"] === "string"
          ? layer.style.paint["circle-color"]
          : typeof layer.legend?.color === "string"
            ? layer.legend.color
            : undefined,
      });
    }
    return items;
  }, [visibleLayers, layerData]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar — left */}
      <Sidebar
        layerStates={layerStates}
        onToggle={toggleLayer}
        onOpacityChange={setOpacity}
        kpis={kpis}
        lastUpdate={new Date()}
        visibleLayers={visibleLayers}
        layerData={layerData}
        onFeatureClick={handleFeatureClick}
        scenario={scenarioState}
        onScenarioActivate={scenarioActivate}
        onScenarioDeactivate={scenarioDeactivate}
        onScenarioTogglePlay={scenarioTogglePlay}
        onScenarioHoursChange={scenarioSetHours}
        onScenarioWindDirectionChange={scenarioSetWindDirection}
        onScenarioWindSpeedChange={scenarioSetWindSpeed}
      />

      {/* Map area */}
      <div className="flex-1 relative">
        <DashboardMap
          visibleLayers={visibleLayers}
          layerData={layerData}
          layerOpacity={layerOpacity}
          scenarioZones={scenarioState.zones}
          mapRef={mapRef}
        />
        <MapLegend layers={visibleLayers} />
      </div>
    </div>
  );
}
