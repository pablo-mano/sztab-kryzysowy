"use client";

import useSWR from "swr";
import type { GeoFeatureCollection } from "@/types/feature";
import { getLayer } from "@/lib/layer-registry";

export interface RegionFilter {
  name: string;
  level: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useLayerData(
  layerId: string,
  enabled = true,
  regionFilter?: RegionFilter | null,
) {
  const layer = getLayer(layerId);
  const refreshInterval = layer?.source.cacheTTL;

  // Build URL with optional region filter
  let url = `/api/layers/${layerId}`;
  const params = new URLSearchParams();
  if (regionFilter) {
    params.set("region", regionFilter.name);
    params.set("regionLevel", regionFilter.level);
  }
  const qs = params.toString();
  if (qs) url += `?${qs}`;

  const { data, error, isLoading, mutate } = useSWR<GeoFeatureCollection>(
    enabled ? url : null,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
      dedupingInterval: Math.min(refreshInterval ?? 60000, 10000),
    },
  );

  return {
    data,
    error,
    isLoading,
    refresh: mutate,
  };
}
