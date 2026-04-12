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
      <div className="rounded-lg border-2 border-red-500/40 bg-gray-900/90 backdrop-blur-sm px-4 py-3 flex flex-col justify-center gap-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">
            Osoby zagrozone
          </span>
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Obliczanie...</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-red-300" />
              <span className="text-xl font-bold text-red-300">
                ~{totalPeople.toLocaleString("pl-PL")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-red-300/70" />
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
            className="rounded-lg border-2 bg-gray-900/90 backdrop-blur-sm px-3 py-2.5 flex flex-col gap-1 min-w-0 flex-1"
            style={{ borderColor: `${zone.color}60` }}
          >
            {/* Line 1: zone name */}
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: zone.color }}
              />
              <span className="text-xs font-semibold truncate" style={{ color: zone.color }}>
                {zone.label}
              </span>
            </div>

            {stats === undefined ? (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: zone.color }}>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Obliczanie...
              </div>
            ) : (
              <>
                {/* Line 2: people count */}
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" style={{ color: zone.color }} />
                  <span className="text-sm font-bold" style={{ color: zone.color }}>
                    ~{stats.totalPopulation.toLocaleString("pl-PL")} osob
                  </span>
                  <span className="text-xs ml-1" style={{ color: `${zone.color}AA` }}>
                    <Building2 className="w-3 h-3 inline mr-0.5" />
                    {stats.totalObjects} obiektow
                  </span>
                </div>

                {/* Line 3: facility breakdown */}
                {Object.keys(stats.byType).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(stats.byType)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count]) => (
                        <span
                          key={type}
                          className="text-[10px] px-1.5 py-0.5 rounded"
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
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
