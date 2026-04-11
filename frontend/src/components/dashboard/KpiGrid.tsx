"use client";

import { KpiCard } from "./KpiCard";
import type { KpiConfig } from "@/types/dashboard";

interface KpiGridProps {
  items: KpiConfig[];
}

export function KpiGrid({ items }: KpiGridProps) {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <KpiCard key={item.id} {...item} />
      ))}
    </div>
  );
}
