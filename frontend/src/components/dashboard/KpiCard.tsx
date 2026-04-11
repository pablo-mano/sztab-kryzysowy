"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { KpiConfig } from "@/types/dashboard";

const trendIcons = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
} as const;

const trendColors = {
  up: "text-emerald-400",
  down: "text-red-400",
  stable: "text-muted-foreground",
} as const;

export function KpiCard({ label, value, color, trend, trendValue }: KpiConfig) {
  const TrendIcon = trend ? trendIcons[trend] : null;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1">
      <div className="flex items-center gap-2">
        {color && (
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="text-xs text-muted-foreground uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-xl font-semibold tabular-nums">{value}</span>
        {TrendIcon && trend && (
          <div className={`flex items-center gap-1 text-xs ${trendColors[trend]}`}>
            <TrendIcon className="w-3 h-3" />
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
