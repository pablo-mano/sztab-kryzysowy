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

function formatTypeBreakdown(byType: Record<string, number>): string {
  return Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => `${count} ${TYPE_LABELS[type] ?? type}`)
    .join(", ");
}

export function ThreatList({ zones, impact }: ThreatListProps) {
  if (zones.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        Strefy zagrozenia
      </h4>

      <div className="space-y-1.5">
        {zones.map((zone) => {
          const stats = impact[zone.zone];

          return (
            <div
              key={zone.zone}
              className="rounded-md border p-2.5"
              style={{
                backgroundColor: `${zone.color}20`,
                borderColor: `${zone.color}50`,
                color: zone.color,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: zone.color }}
                />
                <span className="text-xs font-medium">{zone.label}</span>
              </div>
              <p className="text-[11px] opacity-80">{zone.description}</p>

              {/* Impact statistics */}
              {stats === undefined ? (
                <div className="flex items-center gap-1.5 mt-2 text-[11px] opacity-60">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Obliczanie...</span>
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      ~{stats.totalPopulation.toLocaleString("pl-PL")} osob
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {stats.totalObjects} obiektow
                    </span>
                  </div>
                  {Object.keys(stats.byType).length > 0 && (
                    <p className="text-[10px] opacity-70 leading-relaxed">
                      {formatTypeBreakdown(stats.byType)}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
