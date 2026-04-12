"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";

export type BBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

export interface RegionOption {
  name: string;
  level: string;
  teryt: string;
  bbox: BBox;
}

const fetcher = (url: string) =>
  fetch(url)
    .then((r) => r.json())
    .then((d: { regions: RegionOption[] }) => d.regions);

export function useRegions() {
  const { data: regions, isLoading } = useSWR("/api/regions", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const byLevel = useMemo(() => {
    if (!regions) return { wojewodztwo: [], powiat: [], gmina: [] };
    const woj: RegionOption[] = [];
    const pow: RegionOption[] = [];
    const gm: RegionOption[] = [];
    for (const r of regions) {
      if (r.level === "wojewodztwo") woj.push(r);
      else if (r.level === "powiat") pow.push(r);
      else if (r.level === "gmina") gm.push(r);
    }
    return { wojewodztwo: woj, powiat: pow, gmina: gm };
  }, [regions]);

  const getWojewodztwa = useCallback(() => byLevel.wojewodztwo, [byLevel]);

  const getPowiaty = useCallback(
    (wojTeryt: string) =>
      byLevel.powiat.filter((r) => r.teryt.startsWith(wojTeryt)),
    [byLevel],
  );

  const getGminy = useCallback(
    (powiatTeryt: string) =>
      byLevel.gmina.filter((r) => r.teryt.startsWith(powiatTeryt)),
    [byLevel],
  );

  const findByName = useCallback(
    (name: string, level: string) =>
      regions?.find((r) => r.name === name && r.level === level),
    [regions],
  );

  return {
    regions,
    isLoading,
    getWojewodztwa,
    getPowiaty,
    getGminy,
    findByName,
  };
}
