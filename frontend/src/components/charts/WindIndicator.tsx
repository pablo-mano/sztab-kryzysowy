"use client";

import { Navigation } from "lucide-react";

interface WindIndicatorProps {
  direction: number; // degrees, 0 = N, 90 = E
  speed: number; // m/s
  label?: string;
}

function degToCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

export function WindIndicator({
  direction,
  speed,
  label = "Wiatr",
}: WindIndicatorProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
      <div
        className="w-10 h-10 rounded-full border border-border flex items-center justify-center"
        title={`${direction}° (${degToCompass(direction)})`}
      >
        <Navigation
          className="w-5 h-5 text-sky-400"
          style={{ transform: `rotate(${direction}deg)` }}
        />
      </div>
      <div className="space-y-0.5">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold tabular-nums">
            {speed.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">m/s</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {degToCompass(direction)} ({direction}°)
        </span>
      </div>
    </div>
  );
}
