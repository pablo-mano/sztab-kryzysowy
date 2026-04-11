"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, X } from "lucide-react";

interface FilterPanelProps {
  features: Record<string, unknown>[];
  filterableFields: string[];
  onFilter: (filtered: Record<string, unknown>[]) => void;
}

const FIELD_LABELS: Record<string, string> = {
  city: "Miasto",
  amenity_type: "Typ obiektu",
  aqi_label: "Jakość powietrza",
  param_code: "Parametr",
};

function formatLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FilterPanel({
  features,
  filterableFields,
  onFilter,
}: FilterPanelProps) {
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // Collect unique values per filterable field
  const fieldOptions = useMemo(() => {
    const options: Record<string, string[]> = {};
    for (const field of filterableFields) {
      const values = new Set<string>();
      for (const f of features) {
        const val = f[field];
        if (val !== null && val !== undefined) values.add(String(val));
      }
      options[field] = Array.from(values).sort();
    }
    return options;
  }, [features, filterableFields]);

  // Apply filters
  const applyFilters = useCallback(
    (newSearch: string, newFilters: Record<string, string>) => {
      let result = features;

      // Text search across all string properties
      if (newSearch.trim()) {
        const q = newSearch.toLowerCase();
        result = result.filter((f) =>
          Object.values(f).some(
            (v) => typeof v === "string" && v.toLowerCase().includes(q),
          ),
        );
      }

      // Field filters
      for (const [field, value] of Object.entries(newFilters)) {
        if (value) {
          result = result.filter((f) => String(f[field]) === value);
        }
      }

      onFilter(result);
    },
    [features, onFilter],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      applyFilters(value, activeFilters);
    },
    [activeFilters, applyFilters],
  );

  const handleFilterChange = useCallback(
    (field: string, value: string) => {
      const newFilters = { ...activeFilters, [field]: value };
      if (!value) delete newFilters[field];
      setActiveFilters(newFilters);
      applyFilters(search, newFilters);
    },
    [activeFilters, search, applyFilters],
  );

  const clearAll = useCallback(() => {
    setSearch("");
    setActiveFilters({});
    onFilter(features);
  }, [features, onFilter]);

  const hasActiveFilters = search.trim() || Object.keys(activeFilters).length > 0;

  return (
    <div className="space-y-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Szukaj..."
          className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Field filters */}
      {filterableFields.map((field) => {
        const options = fieldOptions[field];
        if (!options || options.length <= 1) return null;

        return (
          <select
            key={field}
            value={activeFilters[field] ?? ""}
            onChange={(e) => handleFilterChange(field, e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">{formatLabel(field)} — wszystkie</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );
      })}

      {/* Clear */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3 h-3" />
          Wyczyść filtry
        </button>
      )}
    </div>
  );
}
