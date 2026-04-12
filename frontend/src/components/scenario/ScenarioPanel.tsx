"use client";

import { Play, Flame, Droplets, Shield } from "lucide-react";

import { FloodControls } from "./FloodControls";
import { ToxicControls } from "./ToxicControls";
import { CivilReportsControls } from "./CivilReportsControls";
import { filterByTimeRange, clusterReports } from "@/lib/scenarios/civil-reports";
import type { ScenarioState } from "@/hooks/useScenario";

import type { ScenarioType } from "@/types/scenario";
import type { SubstanceId, ReleaseScenarioId, StabilityClass } from "@/types/scenario";
import type { FloodScenarioId } from "@/lib/scenarios/flood";
import type { TimeOfDay, CloudCover } from "@/lib/scenarios/toxic-cloud";

interface ScenarioPanelProps {
  state: ScenarioState;
  maxHours: number;
  onSelectScenario: (type: ScenarioType) => void;
  onDeactivate: () => void;
  onTogglePlay: () => void;
  onHoursChange: (hours: number) => void;
  onWindDirectionChange: (deg: number) => void;
  onWindSpeedChange: (speed: number) => void;
  onSubstanceChange: (id: SubstanceId) => void;
  onReleaseChange: (id: ReleaseScenarioId) => void;
  onStabilityChange: (cls: StabilityClass) => void;
  onStabilityReset: () => void;
  onTimeOfDayChange: (t: TimeOfDay) => void;
  onCloudCoverChange: (c: CloudCover) => void;
  onFloodScenarioChange: (id: FloodScenarioId) => void;
  floodFilterActive: boolean;
  onFloodFilterToggle: (active: boolean) => void;
  onCivilTimeRangeChange: (minutes: number | null) => void;
}

