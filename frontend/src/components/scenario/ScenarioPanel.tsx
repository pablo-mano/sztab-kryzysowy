"use client";

import { Play, ArrowLeft, Flame, Droplets } from "lucide-react";
import { TimelineSlider } from "./TimelineSlider";
import { ThreatList } from "./ThreatList";
import { FloodControls } from "./FloodControls";
import { WindIndicator } from "@/components/charts/WindIndicator";
import { Slider } from "@/components/ui/slider";
import type { ScenarioState } from "@/hooks/useScenario";
import type { ScenarioImpact } from "@/hooks/useScenarioImpact";
import type { ScenarioType } from "@/types/scenario";
import type { FloodScenarioId } from "@/lib/scenarios/flood";

interface ScenarioPanelProps {
  state: ScenarioState;
  impact: ScenarioImpact;
  maxHours: number;
  onSelectScenario: (type: ScenarioType) => void;
  onDeactivate: () => void;
  onTogglePlay: () => void;
  onHoursChange: (hours: number) => void;
  onWindDirectionChange: (deg: number) => void;
  onWindSpeedChange: (speed: number) => void;
  onFloodScenarioChange: (id: FloodScenarioId) => void;
}

export function ScenarioPanel({
  state,
  impact,
  maxHours,
  onSelectScenario,
  onDeactivate,
  onTogglePlay,
  onHoursChange,
  onWindDirectionChange,
  onWindSpeedChange,
  onFloodScenarioChange,
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
            Symulacja wycieku substancji toksycznych z Zakładów Azotowych Puławy.
            Modelowanie rozprzestrzeniania chmury w oparciu o parametry wiatru.
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
      </div>
    );
  }

  const isToxic = state.scenarioType === "toxic-cloud";
  const isFlood = state.scenarioType === "flood";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className={`text-xs font-medium uppercase tracking-wider flex items-center gap-1.5 ${isToxic ? "text-red-400" : "text-blue-400"}`}>
          {isToxic ? <Flame className="w-3.5 h-3.5" /> : <Droplets className="w-3.5 h-3.5" />}
          {isToxic ? "Pożar przemysłowy" : "Powódź — strefy ISOK"}
        </h3>
        <button
          onClick={onDeactivate}
          className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-accent text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Powrót
        </button>
      </div>

      {/* Toxic cloud: timeline + wind controls */}
      {isToxic && (
        <>
          <TimelineSlider
            hours={state.hours}
            maxHours={maxHours}
            playing={state.playing}
            onHoursChange={onHoursChange}
            onTogglePlay={onTogglePlay}
            onReset={() => onHoursChange(0)}
          />
          <WindIndicator
            direction={state.windDirection}
            speed={state.windSpeed}
          />
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Kierunek wiatru</span>
                <span>{state.windDirection}°</span>
              </div>
              <Slider
                value={[state.windDirection]}
                min={0}
                max={359}
                step={5}
                onValueChange={(val) => onWindDirectionChange(Array.isArray(val) ? val[0] : val)}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Prędkość wiatru</span>
                <span>{state.windSpeed} m/s</span>
              </div>
              <Slider
                value={[state.windSpeed * 10]}
                min={5}
                max={200}
                step={5}
                onValueChange={(val) => onWindSpeedChange((Array.isArray(val) ? val[0] : val) / 10)}
              />
            </div>
          </div>
        </>
      )}

      {/* Flood: ISOK scenario selector */}
      {isFlood && (
        <FloodControls
          selectedScenario={state.floodScenarioId}
          loading={state.floodLoading}
          onScenarioChange={onFloodScenarioChange}
        />
      )}

      <ThreatList zones={state.zones} impact={impact} />

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
    </div>
  );
}
