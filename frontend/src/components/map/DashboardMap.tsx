"use client";

import { useRef, useCallback, useState, useMemo } from "react";
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
import { LUBLIN_CENTER, LUBELSKIE_BOUNDS } from "@/lib/geo-utils";
import type { LayerConfig } from "@/types/layer";
import { GeoJsonLayer } from "./GeoJsonLayer";
import { FeaturePopup } from "./FeaturePopup";
import type { GeoFeature, GeoFeatureCollection } from "@/types/feature";
import type { ScenarioZone } from "@/types/scenario";

interface DashboardMapProps {
  visibleLayers: LayerConfig[];
  layerData: Record<string, GeoFeatureCollection | undefined>;
  layerOpacity: Record<string, number>;
  scenarioZones?: ScenarioZone[];
  mapRef?: React.RefObject<MapRef | null>;
  onZoomChange?: (zoom: number) => void;
}

const MAP_STYLE = "https://tiles.openfreemap.org/styles/dark";

export function DashboardMap({
  visibleLayers,
  layerData,
  layerOpacity,
  scenarioZones = [],
  mapRef: externalMapRef,
  onZoomChange,
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
    () =>
      visibleLayers
        .filter((l) => l.interactive && layerData[l.id])
        .map((l) => l.id),
    [visibleLayers, layerData],
  );

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!e.features?.length) return;

      const clickedFeature = e.features[0];
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

  const handleZoomEnd = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (map && onZoomChange) {
      onZoomChange(Math.round(map.getZoom()));
    }
  }, [onZoomChange]);

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: LUBLIN_CENTER[0],
        latitude: LUBLIN_CENTER[1],
        zoom: 8,
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
      onZoomEnd={handleZoomEnd}
    >
      <NavigationControl position="top-right" />
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

      {/* Scenario zones (toxic cloud / flood) */}
      {scenarioZones.map((zone) => (
        <Source
          key={`scenario-${zone.zone}`}
          id={`scenario-${zone.zone}`}
          type="geojson"
          data={zone.feature}
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
      ))}

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
