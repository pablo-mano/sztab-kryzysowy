"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
  description?: string;
}

const trendConfig = {
  up: { icon: TrendingUp, color: "text-emerald-400" },
  down: { icon: TrendingDown, color: "text-red-400" },
  stable: { icon: Minus, color: "text-muted-foreground" },
} as const;

export function StatCard({
  label,
  value,
  unit,
  trend,
  trendValue,
  description,
}: StatCardProps) {
  const TrendIcon = trend ? trendConfig[trend].icon : null;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {(trend || description) && (
        <div className="flex items-center gap-2">
          {TrendIcon && trend && (
            <div className={`flex items-center gap-1 text-xs ${trendConfig[trend].color}`}>
              <TrendIcon className="w-3.5 h-3.5" />
              {trendValue && <span>{trendValue}</span>}
            </div>
          )}
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}
