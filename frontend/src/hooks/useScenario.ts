"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  generateGaussianZones,
  type ZoneResult,
} from "@/lib/scenarios/toxic-cloud";
import { fetchFloodZones, type FloodScenarioId } from "@/lib/scenarios/flood";
import {
  fetchCivilReports,
  filterByTimeRange,
  clusterReports,
  clustersToZones,
} from "@/lib/scenarios/civil-reports";
import { PULAWY_CENTER } from "@/lib/geo-utils";
import type {
  ScenarioType,
  ScenarioZone,
  CivilReport,
  SubstanceId,
  ReleaseScenarioId,
  StabilityClass,
} from "@/types/scenario";
import {
  autoStabilityClass,
  type TimeOfDay,
  type CloudCover,
} from "@/lib/scenarios/toxic-cloud";

export interface ScenarioState {
  scenarioType: ScenarioType | null;
  active: boolean;
  playing: boolean;
  hours: number;
  // Toxic cloud params
  windDirection: number;
  windSpeed: number;
  origin: [number, number];
  substanceId: SubstanceId;
  releaseScenario: ReleaseScenarioId;
  stabilityClass: StabilityClass;
  timeOfDay: TimeOfDay;
  cloudCover: CloudCover;
  stabilityOverride: boolean;
  zoneResults: ZoneResult[];
  // Flood params
  floodScenarioId: FloodScenarioId;
  floodLoading: boolean;
  // Civil reports params
  civilReports: CivilReport[];
  civilReportsLoading: boolean;
  civilTimeRange: number | null;
  // Output
  zones: ScenarioZone[];
}

const TOXIC_DEFAULTS = {
  windDirection: 270,
  windSpeed: 5,
  substanceId: "ammonia" as SubstanceId,
  releaseScenario: "large_leak" as ReleaseScenarioId,
  stabilityClass: "D" as StabilityClass,
  timeOfDay: "day" as TimeOfDay,
  cloudCover: "moderate_sun" as CloudCover,
};

export function useScenario() {
  const [scenarioType, setScenarioType] = useState<ScenarioType | null>(null);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [hours, setHours] = useState(0);
  const [windDirection, setWindDirection] = useState(TOXIC_DEFAULTS.windDirection);
  const [windSpeed, setWindSpeed] = useState(TOXIC_DEFAULTS.windSpeed);
  const [origin] = useState<[number, number]>(PULAWY_CENTER);

  // Gaussian model params
  const [substanceId, setSubstanceId] = useState<SubstanceId>(TOXIC_DEFAULTS.substanceId);
  const [releaseScenario, setReleaseScenario] = useState<ReleaseScenarioId>(TOXIC_DEFAULTS.releaseScenario);
  const [stabilityClass, setStabilityClass] = useState<StabilityClass>(TOXIC_DEFAULTS.stabilityClass);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(TOXIC_DEFAULTS.timeOfDay);
  const [cloudCover, setCloudCover] = useState<CloudCover>(TOXIC_DEFAULTS.cloudCover);
  const [stabilityOverride, setStabilityOverride] = useState(false);

  // Flood state
  const [floodScenarioId, setFloodScenarioId] = useState<FloodScenarioId>("q100");
  const [floodZones, setFloodZones] = useState<ScenarioZone[]>([]);
  const [floodLoading, setFloodLoading] = useState(false);
  const floodAbortRef = useRef<AbortController>(null);

  // Civil reports state
  const [civilReports, setCivilReports] = useState<CivilReport[]>([]);
  const [civilReportsLoading, setCivilReportsLoading] = useState(false);
  const [civilTimeRange, setCivilTimeRange] = useState<number | null>(null);
  const civilAbortRef = useRef<AbortController>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-calculate stability class when weather params change
  useEffect(() => {
    if (!stabilityOverride) {
      setStabilityClass(autoStabilityClass(windSpeed, timeOfDay, cloudCover));
    }
  }, [windSpeed, timeOfDay, cloudCover, stabilityOverride]);

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

  // Fetch civil reports when scenario is active, with 10s polling
  useEffect(() => {
    if (!active || scenarioType !== "civil-reports") {
      setCivilReports([]);
      return;
    }

    if (civilAbortRef.current) civilAbortRef.current.abort();
    const controller = new AbortController();
    civilAbortRef.current = controller;

    const doFetch = () => {
      setCivilReportsLoading(true);
      fetchCivilReports()
        .then((reports) => {
          if (!controller.signal.aborted) {
            setCivilReports(reports);
            setCivilReportsLoading(false);
          }
        })
        .catch((err) => {
          if (!controller.signal.aborted) {
            console.error("Failed to fetch civil reports:", err);
            setCivilReportsLoading(false);
          }
        });
    };

    doFetch();
    const pollInterval = setInterval(doFetch, 10000);

    return () => {
      controller.abort();
      clearInterval(pollInterval);
    };
  }, [active, scenarioType]);

  // Generate zones based on scenario type
  let zones: ScenarioZone[] = [];
  let zoneResults: ZoneResult[] = [];

  if (active && scenarioType === "toxic-cloud") {
    const result = generateGaussianZones({
      origin, windDirection, windSpeed,
      substanceId, releaseScenario, stabilityClass,
    });
    zones = result.zones;
    zoneResults = result.results;
  } else if (active && scenarioType === "flood") {
    zones = floodZones;
  } else if (active && scenarioType === "civil-reports") {
    const filtered = filterByTimeRange(civilReports, civilTimeRange);
    const clusters = clusterReports(filtered);
    zones = clustersToZones(clusters);
  }

  // Timeline config — only for toxic cloud (kept for legacy, but no longer animated)
  const maxHours = 8;
  const stepSize = 0.25;
  const playInterval = 500;

  // Play/pause animation (toxic cloud only — legacy)
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
      setSubstanceId(TOXIC_DEFAULTS.substanceId);
      setReleaseScenario(TOXIC_DEFAULTS.releaseScenario);
      setStabilityClass(TOXIC_DEFAULTS.stabilityClass);
      setTimeOfDay(TOXIC_DEFAULTS.timeOfDay);
      setCloudCover(TOXIC_DEFAULTS.cloudCover);
      setStabilityOverride(false);
      setHours(1);
    } else if (type === "flood") {
      setFloodScenarioId("q100");
    } else if (type === "civil-reports") {
      setCivilTimeRange(null);
    }
  }, []);

  const deactivate = useCallback(() => {
    setActive(false);
    setPlaying(false);
    setHours(0);
    setScenarioType(null);
    setFloodZones([]);
    setCivilReports([]);
  }, []);

  const togglePlay = useCallback(() => {
    setPlaying((p) => !p);
  }, []);

  const handleSetStabilityClass = useCallback((cls: StabilityClass) => {
    setStabilityClass(cls);
    setStabilityOverride(true);
  }, []);

  const resetStabilityAuto = useCallback(() => {
    setStabilityOverride(false);
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
      substanceId,
      releaseScenario,
      stabilityClass,
      timeOfDay,
      cloudCover,
      stabilityOverride,
      zoneResults,
      floodScenarioId,
      floodLoading,
      civilReports,
      civilReportsLoading,
      civilTimeRange,
      zones,
    } as ScenarioState,
    selectScenario,
    deactivate,
    togglePlay,
    setHours,
    setWindDirection,
    setWindSpeed,
    setSubstanceId,
    setReleaseScenario,
    setStabilityClass: handleSetStabilityClass,
    resetStabilityAuto,
    setTimeOfDay,
    setCloudCover,
    setFloodScenarioId,
    setCivilTimeRange,
    maxHours,
  };
}
