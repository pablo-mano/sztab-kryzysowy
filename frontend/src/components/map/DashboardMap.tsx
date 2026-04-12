"use client";

import { useRef, useCallback, useState, useMemo, type CSSProperties } from "react";
import {
  Map,
  NavigationControl,
  ScaleControl,
  Source,
  Layer,
  type MapRef,
  type MapLayerMouseEvent,
} from "@vis.gl/react-maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  LUBLIN_CENTER,
  LUBELSKIE_BOUNDS,
  ALL_RIVERS,
} from "@/lib/geo-utils";
import type { LayerConfig } from "@/types/layer";
import { GeoJsonLayer } from "./GeoJsonLayer";
import { FeaturePopup } from "./FeaturePopup";
import type { GeoFeature, GeoFeatureCollection } from "@/types/feature";
import type { ScenarioZone, ScenarioType } from "@/types/scenario";

const fitBtnContainerStyle: CSSProperties = {
  position: "absolute",
  top: 120,
  right: 10,
  zIndex: 1,
};

const fitBtnStyle: CSSProperties = {
  width: 29,
  height: 29,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#fff",
  border: "none",
  borderRadius: 4,
  boxShadow: "0 0 0 2px rgba(0,0,0,.1)",
  cursor: "pointer",
  color: "#333",
};

interface DashboardMapProps {
  visibleLayers: LayerConfig[];
  layerData: Record<string, GeoFeatureCollection | undefined>;
  layerOpacity: Record<string, number>;
  scenarioZones?: ScenarioZone[];
  scenarioType?: ScenarioType | null;
  highlightedRegion?: GeoFeature | null;
  mapRef?: React.RefObject<MapRef | null>;
}

const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

