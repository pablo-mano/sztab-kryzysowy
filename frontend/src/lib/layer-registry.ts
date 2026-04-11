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
