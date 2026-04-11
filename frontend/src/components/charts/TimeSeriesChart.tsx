"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { ChartDataPoint } from "@/types/dashboard";

interface TimeSeriesChartProps {
  data: ChartDataPoint[];
  title?: string;
  color?: string;
  unit?: string;
}

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

export function TimeSeriesChart({
  data,
  title,
  color = "#3b82f6",
  unit = "",
}: TimeSeriesChartProps) {
  return (
    <div className="space-y-2">
      {title && (
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </h4>
      )}
      <div className="h-[180px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelFormatter={(label) => formatTime(String(label))}
              formatter={(value) => [`${value}${unit}`, ""]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
