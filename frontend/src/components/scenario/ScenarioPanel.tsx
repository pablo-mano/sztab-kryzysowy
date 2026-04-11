"use client";

import { AlertTriangle, Power, PowerOff } from "lucide-react";
import { TimelineSlider } from "./TimelineSlider";
import { ThreatList } from "./ThreatList";
import { WindIndicator } from "@/components/charts/WindIndicator";
import { Slider } from "@/components/ui/slider";
import type { ScenarioState } from "@/hooks/useScenario";

interface ScenarioPanelProps {
  state: ScenarioState;
  onActivate: () => void;
  onDeactivate: () => void;
  onTogglePlay: () => void;
  onHoursChange: (hours: number) => void;
  onWindDirectionChange: (deg: number) => void;
  onWindSpeedChange: (speed: number) => void;
}

export function ScenarioPanel({
  state,
  onActivate,
  onDeactivate,
  onTogglePlay,
  onHoursChange,
  onWindDirectionChange,
  onWindSpeedChange,
}: ScenarioPanelProps) {
  if (!state.active) {
    return (
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Scenariusz kryzysowy
        </h3>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="font-medium">Pożar przemysłowy — Puławy</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Symulacja wycieku substancji toksycznych z Zakładów Azotowych Puławy.
            Modelowanie rozprzestrzeniania chmury w oparciu o parametry wiatru.
          </p>
          <button
            onClick={onActivate}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
          >
            <Power className="w-4 h-4" />
            Aktywuj scenariusz
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" />
          Scenariusz aktywny
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
        playing={state.playing}
        onHoursChange={onHoursChange}
        onTogglePlay={onTogglePlay}
        onReset={() => onHoursChange(0)}
      />

      <WindIndicator
        direction={state.windDirection}
        speed={state.windSpeed}
      />

      {/* Wind controls */}
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

      <ThreatList zones={state.zones} />
    </div>
  );
}
