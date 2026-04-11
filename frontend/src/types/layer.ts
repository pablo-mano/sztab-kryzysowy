export interface LayerSource {
  type: "snowflake";
  view: string;
  sql?: string;
  where?: string;
  geoColumn?: string;
  cacheTTL: number;
  h3?: boolean;
}

export interface LayerStyle {
  type: "fill" | "circle" | "line" | "fill-extrusion";
  paint: Record<string, unknown>;
}

export interface LayerLegend {
  type: "simple" | "gradient" | "categorical";
  label: string;
  color?: string;
  stops?: string[];
  colors?: string[];
}

export interface LayerChart {
  type: "timeseries" | "bar";
  query: string;
  dataKey: string;
  label: string;
}

export interface LayerKpi {
  field: string;
  label: string;
  colorMap?: string;
}

export interface LayerConfig {
  id: string;
  name: string;
  group: string;
  source: LayerSource;
  style: LayerStyle;
  interactive: boolean;
  popupFields?: string[];
  defaultVisible: boolean;
  legend?: LayerLegend;
  chart?: LayerChart;
  kpi?: LayerKpi;
}

export interface LayerRegistry {
  layers: LayerConfig[];
}

export interface LayerState {
  visible: boolean;
  opacity: number;
}
