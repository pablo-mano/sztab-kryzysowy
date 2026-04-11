"use client";

import { useMemo, useRef, useCallback, useState } from "react";
import { type MapRef } from "@vis.gl/react-maplibre";
import { DashboardMap } from "@/components/map/DashboardMap";
import { MapLegend } from "@/components/map/MapLegend";
import { MapModeToggle } from "@/components/map/MapModeToggle";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { useLayers } from "@/hooks/useLayers";
import { useLayerData, type RegionFilter } from "@/hooks/useLayerData";
import { useScenario } from "@/hooks/useScenario";
import { isLayerInMode, type MapMode } from "@/lib/layer-registry";
import type { GeoFeature, GeoFeatureCollection } from "@/types/feature";

function useAllLayerData(
  layerIds: string[],
  isVisible: (id: string) => boolean,
  regionFilter: RegionFilter | null,
) {
  const results: Record<string, GeoFeatureCollection | undefined> = {};

  for (const id of layerIds) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data } = useLayerData(id, isVisible(id), regionFilter);
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

  const [regionFilter, setRegionFilter] = useState<RegionFilter | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("points");

  const layerIds = useMemo(() => allLayers.map((l) => l.id), [allLayers]);

  // Layer is effectively visible only if toggled on AND in the current map mode
  const isEffectivelyVisible = useCallback(
    (id: string) => {
      const layer = allLayers.find((l) => l.id === id);
      if (!layer) return false;
      return isVisible(id) && isLayerInMode(layer, mapMode);
    },
    [allLayers, isVisible, mapMode],
  );

  const layerData = useAllLayerData(layerIds, isEffectivelyVisible, regionFilter);

  const visibleLayers = useMemo(
    () => allLayers.filter((l) => isEffectivelyVisible(l.id)),
    [allLayers, isEffectivelyVisible],
  );

  const layerOpacity = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of allLayers) map[l.id] = getOpacity(l.id);
    return map;
  }, [allLayers, getOpacity]);

  const mapRef = useRef<MapRef>(null);

  const handleFeatureClick = useCallback((feature: GeoFeature, layerId: string) => {
    const map = mapRef.current;
    if (!map) return;

    // If clicking an admin boundary, set it as region filter
    if (layerId.startsWith("admin-")) {
      const name = feature.properties?.name as string | undefined;
      const level = layerId === "admin-wojewodztwo"
        ? "wojewodztwo"
        : layerId === "admin-powiaty"
          ? "powiat"
          : "gmina";
      if (name) {
        setRegionFilter((prev) =>
          prev?.name === name && prev?.level === level ? null : { name, level },
        );
        return;
      }
    }

    const geom = feature.geometry;
    if (geom.type === "Point") {
      const [lng, lat] = geom.coordinates as [number, number];
      map.flyTo({ center: [lng, lat], zoom: 14, duration: 1200 });
    }
  }, []);

  const handleClearRegion = useCallback(() => {
    setRegionFilter(null);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar — left */}
      <Sidebar
        layerStates={layerStates}
        onToggle={toggleLayer}
        lastUpdate={new Date()}
        layerData={layerData}
        onFeatureClick={handleFeatureClick}
        regionFilter={regionFilter}
        onClearRegion={handleClearRegion}
        mapMode={mapMode}
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
        <MapModeToggle mode={mapMode} onChange={setMapMode} />
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
