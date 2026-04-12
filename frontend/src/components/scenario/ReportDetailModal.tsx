"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  MapPin,
  Clock,
  Camera,
  Mic,
  FileText,
  Hash,
} from "lucide-react";
import type { CivilReport } from "@/types/scenario";

interface ReportDetailModalProps {
  report: CivilReport;
  onClose: () => void;
  onImageClick: (src: string) => void;
}

const PROPERTY_LABELS: Record<string, string> = {
  id: "ID zgłoszenia",
  created_at: "Data zgłoszenia",
  lat: "Szerokość geo.",
  lon: "Długość geo.",
  description: "Opis",
  category: "Kategoria",
  type: "Typ",
  status: "Status",
  severity: "Priorytet",
  reporter_name: "Zgłaszający",
  reporter_phone: "Telefon",
  audio_text: "Transkrypcja audio",
  address: "Adres",
  city: "Miasto",
  street: "Ulica",
  title: "Tytuł",
  notes: "Uwagi",
  source: "Źródło",
  verified: "Zweryfikowane",
  image_path: "Ścieżka zdjęcia",
  audio_path: "Ścieżka audio",
  image_url: "Zdjęcie",
  audio_url: "Nagranie audio",
};

const HIDDEN_PROPERTIES = new Set([
  "image_url",
  "audio_url",
  "image_path",
  "audio_path",
  "audio_text",
  "lat",
  "lon",
  "ingested_at",
]);

function formatPropertyLabel(key: string): string {
  return (
    PROPERTY_LABELS[key] ??
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatPropertyValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Tak" : "Nie";
  if (typeof value === "number") return value.toLocaleString("pl-PL");

  const s = String(value);

  if (key === "created_at" || key.endsWith("_at")) {
    try {
      return new Date(s).toLocaleString("pl-PL", {
        timeZone: "Europe/Warsaw",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return s;
    }
  }

  return s;
}

function getCategoryColor(category: string | undefined): string {
  if (!category) return "bg-zinc-500";
  const c = category.toLowerCase();
  if (c.includes("pożar") || c.includes("fire") || c.includes("pozar")) return "bg-red-500";
  if (c.includes("powód") || c.includes("flood") || c.includes("woda")) return "bg-blue-500";
  if (c.includes("wypad") || c.includes("accident")) return "bg-orange-500";
  if (c.includes("infra") || c.includes("awaria")) return "bg-yellow-500";
  if (c.includes("medycz") || c.includes("medical")) return "bg-emerald-500";
  return "bg-zinc-500";
}

export function ReportDetailModal({
  report,
  onClose,
  onImageClick,
}: ReportDetailModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const props = report.properties;
  const category = props.category ? String(props.category) : undefined;
  const description = props.description ? String(props.description) : undefined;
  const title = props.title ? String(props.title) : undefined;
  const status = props.status ? String(props.status) : undefined;
  const severity = props.severity ? String(props.severity) : undefined;
  const audioText = props.audio_text ? String(props.audio_text).trim() : undefined;

  // Collect remaining properties not shown in the hero section
  const heroKeys = new Set([
    "id",
    "created_at",
    "category",
    "description",
    "title",
    "status",
    "severity",
  ]);
  const extraProperties = Object.entries(props).filter(
    ([key, value]) =>
      !heroKeys.has(key) &&
      !HIDDEN_PROPERTIES.has(key) &&
      value !== null &&
      value !== undefined &&
      String(value).trim() !== "",
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm px-5 py-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-bold text-foreground">
              Szczegóły zgłoszenia
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* ID + Category badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Hash className="w-3 h-3" />
              <span className="font-mono">{report.id}</span>
            </div>
            {category && (
              <span
                className={`${getCategoryColor(category)} text-white text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full`}
              >
                {category}
              </span>
            )}
          </div>

          {/* Title */}
          {title && (
            <h3 className="text-base font-bold text-foreground leading-snug">
              {title}
            </h3>
          )}

          {/* Status + Severity row */}
          {(status || severity) && (
            <div className="flex items-center gap-2">
              {status && (
                <span className="text-xs bg-accent/50 text-foreground px-2 py-0.5 rounded-md border border-border">
                  {status}
                </span>
              )}
              {severity && (
                <span className="text-xs bg-rose-500/15 text-rose-300 px-2 py-0.5 rounded-md border border-rose-400/30">
                  {severity}
                </span>
              )}
            </div>
          )}

          {/* Description */}
          {description && (
            <div className="rounded-lg border border-border bg-accent/20 p-3">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {description}
              </p>
            </div>
          )}

          {/* Time + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">
                  Data zgłoszenia
                </div>
                <div className="text-xs font-medium text-foreground">
                  {new Date(report.createdAt).toLocaleString("pl-PL", {
                    timeZone: "Europe/Warsaw",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <div className="text-[10px] text-muted-foreground uppercase">
                  Lokalizacja
                </div>
                <div className="text-xs font-medium text-foreground">
                  {report.lat.toFixed(5)}, {report.lon.toFixed(5)}
                </div>
              </div>
            </div>
          </div>

          {/* Image */}
          {report.imageUrl && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase font-medium">
                  Zdjęcie
                </span>
              </div>
              <img
                src={report.imageUrl}
                alt="Zdjęcie zgłoszenia"
                className="w-full rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity object-cover max-h-64"
                onClick={() => onImageClick(report.imageUrl!)}
              />
            </div>
          )}

          {/* Audio */}
          {report.audioUrl && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Mic className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase font-medium">
                  Nagranie audio
                </span>
              </div>
              <audio
                controls
                src={report.audioUrl}
                className="w-full h-10 rounded-lg"
              />
            </div>
          )}

          {/* Audio transcription */}
          {audioText && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Mic className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase font-medium">
                  Transkrypcja audio
                </span>
              </div>
              <div className="rounded-lg border border-border bg-accent/20 p-3">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {audioText}
                </p>
              </div>
            </div>
          )}

          {/* Extra properties table */}
          {extraProperties.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider mb-1.5">
                Pozostałe dane
              </div>
              <div className="rounded-lg border border-border divide-y divide-border">
                {extraProperties.map(([key, value]) => (
                  <div
                    key={key}
                    className="flex justify-between gap-3 px-3 py-2 text-xs"
                  >
                    <span className="text-muted-foreground shrink-0">
                      {formatPropertyLabel(key)}
                    </span>
                    <span className="font-medium text-foreground text-right break-words max-w-[60%]">
                      {formatPropertyValue(key, value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
