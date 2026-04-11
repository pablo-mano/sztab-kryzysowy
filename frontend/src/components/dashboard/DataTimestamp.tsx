"use client";

import { Clock } from "lucide-react";

interface DataTimestampProps {
  timestamp: Date | string | null;
  label?: string;
}

export function DataTimestamp({ timestamp, label = "Ostatnia aktualizacja" }: DataTimestampProps) {
  if (!timestamp) return null;

  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const formatted = date.toLocaleString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="w-3 h-3" />
      <span>{label}: {formatted}</span>
    </div>
  );
}
