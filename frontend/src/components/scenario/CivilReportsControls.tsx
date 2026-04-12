"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Clock, Camera, Mic, X, ChevronRight } from "lucide-react";
import { TIME_RANGES } from "@/lib/scenarios/civil-reports";
import { CivilAppLauncher } from "./CivilAppLauncher";
import { ReportDetailModal } from "./ReportDetailModal";
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

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "przed chwilą";
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h temu`;
  const days = Math.floor(hours / 24);
  return `${days}d temu`;
}

function getReportCategory(report: CivilReport): string | undefined {
  const p = report.properties;
  return p.category ? String(p.category) : undefined;
}

function getReportDescription(report: CivilReport): string | undefined {
  const p = report.properties;
  return p.description ? String(p.description) : p.title ? String(p.title) : undefined;
}

function getCategoryBadgeColor(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("pożar") || c.includes("fire") || c.includes("pozar")) return "bg-red-500/20 text-red-300 border-red-400/30";
  if (c.includes("powód") || c.includes("flood") || c.includes("woda")) return "bg-blue-500/20 text-blue-300 border-blue-400/30";
  if (c.includes("wypad") || c.includes("accident")) return "bg-orange-500/20 text-orange-300 border-orange-400/30";
  if (c.includes("infra") || c.includes("awaria")) return "bg-yellow-500/20 text-yellow-300 border-yellow-400/30";
  if (c.includes("medycz") || c.includes("medical")) return "bg-emerald-500/20 text-emerald-300 border-emerald-400/30";
  return "bg-zinc-500/20 text-zinc-300 border-zinc-400/30";
}

export function CivilReportsControls({
  selectedTimeRange,
  loading,
  reports,
  clusterCount,
  onTimeRangeChange,
}: CivilReportsControlsProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<CivilReport | null>(null);

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
            {recentFive.map((report) => {
              const category = getReportCategory(report);
              const description = getReportDescription(report);

              return (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className="w-full text-left flex items-start gap-2 rounded-md border border-border/50 bg-card/50 p-2 hover:bg-accent/30 hover:border-border transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    {/* Top row: time + category */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground">
                        {formatTimeAgo(report.createdAt)}
                      </span>
                      {category && (
                        <span
                          className={`text-[9px] font-semibold uppercase px-1.5 py-px rounded-full border ${getCategoryBadgeColor(category)}`}
                        >
                          {category}
                        </span>
                      )}
                    </div>

                    {/* Description preview */}
                    {description && (
                      <p className="text-[11px] text-foreground/80 truncate leading-snug">
                        {description}
                      </p>
                    )}

                    {/* Media indicators */}
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground/60 font-mono">
                        {formatTime(report.createdAt)}
                      </span>
                      {report.imageUrl && (
                        <Camera className="w-3 h-3 text-rose-400/70" />
                      )}
                      {report.audioUrl && (
                        <Mic className="w-3 h-3 text-blue-400/70" />
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground mt-1 shrink-0 transition-colors" />
                </button>
              );
            })}
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

      {/* Report detail modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onImageClick={(src) => {
            setSelectedReport(null);
            setLightboxSrc(src);
          }}
        />
      )}

      {/* Image lightbox */}
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
