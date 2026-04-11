"use client";

import { Loader2, Filter } from "lucide-react";
import { FLOOD_SCENARIOS, type FloodScenarioId } from "@/lib/scenarios/flood";

interface FloodControlsProps {
  selectedScenario: FloodScenarioId;
  loading: boolean;
  onScenarioChange: (id: FloodScenarioId) => void;
  filterActive: boolean;
  onFilterToggle: (active: boolean) => void;
}

export function FloodControls({
  selectedScenario,
  loading,
  onScenarioChange,
  filterActive,
  onFilterToggle,
}: FloodControlsProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Scenariusz ISOK
      </div>
      {FLOOD_SCENARIOS.map((scenario) => {
        const isSelected = scenario.id === selectedScenario;
        return (
          <button
            key={scenario.id}
            onClick={() => onScenarioChange(scenario.id)}
            className={`w-full text-left rounded-lg border-2 p-2.5 transition-colors ${
              isSelected
                ? "border-blue-400/60 bg-blue-500/10"
                : "border-border bg-card hover:border-border/80 hover:bg-accent/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: scenario.color, opacity: isSelected ? 1 : 0.5 }}
              />
              <span className={`text-xs font-semibold ${isSelected ? "text-blue-300" : "text-muted-foreground"}`}>
                {scenario.label}
              </span>
              {isSelected && loading && (
                <Loader2 className="w-3 h-3 animate-spin text-blue-400 ml-auto" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed pl-5">
              {scenario.description}
            </p>
          </button>
        );
      })}

      {/* Filter POI layers to flood zone */}
      <button
        onClick={() => onFilterToggle(!filterActive)}
        className={`w-full flex items-center gap-2 rounded-lg border-2 p-2.5 transition-colors text-left ${
          filterActive
            ? "border-cyan-400/60 bg-cyan-500/10"
            : "border-border bg-card hover:border-border/80 hover:bg-accent/50"
        }`}
      >
        <Filter className={`w-3.5 h-3.5 shrink-0 ${filterActive ? "text-cyan-400" : "text-muted-foreground"}`} />
        <div>
          <span className={`text-xs font-semibold ${filterActive ? "text-cyan-300" : "text-muted-foreground"}`}>
            Filtruj obiekty do strefy
          </span>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            Pokaż tylko szpitale, szkoły, przedszkola i DPS w obrębie wybranej strefy zalewowej
          </p>
        </div>
      </button>

      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
        Dane: Mapy Zagrożenia Powodziowego ISOK, PGW Wody Polskie
      </p>
    </div>
  );
}
