"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, ChevronRight, X } from "lucide-react";
import { useRegions, type RegionOption, type BBox } from "@/hooks/useRegions";
import type { RegionFilter } from "@/hooks/useLayerData";

type Level = "wojewodztwo" | "powiat" | "gmina";

interface RegionPickerProps {
  regionFilter: RegionFilter | null;
  onRegionChange: (filter: RegionFilter | null, bbox?: BBox) => void;
}

export function RegionPicker({
  regionFilter,
  onRegionChange,
}: RegionPickerProps) {
  const {
    regions,
    isLoading,
    getWojewodztwa,
    getPowiaty,
    getGminy,
    findByName,
  } = useRegions();

  const [selectedWoj, setSelectedWoj] = useState<RegionOption | null>(null);
  const [selectedPowiat, setSelectedPowiat] = useState<RegionOption | null>(null);
  const [selectedGmina, setSelectedGmina] = useState<RegionOption | null>(null);
  const [openLevel, setOpenLevel] = useState<Level | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-select single województwo
  useEffect(() => {
    if (!regions) return;
    const woj = getWojewodztwa();
    if (woj.length === 1 && !selectedWoj) {
      setSelectedWoj(woj[0]);
    }
  }, [regions, getWojewodztwa, selectedWoj]);

  // Sync from external regionFilter (map clicks)
  useEffect(() => {
    if (!regions || !regionFilter) return;

    const match = findByName(regionFilter.name, regionFilter.level);
    if (!match) return;

    // Avoid redundant updates
    if (regionFilter.level === "gmina" && selectedGmina?.teryt === match.teryt) return;
    if (regionFilter.level === "powiat" && selectedPowiat?.teryt === match.teryt && !selectedGmina) return;
    if (regionFilter.level === "wojewodztwo" && selectedWoj?.teryt === match.teryt && !selectedPowiat) return;

    const woj = getWojewodztwa();

    if (regionFilter.level === "wojewodztwo") {
      setSelectedWoj(match);
      setSelectedPowiat(null);
      setSelectedGmina(null);
    } else if (regionFilter.level === "powiat") {
      const parentWoj = woj.find((w) => match.teryt.startsWith(w.teryt));
      if (parentWoj) setSelectedWoj(parentWoj);
      setSelectedPowiat(match);
      setSelectedGmina(null);
    } else if (regionFilter.level === "gmina") {
      const parentWoj = woj.find((w) => match.teryt.startsWith(w.teryt));
      if (parentWoj) setSelectedWoj(parentWoj);
      const powiaty = parentWoj ? getPowiaty(parentWoj.teryt) : [];
      const parentPow = powiaty.find((p) => match.teryt.startsWith(p.teryt));
      if (parentPow) setSelectedPowiat(parentPow);
      setSelectedGmina(match);
    }
  }, [regionFilter, regions, findByName, getWojewodztwa, getPowiaty, selectedWoj, selectedPowiat, selectedGmina]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openLevel) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenLevel(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openLevel]);

  const handleSelect = useCallback(
    (level: Level, option: RegionOption) => {
      setOpenLevel(null);
      if (level === "wojewodztwo") {
        setSelectedWoj(option);
        setSelectedPowiat(null);
        setSelectedGmina(null);
        onRegionChange({ name: option.name, level: "wojewodztwo" }, option.bbox);
      } else if (level === "powiat") {
        setSelectedPowiat(option);
        setSelectedGmina(null);
        onRegionChange({ name: option.name, level: "powiat" }, option.bbox);
      } else {
        setSelectedGmina(option);
        onRegionChange({ name: option.name, level: "gmina" }, option.bbox);
      }
    },
    [onRegionChange],
  );

  const handleClear = useCallback(() => {
    const woj = getWojewodztwa();
    // Keep single woj auto-selected
    if (woj.length === 1) {
      setSelectedWoj(woj[0]);
    } else {
      setSelectedWoj(null);
    }
    setSelectedPowiat(null);
    setSelectedGmina(null);
    setOpenLevel(null);
    onRegionChange(null);
  }, [onRegionChange, getWojewodztwa]);

  if (isLoading || !regions) {
    return (
      <div className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-border px-3 py-2">
        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">Ładowanie regionów...</span>
      </div>
    );
  }

  const hasFilter = regionFilter !== null;
  const wojOptions = getWojewodztwa();
  const powiatOptions = selectedWoj ? getPowiaty(selectedWoj.teryt) : [];
  const gminaOptions = selectedPowiat ? getGminy(selectedPowiat.teryt) : [];

  // Build breadcrumb segments
  const segments: { level: Level; label: string; options: RegionOption[] }[] = [];

  // Show woj segment only if multiple options
  if (wojOptions.length > 1) {
    segments.push({
      level: "wojewodztwo",
      label: selectedWoj?.name ?? "Województwo",
      options: wojOptions,
    });
  }

  // Powiat segment
  if (selectedWoj) {
    segments.push({
      level: "powiat",
      label: selectedPowiat?.name ?? "Powiat",
      options: powiatOptions,
    });
  }

  // Gmina segment
  if (selectedPowiat) {
    segments.push({
      level: "gmina",
      label: selectedGmina?.name ?? "Gmina",
      options: gminaOptions,
    });
  }

  return (
    <div ref={containerRef} className="mx-4 mt-3 relative">
      <div
        className={`flex items-center gap-1.5 rounded-md border px-3 py-2 ${
          hasFilter
            ? "border-blue-500/30 bg-blue-500/10"
            : "border-border bg-card"
        }`}
      >
        <MapPin
          className={`w-3.5 h-3.5 shrink-0 ${
            hasFilter ? "text-blue-400" : "text-muted-foreground"
          }`}
        />
        <div className="flex-1 min-w-0 flex items-center gap-0.5 overflow-hidden">
          {segments.map((seg, i) => {
            const isSelected =
              (seg.level === "wojewodztwo" && selectedWoj) ||
              (seg.level === "powiat" && selectedPowiat) ||
              (seg.level === "gmina" && selectedGmina);

            return (
              <span key={seg.level} className="flex items-center gap-0.5 min-w-0">
                {i > 0 && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                )}
                <button
                  onClick={() =>
                    setOpenLevel(openLevel === seg.level ? null : seg.level)
                  }
                  className={`text-xs truncate rounded px-1 py-0.5 transition-colors ${
                    openLevel === seg.level
                      ? "bg-accent text-foreground"
                      : isSelected
                        ? "text-foreground hover:bg-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  {seg.label}
                </button>
              </span>
            );
          })}
        </div>
        {hasFilter && (
          <button
            onClick={handleClear}
            className="p-0.5 rounded hover:bg-blue-500/20 text-blue-300 hover:text-blue-100 transition-colors shrink-0"
            title="Wyczyść filtr regionu"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {openLevel && (
        <DropdownList
          options={
            segments.find((s) => s.level === openLevel)?.options ?? []
          }
          selected={
            openLevel === "wojewodztwo"
              ? selectedWoj
              : openLevel === "powiat"
                ? selectedPowiat
                : selectedGmina
          }
          onSelect={(opt) => handleSelect(openLevel, opt)}
        />
      )}
    </div>
  );
}

function DropdownList({
  options,
  selected,
  onSelect,
}: {
  options: RegionOption[];
  selected: RegionOption | null;
  onSelect: (opt: RegionOption) => void;
}) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = search.trim()
    ? options.filter((o) =>
        o.name.toLowerCase().includes(search.toLowerCase()),
      )
    : options;

  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-card shadow-lg">
      {options.length > 5 && (
        <div className="p-1.5 border-b border-border">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj..."
            className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}
      <div className="max-h-48 overflow-y-auto p-1">
        {filtered.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Brak wyników
          </div>
        )}
        {filtered.map((opt) => (
          <button
            key={opt.teryt}
            onClick={() => onSelect(opt)}
            className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors truncate ${
              selected?.teryt === opt.teryt
                ? "bg-accent text-foreground font-medium"
                : "text-foreground hover:bg-accent"
            }`}
          >
            {opt.name}
          </button>
        ))}
      </div>
    </div>
  );
}
