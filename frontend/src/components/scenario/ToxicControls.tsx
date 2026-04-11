"use client";

import { AlertTriangle, Wind, Sun, Moon, Cloud } from "lucide-react";
import { WindIndicator } from "@/components/charts/WindIndicator";
import { Slider } from "@/components/ui/slider";
import {
  SUBSTANCES,
  RELEASE_SCENARIOS,
  STABILITY_CLASSES,
  getReleaseRate,
  timeToArrival,
  type CloudCover,
  type TimeOfDay,
} from "@/lib/scenarios/toxic-cloud";
import type { ZoneResult } from "@/lib/scenarios/toxic-cloud";
import type { SubstanceId, ReleaseScenarioId, StabilityClass } from "@/types/scenario";

interface ToxicControlsProps {
  substanceId: SubstanceId;
  releaseScenario: ReleaseScenarioId;
  windDirection: number;
  windSpeed: number;
  stabilityClass: StabilityClass;
  timeOfDay: TimeOfDay;
  cloudCover: CloudCover;
  stabilityOverride: boolean;
  zoneResults: ZoneResult[];
  onSubstanceChange: (id: SubstanceId) => void;
  onReleaseChange: (id: ReleaseScenarioId) => void;
  onWindDirectionChange: (deg: number) => void;
  onWindSpeedChange: (speed: number) => void;
  onStabilityChange: (cls: StabilityClass) => void;
  onStabilityReset: () => void;
  onTimeOfDayChange: (t: TimeOfDay) => void;
  onCloudCoverChange: (c: CloudCover) => void;
}

const SUBSTANCE_LIST = Object.values(SUBSTANCES);
const CLOUD_COVER_OPTIONS: { id: CloudCover; label: string }[] = [
  { id: "strong_sun", label: "Silne" },
  { id: "moderate_sun", label: "Umiarkowane" },
  { id: "weak_sun", label: "Słabe" },
  { id: "cloudy", label: "Zachmurzenie" },
];

