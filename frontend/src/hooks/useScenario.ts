"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  generateToxicCloud,
  toxicCloudToScenarioZones,
} from "@/lib/scenarios/toxic-cloud";
import { fetchFloodZones, type FloodScenarioId } from "@/lib/scenarios/flood";
import { PULAWY_CENTER } from "@/lib/geo-utils";
import type { ScenarioType, ScenarioZone } from "@/types/scenario";

export interface ScenarioState {
  scenarioType: ScenarioType | null;
  active: boolean;
  playing: boolean;
  hours: number;
  // Toxic cloud params
  windDirection: number;
  windSpeed: number;
  origin: [number, number];
  // Flood params
  floodScenarioId: FloodScenarioId;
  floodLoading: boolean;
  // Output
  zones: ScenarioZone[];
}

const TOXIC_DEFAULTS = {
  windDirection: 270,
  windSpeed: 5,
};

export function useScenario() {
  const [scenarioType, setScenarioType] = useState<ScenarioType | null>(null);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hours, setHours] = useState(0);
  const [windDirection, setWindDirection] = useState(TOXIC_DEFAULTS.windDirection);
  const [windSpeed, setWindSpeed] = useState(TOXIC_DEFAULTS.windSpeed);
  const [origin] = useState<[number, number]>(PULAWY_CENTER);

  // Flood state
  const [floodScenarioId, setFloodScenarioId] = useState<FloodScenarioId>("q100");
  const [floodZones, setFloodZones] = useState<ScenarioZone[]>([]);
  const [floodLoading, setFloodLoading] = useState(false);
  const floodAbortRef = useRef<AbortController>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch flood zones when scenario or ID changes
  useEffect(() => {
    if (!active || scenarioType !== "flood") {
      setFloodZones([]);
      return;
    }

    if (floodAbortRef.current) floodAbortRef.current.abort();
    const controller = new AbortController();
    floodAbortRef.current = controller;

    setFloodLoading(true);
    fetchFloodZones(floodScenarioId)
      .then((zones) => {
        if (!controller.signal.aborted) {
          setFloodZones(zones);
          setFloodLoading(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.error("Failed to fetch flood zones:", err);
          setFloodZones([]);
          setFloodLoading(false);
        }
      });

    return () => controller.abort();
  }, [active, scenarioType, floodScenarioId]);

  // Generate zones based on scenario type
  const zones: ScenarioZone[] = (() => {
    if (!active || !scenarioType) return [];

    if (scenarioType === "toxic-cloud") {
      const raw = generateToxicCloud({ origin, windDirection, windSpeed, hours });
      return toxicCloudToScenarioZones(raw);
    }

    if (scenarioType === "flood") {
      return floodZones;
    }

    return [];
  })();

  // Timeline config — only for toxic cloud
  const maxHours = 8;
  const stepSize = 0.25;
  const playInterval = 500;

  // Play/pause animation (toxic cloud only)
  useEffect(() => {
    if (playing && active && scenarioType === "toxic-cloud") {
      intervalRef.current = setInterval(() => {
        setHours((h) => {
          if (h >= maxHours) {
            setPlaying(false);
            return maxHours;
          }
          return Math.round((h + stepSize) * 100) / 100;
        });
      }, playInterval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, active, scenarioType]);

  const selectScenario = useCallback((type: ScenarioType) => {
    setScenarioType(type);
    setActive(true);
    setPlaying(false);
    if (type === "toxic-cloud") {
      setWindDirection(TOXIC_DEFAULTS.windDirection);
      setWindSpeed(TOXIC_DEFAULTS.windSpeed);
      setHours(1);
    } else {
      setFloodScenarioId("q100");
    }
  }, []);

  const deactivate = useCallback(() => {
    setActive(false);
    setPlaying(false);
    setHours(0);
    setScenarioType(null);
    setFloodZones([]);
  }, []);

  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  return {
    state: {
      scenarioType,
      active,
      playing,
      hours,
      windDirection,
      windSpeed,
      origin,
      floodScenarioId,
      floodLoading,
      zones,
    } as ScenarioState,
    selectScenario,
    deactivate,
    togglePlay,
    setHours,
    setWindDirection,
    setWindSpeed,
    setFloodScenarioId,
    maxHours,
  };
}
