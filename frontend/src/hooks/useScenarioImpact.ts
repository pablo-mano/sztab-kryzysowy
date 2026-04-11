"use client";

import { useEffect, useRef, useState } from "react";
import type { ScenarioZone } from "@/types/scenario";

export interface ScenarioZoneStats {
  totalObjects: number;
  totalPopulation: number;
  byType: Record<string, number>;
}

export type ScenarioImpact = Record<string, ScenarioZoneStats | undefined>;

async function fetchZoneImpact(zone: ScenarioZone, scenarioType?: string): Promise<ScenarioZoneStats> {
  const res = await fetch("/api/scenario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      zoneGeoJson: JSON.stringify(zone.feature.geometry),
      zone: zone.zone,
      scenarioType,
    }),
  });
  if (!res.ok) throw new Error(`Scenario API error: ${res.status}`);
  const data = await res.json();
  return data.stats as ScenarioZoneStats;
}

/** Stable fingerprint of zones array to avoid re-triggering on same geometry */
function zonesKey(zones: ScenarioZone[]): string {
  if (zones.length === 0) return "";
  return zones.map((z) => z.zone).join(",") + ":" +
    zones.map((z) => {
      const coords = z.feature.geometry.coordinates;
      // Use first few coordinates as fingerprint
      const first = coords[0]?.slice(0, 3);
      return JSON.stringify(first);
    }).join("|");
}

/**
 * Fetches impact statistics for each scenario zone.
 * Debounces requests by 500ms to avoid flooding during animation.
 */
export function useScenarioImpact(zones: ScenarioZone[], scenarioType?: string): ScenarioImpact {
  const [impact, setImpact] = useState<ScenarioImpact>({});
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController>(null);

  // Stable key based on zone geometry — avoids infinite loop from unstable zones array reference
  const key = zonesKey(zones);
  const zonesRef = useRef(zones);
  zonesRef.current = zones;

  useEffect(() => {
    const zones = zonesRef.current;
    if (zones.length === 0) {
      setImpact({});
      return;
    }

    // Debounce — wait 500ms after last zone change
    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    timerRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;

      Promise.all(
        zones.map(async (zone) => {
          try {
            const stats = await fetchZoneImpact(zone, scenarioType);
            return [zone.zone, stats] as const;
          } catch {
            return [zone.zone, undefined] as const;
          }
        }),
      ).then((results) => {
        if (controller.signal.aborted) return;
        const map: ScenarioImpact = {};
        for (const [key, value] of results) {
          map[key] = value;
        }
        setImpact(map);
      });
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return impact;
}
