"use client";

import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface BarChartDataPoint {
  name: string;
  value: number;
  [key: string]: unknown;
}

interface BarChartProps {
  data: BarChartDataPoint[];
  title?: string;
  color?: string;
  dataKey?: string;
}

export function BarChart({
  data,
  title,
  color = "#3b82f6",
  dataKey = "value",
}: BarChartProps) {
  return (
    <div className="space-y-2">
      {title && (
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </h4>
      )}
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
            layout="vertical"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
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
            />
            <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
