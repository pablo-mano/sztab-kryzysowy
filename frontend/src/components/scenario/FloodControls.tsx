"use client";

import { Droplets, CloudRain } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface FloodControlsProps {
  waterLevel: number;
  rainfallIntensity: number;
  onWaterLevelChange: (level: number) => void;
  onRainfallIntensityChange: (intensity: number) => void;
}

export function FloodControls({
  waterLevel,
  rainfallIntensity,
  onWaterLevelChange,
  onRainfallIntensityChange,
}: FloodControlsProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Droplets className="w-3 h-3" />
            Poziom wody
          </span>
          <span>{waterLevel} m</span>
        </div>
        <Slider
          value={[waterLevel]}
          min={1}
          max={15}
          step={0.5}
          onValueChange={(val) => onWaterLevelChange(Array.isArray(val) ? val[0] : val)}
        />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <CloudRain className="w-3 h-3" />
            Intensywność opadów
          </span>
          <span>{rainfallIntensity} mm/h</span>
        </div>
        <Slider
          value={[rainfallIntensity]}
          min={5}
          max={100}
          step={5}
          onValueChange={(val) => onRainfallIntensityChange(Array.isArray(val) ? val[0] : val)}
        />
      </div>
    </div>
  );
}
