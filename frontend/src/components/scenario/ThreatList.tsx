"use client";

import { useState } from "react";
import { AlertTriangle, Users, Building2, Loader2, ChevronDown } from "lucide-react";
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

/** Priority order: deep first (most critical), then moderate, then warning */
const ZONE_PRIORITY: Record<string, number> = {
  deep: 0,
  moderate: 1,
  warning: 2,
  // toxic cloud zones
  lethal: 0,
  severe: 1,
  irritation: 2,
};

function formatTypeBreakdown(byType: Record<string, number>): { label: string; count: number }[] {
  return Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => ({ label: TYPE_LABELS[type] ?? type, count }));
}

export function ThreatList({ zones, impact }: ThreatListProps) {
  const [expandedSecondary, setExpandedSecondary] = useState(false);

  if (zones.length === 0) return null;

  // Sort zones by priority — most critical first
  const sorted = [...zones].sort(
    (a, b) => (ZONE_PRIORITY[a.zone] ?? 9) - (ZONE_PRIORITY[b.zone] ?? 9),
  );

  const primaryZone = sorted[0];
  const secondaryZones = sorted.slice(1);
  const primaryStats = impact[primaryZone.zone];

  // Aggregate totals across all zones
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
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
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

      {/* Primary zone — expanded, prominent */}
      <div
        className="rounded-lg border-2 p-3"
        style={{
          backgroundColor: `${primaryZone.color}15`,
          borderColor: `${primaryZone.color}60`,
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: primaryZone.color }}
          />
          <span className="text-sm font-bold" style={{ color: primaryZone.color }}>
            {primaryZone.label}
          </span>
        </div>
        <p className="text-xs opacity-70 mb-2" style={{ color: primaryZone.color }}>
          {primaryZone.description}
        </p>

        {primaryStats === undefined ? (
          <div className="flex items-center gap-1.5 text-xs opacity-60" style={{ color: primaryZone.color }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Obliczanie...
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-4 text-sm" style={{ color: primaryZone.color }}>
              <span className="flex items-center gap-1 font-semibold">
                <Users className="w-4 h-4" />
                ~{primaryStats.totalPopulation.toLocaleString("pl-PL")} osob
              </span>
              <span className="flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {primaryStats.totalObjects} obiektow
              </span>
            </div>
            {Object.keys(primaryStats.byType).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {formatTypeBreakdown(primaryStats.byType).map(({ label, count }) => (
                  <span
                    key={label}
                    className="text-[11px] px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${primaryZone.color}20`,
                      color: primaryZone.color,
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

      {/* Secondary zones — collapsed by default */}
      {secondaryZones.length > 0 && (
        <div>
          <button
            onClick={() => setExpandedSecondary(!expandedSecondary)}
            className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <span className="uppercase tracking-wider font-medium">
              Pozostale strefy ({secondaryZones.length})
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${expandedSecondary ? "rotate-180" : ""}`}
            />
          </button>

          {expandedSecondary && (
            <div className="space-y-1.5 mt-1">
              {secondaryZones.map((zone) => {
                const stats = impact[zone.zone];
                return (
                  <div
                    key={zone.zone}
                    className="rounded-md border p-2"
                    style={{
                      backgroundColor: `${zone.color}10`,
                      borderColor: `${zone.color}30`,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: zone.color }}
                        />
                        <span className="text-xs font-medium" style={{ color: zone.color }}>
                          {zone.label}
                        </span>
                      </div>
                      {stats && (
                        <span className="text-[11px] opacity-70" style={{ color: zone.color }}>
                          ~{stats.totalPopulation.toLocaleString("pl-PL")} osob / {stats.totalObjects} obj.
                        </span>
                      )}
                      {stats === undefined && (
                        <Loader2 className="w-3 h-3 animate-spin opacity-40" style={{ color: zone.color }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
