import type { LayerConfig, LayerRegistry } from "@/types/layer";
import registryData from "../../layer-registry.json";

const registry = registryData as LayerRegistry;

export function getAllLayers(): LayerConfig[] {
  return registry.layers;
}

export function getLayer(id: string): LayerConfig | undefined {
  return registry.layers.find((l) => l.id === id);
}

export function getLayersByGroup(): Record<string, LayerConfig[]> {
  const groups: Record<string, LayerConfig[]> = {};
  for (const layer of registry.layers) {
    if (!groups[layer.group]) groups[layer.group] = [];
    groups[layer.group].push(layer);
  }
  return groups;
}

export function getDefaultVisibleLayers(): string[] {
  return registry.layers
    .filter((l) => l.defaultVisible)
    .map((l) => l.id);
}

export type MapMode = "points" | "h3";

const H3_GROUPS = new Set(["Analityka H3"]);
const SHARED_GROUPS = new Set(["Administracja"]);

export function getLayerMode(layer: LayerConfig): MapMode | "both" {
  if (SHARED_GROUPS.has(layer.group)) return "both";
  if (H3_GROUPS.has(layer.group)) return "h3";
  return "points";
}

export function isLayerInMode(layer: LayerConfig, mode: MapMode): boolean {
  const layerMode = getLayerMode(layer);
  return layerMode === "both" || layerMode === mode;
}
