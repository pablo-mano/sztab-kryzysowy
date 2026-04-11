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
  zoom?: number | null,
) {
  const layer = getLayer(layerId);
  const refreshInterval = layer?.source.cacheTTL;
  const isH3 = layer?.source.h3;

  // Build URL with optional region filter and zoom
  let url = `/api/layers/${layerId}`;
  const params = new URLSearchParams();
  if (regionFilter) {
    params.set("region", regionFilter.name);
    params.set("regionLevel", regionFilter.level);
  }
  if (isH3 && zoom != null) {
    params.set("zoom", String(Math.round(zoom)));
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
