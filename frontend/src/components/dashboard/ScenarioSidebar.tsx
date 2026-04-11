"use client";

import { useState } from "react";
import { AlertTriangle, PanelRightClose, PanelRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScenarioPanel } from "@/components/scenario/ScenarioPanel";
import type { ScenarioState } from "@/hooks/useScenario";
import type { ScenarioImpact } from "@/hooks/useScenarioImpact";
import type { ScenarioType } from "@/types/scenario";

interface ScenarioSidebarProps {
  scenario: ScenarioState;
  scenarioImpact: ScenarioImpact;
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

export function ScenarioSidebar({
  scenario,
  scenarioImpact,
  maxHours,
  onSelectScenario,
  onDeactivate,
  onTogglePlay,
  onHoursChange,
  onWindDirectionChange,
  onWindSpeedChange,
  onWaterLevelChange,
  onRainfallIntensityChange,
}: ScenarioSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <aside className="w-10 border-l border-border bg-card flex flex-col items-center py-3 shrink-0">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Rozwin panel scenariusza"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[340px] border-l border-border bg-card flex flex-col shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-semibold tracking-tight">Scenariusze</h2>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Zwin panel"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <ScenarioPanel
            state={scenario}
            impact={scenarioImpact}
            maxHours={maxHours}
            onSelectScenario={onSelectScenario}
            onDeactivate={onDeactivate}
            onTogglePlay={onTogglePlay}
            onHoursChange={onHoursChange}
            onWindDirectionChange={onWindDirectionChange}
            onWindSpeedChange={onWindSpeedChange}
            onWaterLevelChange={onWaterLevelChange}
            onRainfallIntensityChange={onRainfallIntensityChange}
          />
        </div>
      </ScrollArea>
    </aside>
  );
}
