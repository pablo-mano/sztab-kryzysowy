export interface KpiConfig {
  id: string;
  label: string;
  value: string | number;
  icon?: string;
  color?: string;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
}

export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}
