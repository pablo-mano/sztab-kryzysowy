"use client";

import { useState, useCallback } from "react";
import type { LayerState } from "@/types/layer";
import { getAllLayers, getDefaultVisibleLayers } from "@/lib/layer-registry";

export function useLayers() {
  const allLayers = getAllLayers();
  const defaultVisible = getDefaultVisibleLayers();

  const [layerStates, setLayerStates] = useState<Record<string, LayerState>>(
    () => {
      const initial: Record<string, LayerState> = {};
      for (const layer of allLayers) {
        initial[layer.id] = {
          visible: defaultVisible.includes(layer.id),
          opacity: 1,
        };
      }
      return initial;
    },
  );

  const toggleLayer = useCallback((id: string) => {
    setLayerStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], visible: !prev[id]?.visible },
    }));
  }, []);

  const setOpacity = useCallback((id: string, opacity: number) => {
    setLayerStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], opacity },
    }));
  }, []);

  const isVisible = useCallback(
    (id: string) => layerStates[id]?.visible ?? false,
    [layerStates],
  );

  const getOpacity = useCallback(
    (id: string) => layerStates[id]?.opacity ?? 1,
    [layerStates],
  );

  return {
    allLayers,
    layerStates,
    toggleLayer,
    setOpacity,
    isVisible,
    getOpacity,
  };
}
