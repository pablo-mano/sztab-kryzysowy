"use client";

import { AlertTriangle, Users, Building2, Loader2 } from "lucide-react";
import type { ScenarioZone } from "@/types/scenario";
import type { ScenarioImpact } from "@/hooks/useScenarioImpact";

const TYPE_LABELS: Record<string, string> = {
  hospital: "szpitale",
  school: "szkoly",
  kindergarten: "przedszkola",
  nursing_home: "domy opieki",
  social_facility: "osrodki pomocy",
  clinic: "przychodnie",
};

const ZONE_PRIORITY: Record<string, number> = {
  deep: 0, moderate: 1, warning: 2,
  lethal: 0, severe: 1, irritation: 2,
  erpg3: 0, erpg2: 1, erpg1: 2,
  q10: 0, q100: 1, q500: 2,
  cluster_high: 0, cluster_medium: 1, cluster_low: 2,
};

interface ImpactBarProps {
  zones: ScenarioZone[];
  impact: ScenarioImpact;
}

export function ImpactBar({ zones, impact }: ImpactBarProps) {
  if (zones.length === 0) return null;

  const sorted = [...zones].sort(
    (a, b) => (ZONE_PRIORITY[a.zone] ?? 9) - (ZONE_PRIORITY[b.zone] ?? 9),
  );

  const totalPeople = Object.values(impact).reduce(
    (sum, s) => sum + (s?.totalPopulation ?? 0), 0,
  );
  const totalObjects = Object.values(impact).reduce(
    (sum, s) => sum + (s?.totalObjects ?? 0), 0,
  );
  const isLoading = zones.some((z) => impact[z.zone] === undefined);

  return (
    <div className="absolute bottom-3 left-3 right-3 z-20 flex items-stretch gap-2 pointer-events-auto">
      {/* Aggregate */}
      <div className="rounded-lg border-2 border-red-500/40 bg-gray-900/90 backdrop-blur-sm px-4 py-2.5 flex items-center gap-3 shrink-0">
        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-red-300" />
              <span className="text-lg font-bold text-red-300">
                ~{totalPeople.toLocaleString("pl-PL")}
              </span>
              <span className="text-xs text-red-300/60">osob</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-red-300/70" />
              <span className="text-sm font-semibold text-red-300/70">
                {totalObjects}
              </span>
              <span className="text-xs text-red-300/50">obiektow</span>
            </div>
          </>
        )}
      </div>

      {/* Zone cards */}
      {sorted.map((zone) => {
        const stats = impact[zone.zone];
        return (
          <div
            key={zone.zone}
            className="rounded-lg border-2 bg-gray-900/90 backdrop-blur-sm px-3 py-2 flex items-center gap-3 min-w-0"
            style={{
              borderColor: `${zone.color}60`,
            }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: zone.color }}
            />
            <span className="text-xs font-semibold truncate" style={{ color: zone.color }}>
              {zone.label}
            </span>
            {stats === undefined ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: zone.color }} />
            ) : (
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: zone.color }}>
                  <Users className="w-3.5 h-3.5" />
                  ~{stats.totalPopulation.toLocaleString("pl-PL")}
                </span>
                <span className="flex items-center gap-1 text-xs" style={{ color: `${zone.color}BB` }}>
                  <Building2 className="w-3.5 h-3.5" />
                  {stats.totalObjects}
                </span>
                {Object.keys(stats.byType).length > 0 && (
                  <div className="flex gap-1">
                    {Object.entries(stats.byType)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <span
                          key={type}
                          className="text-[10px] px-1 py-0.5 rounded"
                          style={{
                            backgroundColor: `${zone.color}20`,
                            color: zone.color,
                          }}
                        >
                          {count} {TYPE_LABELS[type] ?? type}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
