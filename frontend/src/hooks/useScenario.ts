"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  generateToxicCloud,
  toxicCloudToScenarioZones,
} from "@/lib/scenarios/toxic-cloud";
import { generateFloodZones } from "@/lib/scenarios/flood";
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
  waterLevel: number;
  rainfallIntensity: number;
  // Output
  zones: ScenarioZone[];
}

const TOXIC_DEFAULTS = {
  windDirection: 270,
  windSpeed: 5,
};

const FLOOD_DEFAULTS = {
  waterLevel: 5,
  rainfallIntensity: 20,
};

export function useScenario() {
  const [scenarioType, setScenarioType] = useState<ScenarioType | null>(null);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hours, setHours] = useState(0);
  const [windDirection, setWindDirection] = useState(TOXIC_DEFAULTS.windDirection);
  const [windSpeed, setWindSpeed] = useState(TOXIC_DEFAULTS.windSpeed);
  const [origin] = useState<[number, number]>(PULAWY_CENTER);
  const [waterLevel, setWaterLevel] = useState(FLOOD_DEFAULTS.waterLevel);
  const [rainfallIntensity, setRainfallIntensity] = useState(FLOOD_DEFAULTS.rainfallIntensity);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate zones based on scenario type
  const zones: ScenarioZone[] = (() => {
    if (!active || !scenarioType) return [];

    if (scenarioType === "toxic-cloud") {
      const raw = generateToxicCloud({ origin, windDirection, windSpeed, hours });
      return toxicCloudToScenarioZones(raw);
    }

    if (scenarioType === "flood") {
      return generateFloodZones({ waterLevel, rainfallIntensity, hours });
    }

    return [];
  })();

  // Timeline config per scenario
  const maxHours = scenarioType === "flood" ? 72 : 8;
  const stepSize = scenarioType === "flood" ? 1 : 0.25;
  const playInterval = scenarioType === "flood" ? 300 : 500;

  // Play/pause animation
  useEffect(() => {
    if (playing && active) {
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
  }, [playing, active, maxHours, stepSize, playInterval]);

  const selectScenario = useCallback((type: ScenarioType) => {
    setScenarioType(type);
    setActive(true);
    setPlaying(false);
    if (type === "toxic-cloud") {
      setWindDirection(TOXIC_DEFAULTS.windDirection);
      setWindSpeed(TOXIC_DEFAULTS.windSpeed);
      setHours(1);
    } else {
      setWaterLevel(FLOOD_DEFAULTS.waterLevel);
      setRainfallIntensity(FLOOD_DEFAULTS.rainfallIntensity);
      setHours(6);
    }
  }, []);

  const deactivate = useCallback(() => {
    setActive(false);
    setPlaying(false);
    setHours(0);
    setScenarioType(null);
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
      waterLevel,
      rainfallIntensity,
      zones,
    } as ScenarioState,
    selectScenario,
    deactivate,
    togglePlay,
    setHours,
    setWindDirection,
    setWindSpeed,
    setWaterLevel,
    setRainfallIntensity,
    maxHours,
  };
}
