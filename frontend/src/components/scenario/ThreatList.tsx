"use client";

import { AlertTriangle } from "lucide-react";
import type { ToxicCloudZone } from "@/lib/scenarios/toxic-cloud";

interface ThreatListProps {
  zones: ToxicCloudZone[];
}

const zoneColors = {
  red: "bg-red-500/20 text-red-400 border-red-500/30",
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
} as const;

const zoneBadgeColors = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
} as const;

export function ThreatList({ zones }: ThreatListProps) {
  if (zones.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        Strefy zagrożenia
      </h4>

      <div className="space-y-1.5">
        {zones.map((zone) => (
          <div
            key={zone.zone}
            className={`rounded-md border p-2.5 ${zoneColors[zone.zone]}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${zoneBadgeColors[zone.zone]}`} />
              <span className="text-xs font-medium">{zone.label}</span>
            </div>
            <p className="text-[11px] opacity-80">{zone.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
