"use client";

import useSWR from "swr";
import type { GeoFeatureCollection } from "@/types/feature";
import { getLayer } from "@/lib/layer-registry";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useLayerData(layerId: string, enabled = true) {
  const layer = getLayer(layerId);
  const refreshInterval = layer?.source.cacheTTL;

  const { data, error, isLoading, mutate } = useSWR<GeoFeatureCollection>(
    enabled ? `/api/layers/${layerId}` : null,
    fetcher,
    {
      refreshInterval,
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    },
  );

  return {
    data,
    error,
    isLoading,
    refresh: mutate,
  };
}
