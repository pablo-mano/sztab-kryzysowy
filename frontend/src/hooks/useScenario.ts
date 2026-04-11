"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  generateToxicCloud,
  type ToxicCloudZone,
  type ToxicCloudParams,
} from "@/lib/scenarios/toxic-cloud";
import { PULAWY_CENTER } from "@/lib/geo-utils";

export interface ScenarioState {
  active: boolean;
  playing: boolean;
  hours: number;
  windDirection: number;
  windSpeed: number;
  origin: [number, number];
  zones: ToxicCloudZone[];
}

const DEFAULT_PARAMS = {
  origin: PULAWY_CENTER,
  windDirection: 270, // from West
  windSpeed: 5,
};

export function useScenario() {
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hours, setHours] = useState(0);
  const [windDirection, setWindDirection] = useState(DEFAULT_PARAMS.windDirection);
  const [windSpeed, setWindSpeed] = useState(DEFAULT_PARAMS.windSpeed);
  const [origin] = useState<[number, number]>(DEFAULT_PARAMS.origin);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const zones = active
    ? generateToxicCloud({ origin, windDirection, windSpeed, hours })
    : [];

  // Play/pause animation
  useEffect(() => {
    if (playing && active) {
      intervalRef.current = setInterval(() => {
        setHours((h) => {
          if (h >= 8) {
            setPlaying(false);
            return 8;
          }
          return Math.round((h + 0.25) * 100) / 100;
        });
      }, 500);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, active]);

  const activate = useCallback(() => {
    setActive(true);
    setHours(1);
  }, []);

  const deactivate = useCallback(() => {
    setActive(false);
    setPlaying(false);
    setHours(0);
  }, []);

  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  return {
    state: { active, playing, hours, windDirection, windSpeed, origin, zones } as ScenarioState,
    activate,
    deactivate,
    togglePlay,
    setHours,
    setWindDirection,
    setWindSpeed,
  };
}