export function ToxicControls({
  substanceId,
  releaseScenario,
  windDirection,
  windSpeed,
  stabilityClass,
  timeOfDay,
  cloudCover,
  stabilityOverride,
  zoneResults,
  onSubstanceChange,
  onReleaseChange,
  onWindDirectionChange,
  onWindSpeedChange,
  onStabilityChange,
  onStabilityReset,
  onTimeOfDayChange,
  onCloudCoverChange,
}: ToxicControlsProps) {
  const release = getReleaseRate(substanceId, releaseScenario);

  return (
    <div className="space-y-3">
      {/* Substance selector */}
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Substancja
        </div>
        {SUBSTANCE_LIST.map((sub) => {
          const isSelected = sub.id === substanceId;
          return (
            <button
              key={sub.id}
              onClick={() => onSubstanceChange(sub.id)}
              className={`w-full text-left rounded-lg border-2 p-2 transition-colors ${
                isSelected
                  ? "border-red-400/60 bg-red-500/10"
                  : "border-border bg-card hover:border-border/80 hover:bg-accent/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${isSelected ? "text-red-300" : "text-muted-foreground"}`}>
                  {sub.name} ({sub.formula})
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {sub.densityRatio < 1 ? "lżejszy" : "cięższy"} od powietrza
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Release scenario */}
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Skala uwolnienia
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {RELEASE_SCENARIOS.map((sc) => {
            const isSelected = sc.id === releaseScenario;
            const rate = getReleaseRate(substanceId, sc.id);
            return (
              <button
                key={sc.id}
                onClick={() => onReleaseChange(sc.id)}
                className={`text-left rounded-lg border-2 p-2 transition-colors ${
                  isSelected
                    ? "border-orange-400/60 bg-orange-500/10"
                    : "border-border bg-card hover:border-border/80 hover:bg-accent/50"
                }`}
              >
                <div className={`text-[11px] font-semibold ${isSelected ? "text-orange-300" : "text-muted-foreground"}`}>
                  {sc.name}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {rate.rateKgS} kg/s, {Math.round(rate.durationS / 60)} min
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wind controls */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Warunki meteorologiczne
        </div>
        <WindIndicator direction={windDirection} speed={windSpeed} />
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Kierunek wiatru</span>
            <span>{windDirection}°</span>
          </div>
          <Slider
            value={[windDirection]}
            min={0}
            max={359}
            step={5}
            onValueChange={(val) => onWindDirectionChange(Array.isArray(val) ? val[0] : val)}
          />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Prędkość wiatru</span>
            <span>{windSpeed} m/s</span>
          </div>
          <Slider
            value={[windSpeed * 10]}
            min={5}
            max={150}
            step={5}
            onValueChange={(val) => onWindSpeedChange((Array.isArray(val) ? val[0] : val) / 10)}
          />
          {windSpeed < 1 && (
            <p className="text-[10px] text-amber-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Przy wietrze &lt;1 m/s model jest niepewny
            </p>
          )}
        </div>

        {/* Time of day + cloud cover */}
        <div className="flex gap-2">
          <button
            onClick={() => onTimeOfDayChange(timeOfDay === "day" ? "night" : "day")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border-2 p-1.5 text-[11px] font-medium transition-colors ${
              timeOfDay === "day"
                ? "border-yellow-400/40 bg-yellow-500/10 text-yellow-300"
                : "border-indigo-400/40 bg-indigo-500/10 text-indigo-300"
            }`}
          >
            {timeOfDay === "day" ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
            {timeOfDay === "day" ? "Dzień" : "Noc"}
          </button>
          <div className="flex-1">
            <select
              value={cloudCover}
              onChange={(e) => onCloudCoverChange(e.target.value as CloudCover)}
              className="w-full rounded-lg border-2 border-border bg-card p-1.5 text-[11px] text-muted-foreground"
              disabled={timeOfDay === "night"}
            >
              {CLOUD_COVER_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stability class */}
        <div className="flex items-center gap-2">
          <Cloud className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">Klasa stabilności:</span>
          <span className={`text-[11px] font-bold ${stabilityOverride ? "text-cyan-300" : "text-foreground"}`}>
            {stabilityClass} — {STABILITY_CLASSES[stabilityClass].name}
          </span>
          {stabilityOverride && (
            <button
              onClick={onStabilityReset}
              className="text-[10px] text-cyan-400 hover:text-cyan-300 underline"
            >
              auto
            </button>
          )}
        </div>
        <div className="flex gap-0.5">
          {(Object.keys(STABILITY_CLASSES) as StabilityClass[]).map((cls) => (
            <button
              key={cls}
              onClick={() => onStabilityChange(cls)}
              className={`flex-1 rounded py-0.5 text-[10px] font-bold transition-colors ${
                cls === stabilityClass
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40"
                  : "bg-card text-muted-foreground hover:bg-accent/50 border border-border"
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      </div>

      {/* Zone results table */}
      {zoneResults.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Zasięg stref
          </div>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-muted/30 text-muted-foreground">
                  <th className="text-left p-1.5 font-medium">Strefa</th>
                  <th className="text-right p-1.5 font-medium">Próg</th>
                  <th className="text-right p-1.5 font-medium">Zasięg</th>
                  <th className="text-right p-1.5 font-medium">Czas</th>
                </tr>
              </thead>
              <tbody>
                {zoneResults.map((r) => (
                  <tr key={r.level} className="border-t border-border/50">
                    <td className="p-1.5">
                      <span className="inline-block w-2 h-2 rounded-full mr-1" style={{
                        backgroundColor: r.level === "erpg3" ? "#DC2626" : r.level === "erpg2" ? "#F59E0B" : "#3B82F6"
                      }} />
                      {r.level.toUpperCase()}
                    </td>
                    <td className="text-right p-1.5 text-muted-foreground font-mono">
                      {r.thresholdPpm} ppm
                    </td>
                    <td className="text-right p-1.5 font-mono font-semibold">
                      {r.distanceM >= 1000
                        ? `${(r.distanceM / 1000).toFixed(1)} km`
                        : `${Math.round(r.distanceM)} m`}
                    </td>
                    <td className="text-right p-1.5 text-muted-foreground font-mono">
                      {timeToArrival(r.distanceM, windSpeed).toFixed(0)} min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            Emisja: {release.rateKgS} kg/s przez {Math.round(release.durationS / 60)} min
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[10px] text-amber-200/80 leading-relaxed space-y-1">
            <p className="font-semibold text-amber-300">
              Narzędzie poglądowe — nie do decyzji ewakuacyjnych
            </p>
            <p>
              Wyniki oparte na uproszczonym modelu Gaussowskim (Turner 1970).
              Profesjonalne szacowanie wymaga: ALOHA/PHAST, danych IMGW,
              topografii terenu, raportu Seveso III.
            </p>
            <p>
              W razie awarii: <span className="font-bold text-amber-300">112</span> / 998 (PSP) / 999 (Pogotowie)
            </p>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        Model: Gaussian Plume (ciągłe źródło, poziom gruntu).
        Progi: ERPG (AIHA). Współczynniki dyspersji: Turner/EPA.
      </p>
    </div>
  );
}
