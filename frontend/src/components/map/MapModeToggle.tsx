"use client";

import { MapPin, Hexagon } from "lucide-react";
import type { MapMode } from "@/lib/layer-registry";

interface MapModeToggleProps {
  mode: MapMode;
  onChange: (mode: MapMode) => void;
}

export function MapModeToggle({ mode, onChange }: MapModeToggleProps) {
  return (
    <div className="absolute top-3 right-14 z-10 flex rounded-lg border border-border bg-card shadow-lg overflow-hidden">
      <button
        onClick={() => onChange("points")}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === "points"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
      >
        <MapPin className="w-3.5 h-3.5" />
        Punkty
      </button>
      <button
        onClick={() => onChange("h3")}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === "h3"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-accent"
        }`}
      >
        <Hexagon className="w-3.5 h-3.5" />
        Analityka H3
      </button>
    </div>
  );
}
