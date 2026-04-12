"use client";

import { useMemo, useRef, useCallback, useState, useEffect } from "react";
import { type MapRef } from "@vis.gl/react-maplibre";
import { DashboardMap } from "@/components/map/DashboardMap";
import { MapLegend } from "@/components/map/MapLegend";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { ScenarioSidebar } from "@/components/dashboard/ScenarioSidebar";
import { ImpactBar } from "@/components/scenario/ImpactBar";
import { BookOpen } from "lucide-react";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { TourOverlay } from "@/components/tour/TourOverlay";
import { useTour } from "@/components/tour/useTour";
import { TOUR_STEPS, type TourContext } from "@/components/tour/tour-steps";
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

/** Layers relevant for each scenario — only these stay visible during playback. */
const SCENARIO_LAYERS: Record<string, string[]> = {
  "toxic-cloud": [
    "admin-wojewodztwo",
    "poi-hospitals",
    "poi-schools",
    "poi-kindergartens",
    "poi-care-homes",
    "env-air-quality",
  ],
  flood: [
    "admin-wojewodztwo",
    "hydro-rivers",
    "hydro-gauges",
    "poi-hospitals",
    "poi-schools",
    "poi-kindergartens",
    "poi-care-homes",
  ],
  "civil-reports": [
    "admin-wojewodztwo",
    "civil-reports",
  ],
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
    setVisibilityMap,
    getVisibilitySnapshot,
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
    setCivilLiveMode: scenarioSetCivilLiveMode,
    maxHours: scenarioMaxHours,
  } = useScenario();

  const scenarioImpact = useScenarioImpact(scenarioState.zones, scenarioState.scenarioType ?? undefined);

  const tourContext: TourContext = useMemo(() => ({
    selectScenario,
    deactivateScenario: scenarioDeactivate,
  }), [selectScenario, scenarioDeactivate]);
  const tour = useTour(TOUR_STEPS, tourContext);

  const [showWelcome, setShowWelcome] = useState(true);
  const [regionFilter, setRegionFilter] = useState<RegionFilter | null>(null);
  const [mapMode, setMapMode] = useState<MapMode>("points");
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

  // Initial fit-all: run once when layer data first loads
  const didInitialFit = useRef(false);
  useEffect(() => {
    if (didInitialFit.current) return;
    const map = mapRef.current;
    if (!map) return;

    // Wait until at least a few visible layers have data
    const loadedCount = visibleLayers.filter((l) => layerData[l.id]?.features?.length).length;
    if (loadedCount < 2) return;

    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    let hasData = false;
    const extend = (lng: number, lat: number) => {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
      hasData = true;
    };
    const walk = (coords: unknown) => {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0] === "number" && typeof coords[1] === "number") {
        extend(coords[0] as number, coords[1] as number);
      } else {
        for (const c of coords) walk(c);
      }
    };
    for (const layer of visibleLayers) {
      const data = layerData[layer.id];
      if (!data?.features) continue;
      for (const f of data.features) {
        if ("coordinates" in f.geometry) walk(f.geometry.coordinates);
      }
    }
    if (hasData) {
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 1200 });
      didInitialFit.current = true;
    }
  }, [visibleLayers, layerData]);

  // Snapshot of layer visibility before scenario activation — used to restore on deactivate
  const preScenarioVisibility = useRef<Record<string, boolean> | null>(null);

  // Auto-set relevant layers when scenario activates; restore on deactivate
  useEffect(() => {
    if (scenarioState.active && scenarioState.scenarioType) {
      // Save current state only on first activation (not on re-renders)
      if (!preScenarioVisibility.current) {
        preScenarioVisibility.current = getVisibilitySnapshot();
      }
      const relevant = new Set(SCENARIO_LAYERS[scenarioState.scenarioType] ?? []);
      const visMap: Record<string, boolean> = {};
      for (const layer of allLayers) {
        visMap[layer.id] = relevant.has(layer.id);
      }
      setVisibilityMap(visMap);
    } else if (!scenarioState.active && preScenarioVisibility.current) {
      // Scenario deactivated — restore saved visibility
      setVisibilityMap(preScenarioVisibility.current);
      preScenarioVisibility.current = null;
    }
  }, [scenarioState.active, scenarioState.scenarioType]);

  // Auto-flyTo when scenario activates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (scenarioState.active && scenarioState.scenarioType === "toxic-cloud") {
      map.flyTo({ center: PULAWY_CENTER, zoom: 11, duration: 1500 });
    }
  }, [scenarioState.active, scenarioState.scenarioType]);

  // Auto-fitBounds for flood — fit to flood zones when they load
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (
      scenarioState.active &&
      scenarioState.scenarioType === "flood" &&
      scenarioState.zones.length > 0 &&
      !scenarioState.floodLoading
    ) {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      const extend = (lng: number, lat: number) => {
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      };
      const walk = (coords: unknown) => {
        if (!Array.isArray(coords)) return;
        if (typeof coords[0] === "number" && typeof coords[1] === "number") {
          extend(coords[0] as number, coords[1] as number);
        } else {
          for (const c of coords) walk(c);
        }
      };
      for (const zone of scenarioState.zones) {
        if ("coordinates" in zone.feature.geometry) walk(zone.feature.geometry.coordinates);
      }
      if (minLng < Infinity) {
        map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 1500 });
      }
    }
  }, [
    scenarioState.active,
    scenarioState.scenarioType,
    scenarioState.zones.length,
    scenarioState.floodLoading,
  ]);

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
      {showWelcome && (
        <WelcomeScreen
          onContinue={() => setShowWelcome(false)}
          onGuide={() => {
            setShowWelcome(false);
            tour.start();
          }}
        />
      )}

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
        onStartTour={() => tour.start()}
      />

      {/* Map area */}
      <div className="flex-1 relative" data-tour="map-area">
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

      <TourOverlay tour={tour} />

      {/* Floating tour button — bottom-left */}
      {!tour.active && !showWelcome && (
        <button
          onClick={() => tour.start()}
          className="fixed bottom-12 left-4 z-[9999] flex items-center gap-2 rounded-full bg-rose-500 hover:bg-rose-400 text-white pl-3.5 pr-4 py-2.5 text-sm font-semibold shadow-lg shadow-rose-500/30 transition-all hover:scale-105"
          title="Uruchom przewodnik po aplikacji"
        >
          <BookOpen className="w-4 h-4" />
          Przewodnik
        </button>
      )}

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
        onCivilLiveModeChange={scenarioSetCivilLiveMode}
      />
    </div>
  );
}
