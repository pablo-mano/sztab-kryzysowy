"use client";

import { Play, Pause, RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface TimelineSliderProps {
  hours: number;
  playing: boolean;
  onHoursChange: (hours: number) => void;
  onTogglePlay: () => void;
  onReset: () => void;
}

export function TimelineSlider({
  hours,
  playing,
  onHoursChange,
  onTogglePlay,
  onReset,
}: TimelineSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Czas symulacji
        </span>
        <span className="text-sm font-mono tabular-nums">
          {hours.toFixed(1)}h / 8h
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onTogglePlay}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title={playing ? "Pauza" : "Odtwórz"}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <Slider
          value={[hours * 100]}
          min={0}
          max={800}
          step={25}
          onValueChange={(val) => onHoursChange((Array.isArray(val) ? val[0] : val) / 100)}
          className="flex-1"
        />

        <button
          onClick={onReset}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Reset"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Time marks */}
      <div className="flex justify-between text-[10px] text-muted-foreground px-8">
        {[0, 2, 4, 6, 8].map((h) => (
          <span key={h}>{h}h</span>
        ))}
      </div>
    </div>
  );
}
