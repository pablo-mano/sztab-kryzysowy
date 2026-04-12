"use client";

import { useMemo, useRef, useCallback, useState, useEffect } from "react";
import { type MapRef } from "@vis.gl/react-maplibre";
import { DashboardMap } from "@/components/map/DashboardMap";
import { MapLegend } from "@/components/map/MapLegend";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ScenarioSidebar } from "@/components/dashboard/ScenarioSidebar";
import { ImpactBar } from "@/components/scenario/ImpactBar";
import { useLayers } from "@/hooks/useLayers";
import { useLayerData, type RegionFilter } from "@/hooks/useLayerData";
import type { BBox } from "@/hooks/useRegions";
import { useScenario } from "@/hooks/useScenario";
import { useScenarioImpact } from "@/hooks/useScenarioImpact";
import { isLayerInMode, type MapMode } from "@/lib/layer-registry";
import { PULAWY_CENTER } from "@/lib/geo-utils";
import { computeReportsBounds } from "@/lib/scenarios/civil-reports";
import type { GeoFeature, GeoFeatureCollection } from "@/types/feature";

const LEVEL_TO_ADMIN_LAYER: Record<string, string> = {
  wojewodztwo: "admin-wojewodztwo",
  powiat: "admin-powiaty",
  gmina: "admin-gminy",
};

/** Layer IDs that should be filtered by flood scenario */
const FLOOD_FILTERABLE_LAYERS = new Set([
  "poi-hospitals",
  "poi-schools",
  "poi-kindergartens",
  "poi-care-homes",
]);

function useAllLayerData(
  layerIds: string[],
  isVisible: (id: string) => boolean,
  regionFilter: RegionFilter | null,
  floodScenario: string | null,
) {
  const results: Record<string, GeoFeatureCollection | undefined> = {};

  for (const id of layerIds) {
    const flood = FLOOD_FILTERABLE_LAYERS.has(id) ? floodScenario : null;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data } = useLayerData(id, isVisible(id), regionFilter, flood);
    results[id] = data;
  }

  return results;
}

export default function DashboardPage() {
  const {
    allLayers,
    layerStates,
    toggleLayer,
    setLayerVisible,
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
    setSubstanceId: scenarioSetSubstance,
    setReleaseScenario: scenarioSetRelease,
    setStabilityClass: scenarioSetStability,
    resetStabilityAuto: scenarioResetStability,
    setTimeOfDay: scenarioSetTimeOfDay,
    setCloudCover: scenarioSetCloudCover,
    setFloodScenarioId: scenarioSetFloodScenario,
    setCivilTimeRange: scenarioSetCivilTimeRange,
    maxHours: scenarioMaxHours,
  } = useScenario();

  const scenarioImpact = useScenarioImpact(scenarioState.zones, scenarioState.scenarioType ?? undefined);

  const [regionFilter, setRegionFilter] = useState<RegionFilter | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("h3");
  const [floodFilterActive, setFloodFilterActive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Set lastUpdate only on client to avoid hydration mismatch
  useEffect(() => {
    setLastUpdate(new Date());
  }, []);

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

  // Pass flood scenario to POI layers when filter is active
  const activeFloodFilter =
    floodFilterActive &&
    scenarioState.active &&
    scenarioState.scenarioType === "flood" &&
    !scenarioState.floodLoading
      ? scenarioState.floodScenarioId
      : null;

  const layerData = useAllLayerData(layerIds, isEffectivelyVisible, regionFilter, activeFloodFilter);

  // Extract the highlighted region feature for the map overlay
  const highlightedRegion = useMemo(() => {
    if (!regionFilter) return null;
    const adminLayerId = LEVEL_TO_ADMIN_LAYER[regionFilter.level];
    if (!adminLayerId) return null;
    const data = layerData[adminLayerId];
    if (!data) return null;
    const feature = data.features.find(
      (f) => f.properties?.name === regionFilter.name,
    );
    return feature ?? null;
  }, [regionFilter, layerData]);

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

  // Auto-enable civil-reports layer when scenario activates
  useEffect(() => {
    if (scenarioState.active && scenarioState.scenarioType === "civil-reports") {
      setLayerVisible("civil-reports", true);
    }
  }, [scenarioState.active, scenarioState.scenarioType, setLayerVisible]);

  // Auto-flyTo when scenario activates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (scenarioState.active && scenarioState.scenarioType === "toxic-cloud") {
      map.flyTo({ center: PULAWY_CENTER, zoom: 11, duration: 1500 });
    }
  }, [scenarioState.active, scenarioState.scenarioType]);

  // Auto-flyTo for civil reports — fit bounds when reports load
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (
      scenarioState.active &&
      scenarioState.scenarioType === "civil-reports" &&
      scenarioState.civilReports.length > 0 &&
      !scenarioState.civilReportsLoading
    ) {
      const bounds = computeReportsBounds(scenarioState.civilReports);
      if (bounds) {
        map.fitBounds(bounds, { padding: 60, duration: 1500 });
      }
    }
  }, [
    scenarioState.active,
    scenarioState.scenarioType,
    scenarioState.civilReports.length,
    scenarioState.civilReportsLoading,
  ]);

  const handleRegionChange = useCallback(
    (filter: RegionFilter | null, bbox?: BBox) => {
      setRegionFilter(filter);

      if (!filter) return;

      // Enable the admin boundary layer for the selected level
      const adminLayerId = LEVEL_TO_ADMIN_LAYER[filter.level];
      if (adminLayerId && !isVisible(adminLayerId)) {
        setLayerVisible(adminLayerId, true);
      }

      // Fly to the region's bounding box
      const map = mapRef.current;
      if (map && bbox) {
        map.fitBounds(
          [[bbox[0], bbox[1]], [bbox[2], bbox[3]]],
          { padding: 40, duration: 1200 },
        );
      }
    },
    [isVisible, setLayerVisible],
  );

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

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar — left (layers) */}
      <Sidebar
        layerStates={layerStates}
        onToggle={toggleLayer}
        lastUpdate={lastUpdate}
        layerData={layerData}
        onFeatureClick={handleFeatureClick}
        regionFilter={regionFilter}
        onRegionChange={handleRegionChange}
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
          scenarioType={scenarioState.scenarioType}
          highlightedRegion={highlightedRegion}
          mapRef={mapRef}
        />
        <MapLegend layers={visibleLayers} />
        <ImpactBar zones={scenarioState.zones} impact={scenarioImpact} />
      </div>

      {/* Scenario panel — right */}
      <ScenarioSidebar
        scenario={scenarioState}
        maxHours={scenarioMaxHours}
        onSelectScenario={selectScenario}
        onDeactivate={scenarioDeactivate}
        onTogglePlay={scenarioTogglePlay}
        onHoursChange={scenarioSetHours}
        onWindDirectionChange={scenarioSetWindDirection}
        onWindSpeedChange={scenarioSetWindSpeed}
        onSubstanceChange={scenarioSetSubstance}
        onReleaseChange={scenarioSetRelease}
        onStabilityChange={scenarioSetStability}
        onStabilityReset={scenarioResetStability}
        onTimeOfDayChange={scenarioSetTimeOfDay}
        onCloudCoverChange={scenarioSetCloudCover}
        onFloodScenarioChange={scenarioSetFloodScenario}
        floodFilterActive={floodFilterActive}
        onFloodFilterToggle={setFloodFilterActive}
        onCivilTimeRangeChange={scenarioSetCivilTimeRange}
      />
    </div>
  );
}
