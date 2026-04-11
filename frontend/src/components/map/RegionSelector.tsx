"use client";

import { useCallback } from "react";

interface Region {
  teryt: string;
  name: string;
  center?: [number, number];
}

interface RegionSelectorProps {
  regions: Region[];
  selectedRegion: string | null;
  onSelect: (teryt: string | null) => void;
}

export function RegionSelector({
  regions,
  selectedRegion,
  onSelect,
}: RegionSelectorProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      onSelect(val === "" ? null : val);
    },
    [onSelect],
  );

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Region
      </label>
      <select
        value={selectedRegion ?? ""}
        onChange={handleChange}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Całe województwo</option>
        {regions.map((r) => (
          <option key={r.teryt} value={r.teryt}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}
