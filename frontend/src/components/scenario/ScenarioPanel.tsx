"use client";

import { AlertTriangle, Power, PowerOff, Flame, Droplets } from "lucide-react";
import { TimelineSlider } from "./TimelineSlider";
import { ThreatList } from "./ThreatList";
import { FloodControls } from "./FloodControls";
import { WindIndicator } from "@/components/charts/WindIndicator";
import { Slider } from "@/components/ui/slider";
import type { ScenarioState } from "@/hooks/useScenario";
import type { ScenarioImpact } from "@/hooks/useScenarioImpact";
import type { ScenarioType } from "@/types/scenario";

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
  onWaterLevelChange: (level: number) => void;
  onRainfallIntensityChange: (intensity: number) => void;
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
  onWaterLevelChange,
  onRainfallIntensityChange,
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
            <Power className="w-4 h-4" />
            Aktywuj scenariusz
          </button>
        </div>

        {/* Flood scenario card */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Droplets className="w-4 h-4 text-blue-400" />
            <span className="font-medium">Powódź — Dolina Wisły</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Symulacja zalewu doliny Wisły w województwie lubelskim.
            Analiza zagrożonych obiektów i priorytetyzacja ewakuacji szpitali.
          </p>
          <button
            onClick={() => onSelectScenario("flood")}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-blue-500/10 border border-blue-500/30 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <Power className="w-4 h-4" />
            Aktywuj scenariusz
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
          {isToxic ? "Pożar przemysłowy" : "Powódź — Wisła"}
        </h3>
        <button
          onClick={onDeactivate}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Dezaktywuj"
        >
          <PowerOff className="w-4 h-4" />
        </button>
      </div>

      <TimelineSlider
        hours={state.hours}
        maxHours={maxHours}
        playing={state.playing}
        onHoursChange={onHoursChange}
        onTogglePlay={onTogglePlay}
        onReset={() => onHoursChange(0)}
      />

      {/* Scenario-specific controls */}
      {isToxic && (
        <>
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

      {isFlood && (
        <FloodControls
          waterLevel={state.waterLevel}
          rainfallIntensity={state.rainfallIntensity}
          onWaterLevelChange={onWaterLevelChange}
          onRainfallIntensityChange={onRainfallIntensityChange}
        />
      )}

      <ThreatList zones={state.zones} impact={impact} />
    </div>
  );
}