export function ScenarioPanel({
  state,
  onSelectScenario,
  onDeactivate,
  onWindDirectionChange,
  onWindSpeedChange,
  onSubstanceChange,
  onReleaseChange,
  onStabilityChange,
  onStabilityReset,
  onTimeOfDayChange,
  onCloudCoverChange,
  onFloodScenarioChange,
  floodFilterActive,
  onFloodFilterToggle,
  onCivilTimeRangeChange,
}: ScenarioPanelProps) {
  if (!state.active) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Scenariusz kryzysowy
        </h3>

        {/* Toxic cloud scenario card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="font-medium">Pożar przemysłowy — Puławy</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Model Gaussowski dyspersji chmury toksycznej z Zakładów Azotowych Puławy.
            4 substancje, klasy stabilności Pasquilla-Gifforda, progi ERPG.
          </p>
          <button
            onClick={() => onSelectScenario("toxic-cloud")}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
          >
            <Play className="w-4 h-4" />
            Odtwórz scenariusz
          </button>
        </div>

        {/* Flood scenario card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Droplets className="w-4 h-4 text-blue-400" />
            <span className="font-medium">Powódź — Dolina Wisły</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Oficjalne strefy zagrożenia powodziowego ISOK.
            Scenariusze Q 10%, Q 1%, Q 0,2% dla woj. lubelskiego.
          </p>
          <button
            onClick={() => onSelectScenario("flood")}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-blue-500/10 border border-blue-500/30 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <Play className="w-4 h-4" />
            Odtwórz scenariusz
          </button>
        </div>

        {/* Civil reports scenario card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-rose-400" />
            <span className="font-medium">Zgłoszenia cywilne — Incydent masowy</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Masowe zgłoszenia bezpieczeństwa z aplikacji mobilnej.
            Klasteryzacja ognisk, analiza zagrożonych obiektów w czasie rzeczywistym.
          </p>
          <button
            onClick={() => onSelectScenario("civil-reports")}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/20 transition-colors"
          >
            <Play className="w-4 h-4" />
            Odtwórz scenariusz
          </button>
        </div>
      </div>
    );
  }

  const isToxic = state.scenarioType === "toxic-cloud";
  const isFlood = state.scenarioType === "flood";
  const isCivilReports = state.scenarioType === "civil-reports";

  return (
    <div className="space-y-4">
      <h3 className={`text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 ${
        isToxic ? "text-red-400" : isFlood ? "text-blue-400" : "text-rose-400"
      }`}>
        {isToxic ? <Flame className="w-3.5 h-3.5" /> : isFlood ? <Droplets className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
        {isToxic ? "Chmura toksyczna — Puławy" : isFlood ? "Powódź — strefy ISOK" : "Zgłoszenia cywilne — Na żywo"}
      </h3>

      {/* Toxic cloud: Gaussian model controls */}
      {isToxic && (
        <ToxicControls
          substanceId={state.substanceId}
          releaseScenario={state.releaseScenario}
          windDirection={state.windDirection}
          windSpeed={state.windSpeed}
          stabilityClass={state.stabilityClass}
          timeOfDay={state.timeOfDay}
          cloudCover={state.cloudCover}
          stabilityOverride={state.stabilityOverride}
          zoneResults={state.zoneResults}
          onSubstanceChange={onSubstanceChange}
          onReleaseChange={onReleaseChange}
          onWindDirectionChange={onWindDirectionChange}
          onWindSpeedChange={onWindSpeedChange}
          onStabilityChange={onStabilityChange}
          onStabilityReset={onStabilityReset}
          onTimeOfDayChange={onTimeOfDayChange}
          onCloudCoverChange={onCloudCoverChange}
        />
      )}

      {/* Flood: ISOK scenario selector */}
      {isFlood && (
        <FloodControls
          selectedScenario={state.floodScenarioId}
          loading={state.floodLoading}
          onScenarioChange={onFloodScenarioChange}
          filterActive={floodFilterActive}
          onFilterToggle={onFloodFilterToggle}
        />
      )}

      {/* Civil reports controls */}
      {isCivilReports && (() => {
        const filtered = filterByTimeRange(state.civilReports, state.civilTimeRange);
        const clusters = clusterReports(filtered);
        return (
          <CivilReportsControls
            selectedTimeRange={state.civilTimeRange}
            loading={state.civilReportsLoading}
            reports={filtered}
            clusterCount={clusters.length}
            onTimeRangeChange={onCivilTimeRangeChange}
          />
        );
      })()}

      {/* Data sources block — flood only */}
      {isFlood && state.zones.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Źródła danych
          </div>
          <ul className="text-[11px] text-muted-foreground/80 space-y-1.5 leading-relaxed">
            <li>
              <span className="font-medium text-muted-foreground">Strefy zalewowe</span> — Mapy
              Zagrożenia Powodziowego ISOK, scenariusze Q&nbsp;10%, Q&nbsp;1%, Q&nbsp;0,2%
              (PGW Wody Polskie / KZGW)
            </li>
            <li>
              <span className="font-medium text-muted-foreground">Wodowskazy</span> — dane
              pomiarowe IMGW-PIB, aktualizowane co&nbsp;1h
              z&nbsp;API danepubliczne.imgw.pl
            </li>
            <li>
              <span className="font-medium text-muted-foreground">Przebieg rzek</span> — geometrie
              OpenStreetMap (Overpass API), 200–900 punktów/rzeka
            </li>
            <li>
              <span className="font-medium text-muted-foreground">Obiekty wrażliwe</span> — szpitale,
              szkoły, DPS z&nbsp;OpenStreetMap; populacja szacunkowa
            </li>
            <li>
              <span className="font-medium text-muted-foreground">Granice adm.</span> — GUGiK PRG
              (TERYT), poligony woj./powiat/gmina
            </li>
          </ul>
        </div>
      )}
      {/* Data sources block — civil reports */}
      {isCivilReports && state.zones.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Źródła danych
          </div>
          <ul className="text-[11px] text-muted-foreground/80 space-y-1.5 leading-relaxed">
            <li>
              <span className="font-medium text-muted-foreground">Zgłoszenia</span> — aplikacja
              mobilna CIVIL42, dane obywatelskie w&nbsp;czasie rzeczywistym
            </li>
            <li>
              <span className="font-medium text-muted-foreground">Klasteryzacja</span> — grupowanie
              przestrzenne (promień&nbsp;1&nbsp;km), identyfikacja ognisk incydentu
            </li>
            <li>
              <span className="font-medium text-muted-foreground">Obiekty wrażliwe</span> — szpitale,
              szkoły, DPS z&nbsp;OpenStreetMap; populacja szacunkowa
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
