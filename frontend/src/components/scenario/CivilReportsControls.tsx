"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Clock, Camera, X } from "lucide-react";
import { TIME_RANGES } from "@/lib/scenarios/civil-reports";
import { CivilAppLauncher } from "./CivilAppLauncher";
import type { CivilReport } from "@/types/scenario";

interface CivilReportsControlsProps {
  selectedTimeRange: number | null;
  loading: boolean;
  reports: CivilReport[];
  clusterCount: number;
  onTimeRangeChange: (minutes: number | null) => void;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export function CivilReportsControls({
  selectedTimeRange,
  loading,
  reports,
  clusterCount,
  onTimeRangeChange,
}: CivilReportsControlsProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const newest = reports.length > 0
    ? [...reports].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];
  const recentFive = newest.slice(0, 5);

  return (
    <div className="space-y-3">
      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </span>
        <span className="text-xs font-medium text-green-400">Na żywo</span>
        {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
      </div>

      {/* Time range selector */}
      <div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
          Zakres czasu
        </div>
        <div className="flex gap-1.5">
          {TIME_RANGES.map((range) => {
            const isSelected = range.minutes === selectedTimeRange;
            return (
              <button
                key={range.id}
                onClick={() => onTimeRangeChange(range.minutes)}
                className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? "border-rose-400/60 bg-rose-500/15 text-rose-300"
                    : "border-border bg-card text-muted-foreground hover:bg-accent/50"
                }`}
              >
                {range.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-card p-2 text-center">
          <div className="text-lg font-bold text-rose-300">{reports.length}</div>
          <div className="text-[10px] text-muted-foreground">zgłoszeń</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-2 text-center">
          <div className="text-lg font-bold text-orange-300">{clusterCount}</div>
          <div className="text-[10px] text-muted-foreground">ognisk</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-2 text-center">
          <div className="text-lg font-bold text-yellow-300">
            {newest.length > 0 ? formatTime(newest[0].createdAt).split(",")[0] : "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">ostatnie</div>
        </div>
      </div>

      {/* Recent reports list */}
      {recentFive.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Ostatnie zgłoszenia
          </div>
          <div className="space-y-1.5">
            {recentFive.map((report) => (
              <div
                key={report.id}
                className="flex items-center gap-2 rounded-md border border-border/50 bg-card/50 p-2"
              >
                <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground flex-1">
                  {formatTime(report.createdAt)}
                </span>
                {report.imageUrl && (
                  <button
                    onClick={() => setLightboxSrc(report.imageUrl!)}
                    className="text-rose-400 hover:text-rose-300 transition-colors"
                    title="Podgląd zdjęcia"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {reports.length === 0 && !loading && (
        <div className="text-xs text-muted-foreground/60 text-center py-3">
          Brak zgłoszeń w wybranym okresie
        </div>
      )}

      <CivilAppLauncher />

      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        Dane z niezweryfikowanych zgłoszeń cywilnych via aplikację mobilną CIVIL42.
        Wymagają potwierdzenia przez służby.
      </p>

      {lightboxSrc && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
        >
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxSrc}
            alt="Podgląd zgłoszenia"
            className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body,
      )}
    </div>
  );
}
