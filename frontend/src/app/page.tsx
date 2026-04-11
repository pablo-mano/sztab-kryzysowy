"use client";

import { useMemo, useRef, useCallback, useState } from "react";
import { type MapRef } from "@vis.gl/react-maplibre";
import { DashboardMap } from "@/components/map/DashboardMap";
import { MapLegend } from "@/components/map/MapLegend";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ScenarioSidebar } from "@/components/dashboard/ScenarioSidebar";
import { useLayers } from "@/hooks/useLayers";
import { useLayerData, type RegionFilter } from "@/hooks/useLayerData";
import { useScenario } from "@/hooks/useScenario";
import { useScenarioImpact } from "@/hooks/useScenarioImpact";
import { isLayerInMode, type MapMode } from "@/lib/layer-registry";
import type { GeoFeature, GeoFeatureCollection } from "@/types/feature";

function useAllLayerData(
  layerIds: string[],
  isVisible: (id: string) => boolean,
  regionFilter: RegionFilter | null,
  zoom: number | null,
) {
  const results: Record<string, GeoFeatureCollection | undefined> = {};

  for (const id of layerIds) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data } = useLayerData(id, isVisible(id), regionFilter, zoom);
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
    selectScenario,
    deactivate: scenarioDeactivate,
    togglePlay: scenarioTogglePlay,
    setHours: scenarioSetHours,
    setWindDirection: scenarioSetWindDirection,
    setWindSpeed: scenarioSetWindSpeed,
    setWaterLevel: scenarioSetWaterLevel,
    setRainfallIntensity: scenarioSetRainfallIntensity,
    maxHours: scenarioMaxHours,
  } = useScenario();

  const scenarioImpact = useScenarioImpact(scenarioState.zones);

  const [regionFilter, setRegionFilter] = useState<RegionFilter | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("h3");
  const [mapZoom, setMapZoom] = useState<number>(8);

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

  const layerData = useAllLayerData(layerIds, isEffectivelyVisible, regionFilter, mapZoom);

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

  const handleZoomChange = useCallback((zoom: number) => {
    setMapZoom(zoom);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar — left (layers) */}
      <Sidebar
        layerStates={layerStates}
        onToggle={toggleLayer}
        lastUpdate={new Date()}
        layerData={layerData}
        onFeatureClick={handleFeatureClick}
        regionFilter={regionFilter}
        onClearRegion={handleClearRegion}
        mapMode={mapMode}
        onMapModeChange={setMapMode}
      />

      {/* Map area */}
      <div className="flex-1 relative">
        <DashboardMap
          visibleLayers={visibleLayers}
          layerData={layerData}
          layerOpacity={layerOpacity}
          scenarioZones={scenarioState.zones}
          mapRef={mapRef}
          onZoomChange={handleZoomChange}
        />
        <MapLegend layers={visibleLayers} />
      </div>

      {/* Scenario panel — right */}
      <ScenarioSidebar
        scenario={scenarioState}
        scenarioImpact={scenarioImpact}
        maxHours={scenarioMaxHours}
        onSelectScenario={selectScenario}
        onDeactivate={scenarioDeactivate}
        onTogglePlay={scenarioTogglePlay}
        onHoursChange={scenarioSetHours}
        onWindDirectionChange={scenarioSetWindDirection}
        onWindSpeedChange={scenarioSetWindSpeed}
        onWaterLevelChange={scenarioSetWaterLevel}
        onRainfallIntensityChange={scenarioSetRainfallIntensity}
      />
    </div>
  );
}