export function DashboardMap({
  visibleLayers,
  layerData,
  layerOpacity,
  scenarioZones = [],
  scenarioType,
  highlightedRegion,
  mapRef: externalMapRef,
}: DashboardMapProps) {
  const internalMapRef = useRef<MapRef>(null);
  const mapRef = externalMapRef ?? internalMapRef;
  const [popupFeature, setPopupFeature] = useState<{
    feature: GeoFeature;
    layerId: string;
    lngLat: [number, number];
  } | null>(null);

  // Collect interactive layer IDs for click handling
  const interactiveLayerIds = useMemo(
    () => [
      ...visibleLayers
        .filter((l) => l.interactive && layerData[l.id])
        .map((l) => l.id),
      ...scenarioZones.map((z) => `scenario-fill-${z.zone}`),
    ],
    [visibleLayers, layerData, scenarioZones],
  );

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!e.features?.length) return;

      // Prioritise points/circles over lines over polygons (fill/fill-extrusion)
      const priorityOf = (f: (typeof e.features)[number]) => {
        const t = f.layer?.type;
        if (t === "circle" || t === "symbol") return 0;
        if (t === "line") return 1;
        return 2; // fill, fill-extrusion, scenario zones
      };
      const sorted = [...e.features].sort((a, b) => priorityOf(a) - priorityOf(b));

      const clickedFeature = sorted[0];
      const layerId = clickedFeature.layer?.id;
      if (!layerId) return;

      const feature = {
        type: "Feature" as const,
        geometry: clickedFeature.geometry,
        properties: clickedFeature.properties ?? {},
      } as GeoFeature;

      setPopupFeature({
        feature,
        layerId,
        lngLat: [e.lngLat.lng, e.lngLat.lat],
      });
    },
    [],
  );

  const handleMouseEnter = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = "pointer";
  }, []);

  const handleMouseLeave = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map) map.getCanvas().style.cursor = "";
  }, []);

  const handleClosePopup = useCallback(() => {
    setPopupFeature(null);
  }, []);

  const handleFitAll = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    let hasData = false;

    const extend = (lng: number, lat: number) => {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
      hasData = true;
    };

    const processCoords = (coords: unknown) => {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0] === "number" && typeof coords[1] === "number") {
        extend(coords[0] as number, coords[1] as number);
      } else {
        for (const c of coords) processCoords(c);
      }
    };

    // Visible layer data
    for (const layer of visibleLayers) {
      const data = layerData[layer.id];
      if (!data?.features) continue;
      for (const f of data.features) {
        if ("coordinates" in f.geometry) processCoords(f.geometry.coordinates);
      }
    }

    // Scenario zones
    for (const zone of scenarioZones) {
      if ("coordinates" in zone.feature.geometry) processCoords(zone.feature.geometry.coordinates);
    }

    if (!hasData) {
      // Fall back to default view
      map.flyTo({ center: LUBLIN_CENTER, zoom: 7.5, duration: 800 });
      return;
    }

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 60, duration: 800 },
    );
  }, [visibleLayers, layerData, scenarioZones]);

  // River lines rendered when flood or toxic scenario is active (not civil-reports)
  const riverGeoJson = useMemo(() => {
    if (scenarioZones.length === 0 || scenarioType === "civil-reports") return null;
    return {
      type: "FeatureCollection" as const,
      features: Object.values(ALL_RIVERS).map((r) => ({
        type: "Feature" as const,
        properties: { name: r.name },
        geometry: { type: "LineString" as const, coordinates: r.coords },
      })),
    };
  }, [scenarioZones.length]);

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: LUBLIN_CENTER[0],
        latitude: LUBLIN_CENTER[1],
        zoom: 7.5,
        pitch: 0,
        bearing: 0,
      }}
      maxBounds={[
        [LUBELSKIE_BOUNDS[0][0] - 1, LUBELSKIE_BOUNDS[0][1] - 0.5],
        [LUBELSKIE_BOUNDS[1][0] + 1, LUBELSKIE_BOUNDS[1][1] + 0.5],
      ]}
      style={{ width: "100%", height: "100%" }}
      mapStyle={MAP_STYLE}
      interactiveLayerIds={interactiveLayerIds}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <NavigationControl position="top-right" />
      {/* Fit-all-visible button — sits below NavigationControl */}
      <div style={fitBtnContainerStyle}>
        <button
          onClick={handleFitAll}
          style={fitBtnStyle}
          title="Dopasuj widok do wszystkich elementów"
          aria-label="Dopasuj widok do wszystkich elementów"
        >
          {/* expand-arrows icon */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>
      <ScaleControl position="bottom-left" />

      {visibleLayers.map((layer) => {
        const data = layerData[layer.id];
        if (!data) return null;

        return (
          <GeoJsonLayer
            key={layer.id}
            layerConfig={layer}
            data={data}
            opacity={layerOpacity[layer.id] ?? 1}
          />
        );
      })}

      {/* Highlighted region overlay */}
      {highlightedRegion && (
        <Source id="highlight-region" type="geojson" data={highlightedRegion}>
          <Layer
            id="highlight-region-fill"
            type="fill"
            paint={{
              "fill-color": "#60a5fa",
              "fill-opacity": 0.2,
            }}
          />
          <Layer
            id="highlight-region-line"
            type="line"
            paint={{
              "line-color": "#60a5fa",
              "line-width": 3,
              "line-opacity": 0.9,
            }}
          />
          <Layer
            id="highlight-region-glow"
            type="line"
            paint={{
              "line-color": "#93c5fd",
              "line-width": 8,
              "line-opacity": 0.3,
              "line-blur": 4,
            }}
          />
        </Source>
      )}

      {/* River lines — visible when a scenario is active */}
      {riverGeoJson && (
        <Source id="rivers-line" type="geojson" data={riverGeoJson}>
          <Layer
            id="rivers-line-glow"
            type="line"
            paint={{
              "line-color": "#60a5fa",
              "line-width": 6,
              "line-opacity": 0.3,
              "line-blur": 3,
            }}
          />
          <Layer
            id="rivers-line-main"
            type="line"
            paint={{
              "line-color": "#93c5fd",
              "line-width": 2.5,
              "line-opacity": 0.9,
            }}
          />
        </Source>
      )}

      {/* Scenario zones (toxic cloud / flood / civil reports) */}
      {scenarioZones.map((zone) => {
        const featureWithProps = {
          ...zone.feature,
          properties: {
            ...zone.feature.properties,
            _zone_label: zone.label,
            _zone_description: zone.description,
            _zone_color: zone.color,
          },
        };
        return (
        <Source
          key={`scenario-${zone.zone}`}
          id={`scenario-${zone.zone}`}
          type="geojson"
          data={featureWithProps}
        >
          <Layer
            id={`scenario-fill-${zone.zone}`}
            type="fill"
            paint={{
              "fill-color": zone.color,
              "fill-opacity": zone.opacity,
            }}
          />
          <Layer
            id={`scenario-line-${zone.zone}`}
            type="line"
            paint={{
              "line-color": zone.color,
              "line-width": 2,
              "line-dasharray": [2, 2],
              "line-opacity": 0.6,
            }}
          />
        </Source>
        );
      })}

      {popupFeature && (
        <FeaturePopup
          feature={popupFeature.feature}
          layerId={popupFeature.layerId}
          lngLat={popupFeature.lngLat}
          onClose={handleClosePopup}
        />
      )}
    </Map>
  );
}
