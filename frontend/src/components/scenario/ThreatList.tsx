"use client";

import { AlertTriangle, Users, Building2, Loader2 } from "lucide-react";
import type { ScenarioZone } from "@/types/scenario";
import type { ScenarioImpact } from "@/hooks/useScenarioImpact";

interface ThreatListProps {
  zones: ScenarioZone[];
  impact: ScenarioImpact;
}

const TYPE_LABELS: Record<string, string> = {
  hospital: "szpitale",
  school: "szkoly",
  kindergarten: "przedszkola",
  nursing_home: "domy opieki",
  social_facility: "osrodki pomocy",
  clinic: "przychodnie",
};

/** Priority order: most critical first */
const ZONE_PRIORITY: Record<string, number> = {
  deep: 0,
  moderate: 1,
  warning: 2,
  lethal: 0,
  severe: 1,
  irritation: 2,
  q10: 0,
  q100: 1,
  q500: 2,
};

function formatTypeBreakdown(byType: Record<string, number>): { label: string; count: number }[] {
  return Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => ({ label: TYPE_LABELS[type] ?? type, count }));
}

function ZoneCard({ zone, stats }: { zone: ScenarioZone; stats: ScenarioImpact[string] }) {
  return (
    <div
      className="rounded-lg border-2 p-3"
      style={{
        backgroundColor: `${zone.color}15`,
        borderColor: `${zone.color}60`,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: zone.color }}
        />
        <span className="text-sm font-bold" style={{ color: zone.color }}>
          {zone.label}
        </span>
      </div>
      <p className="text-xs opacity-70 mb-2" style={{ color: zone.color }}>
        {zone.description}
      </p>

      {stats === undefined ? (
        <div className="flex items-center gap-1.5 text-xs opacity-60" style={{ color: zone.color }}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Obliczanie...
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-4 text-sm" style={{ color: zone.color }}>
            <span className="flex items-center gap-1 font-semibold">
              <Users className="w-4 h-4" />
              ~{stats.totalPopulation.toLocaleString("pl-PL")} osob
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              {stats.totalObjects} obiektow
            </span>
          </div>
          {Object.keys(stats.byType).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {formatTypeBreakdown(stats.byType).map(({ label, count }) => (
                <span
                  key={label}
                  className="text-[11px] px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${zone.color}20`,
                    color: zone.color,
                  }}
                >
                  {count} {label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ThreatList({ zones, impact }: ThreatListProps) {
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
    <div className="space-y-3">
      {/* Aggregate impact banner */}
      <div className="rounded-lg border-2 border-red-500/30 bg-red-500/10 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
            Osoby zagrozone
          </span>
        </div>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Obliczanie...
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Users className="w-5 h-5 text-red-300" />
              <span className="text-2xl font-bold text-red-300">
                ~{totalPeople.toLocaleString("pl-PL")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-5 h-5 text-red-300/70" />
              <span className="text-lg font-semibold text-red-300/70">
                {totalObjects}
              </span>
              <span className="text-xs text-red-300/50">obiektow</span>
            </div>
          </div>
        )}
      </div>

      {/* All zone cards — same size, sorted by priority */}
      {sorted.map((zone) => (
        <ZoneCard key={zone.zone} zone={zone} stats={impact[zone.zone]} />
      ))}
    </div>
  );
}
