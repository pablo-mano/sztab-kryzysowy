import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import type { ScenarioZone, SubstanceId, ReleaseScenarioId, StabilityClass } from "@/types/scenario";

// ---------------------------------------------------------------------------
// Substance reference data (mirrors Snowflake ref_toxic_substances)
// ---------------------------------------------------------------------------

export interface SubstanceConfig {
  id: SubstanceId;
  name: string;
  formula: string;
  molecularWeight: number;
  densityRatio: number; // vs air (< 1 = lighter)
  erpg1: number; // ppm
  erpg2: number;
  erpg3: number;
  idlh: number;
  hazard: string;
}

export const SUBSTANCES: Record<SubstanceId, SubstanceConfig> = {
  ammonia: {
    id: "ammonia", name: "Amoniak", formula: "NH\u2083",
    molecularWeight: 17.03, densityRatio: 0.59,
    erpg1: 25, erpg2: 150, erpg3: 750, idlh: 300,
    hazard: "Toksyczność inhalacyjna",
  },
  nitrogen_dioxide: {
    id: "nitrogen_dioxide", name: "Dwutlenek azotu", formula: "NO\u2082",
    molecularWeight: 46.01, densityRatio: 1.58,
    erpg1: 1, erpg2: 15, erpg3: 30, idlh: 20,
    hazard: "Toksyczne opary",
  },
  chlorine: {
    id: "chlorine", name: "Chlor", formula: "Cl\u2082",
    molecularWeight: 70.90, densityRatio: 2.49,
    erpg1: 1, erpg2: 3, erpg3: 20, idlh: 10,
    hazard: "Toksyczność inhalacyjna",
  },
  nitric_acid: {
    id: "nitric_acid", name: "Kwas azotowy", formula: "HNO\u2083",
    molecularWeight: 63.01, densityRatio: 2.17,
    erpg1: 1, erpg2: 6, erpg3: 78, idlh: 25,
    hazard: "Toksyczne opary NO\u2093",
  },
};

// ---------------------------------------------------------------------------
// Release scenarios (mirrors Snowflake ref_release_scenarios)
// ---------------------------------------------------------------------------

export interface ReleaseScenarioConfig {
  id: ReleaseScenarioId;
  name: string;
  description: string;
}

export const RELEASE_SCENARIOS: ReleaseScenarioConfig[] = [
  { id: "small_leak", name: "Mały wyciek", description: "Nieszczelność instalacji" },
  { id: "medium_leak", name: "Średni wyciek", description: "Uszkodzenie rurociągu" },
  { id: "large_leak", name: "Duży wyciek", description: "Awaria zbiornika" },
  { id: "catastrophic", name: "Katastroficzny", description: "Rozerwanie zbiornika" },
];

const RELEASE_RATES: Record<SubstanceId, Record<ReleaseScenarioId, { rateKgS: number; durationS: number }>> = {
  ammonia: {
    small_leak:   { rateKgS: 0.5,   durationS: 3600 },
    medium_leak:  { rateKgS: 5.0,   durationS: 1800 },
    large_leak:   { rateKgS: 50,    durationS: 600 },
    catastrophic: { rateKgS: 500,   durationS: 300 },
  },
  nitrogen_dioxide: {
    small_leak:   { rateKgS: 0.1,   durationS: 3600 },
    medium_leak:  { rateKgS: 1.0,   durationS: 1800 },
    large_leak:   { rateKgS: 10,    durationS: 600 },
    catastrophic: { rateKgS: 100,   durationS: 300 },
  },
  chlorine: {
    small_leak:   { rateKgS: 0.2,   durationS: 3600 },
    medium_leak:  { rateKgS: 2.0,   durationS: 1800 },
    large_leak:   { rateKgS: 20,    durationS: 600 },
    catastrophic: { rateKgS: 200,   durationS: 300 },
  },
  nitric_acid: {
    small_leak:   { rateKgS: 0.1,   durationS: 3600 },
    medium_leak:  { rateKgS: 1.0,   durationS: 1800 },
    large_leak:   { rateKgS: 10,    durationS: 600 },
    catastrophic: { rateKgS: 50,    durationS: 300 },
  },
};

// ---------------------------------------------------------------------------
// Stability classes (Pasquill-Gifford)
// ---------------------------------------------------------------------------

export interface StabilityInfo {
  name: string;
  description: string;
}

export const STABILITY_CLASSES: Record<StabilityClass, StabilityInfo> = {
  A: { name: "Bardzo niestabilna", description: "Silne nasłonecznienie, słaby wiatr" },
  B: { name: "Niestabilna", description: "Umiarkowane nasłonecznienie" },
  C: { name: "Lekko niestabilna", description: "Słabe nasłonecznienie" },
  D: { name: "Neutralna", description: "Zachmurzenie / silniejszy wiatr" },
  E: { name: "Lekko stabilna", description: "Noc, umiarkowany wiatr" },
  F: { name: "Stabilna", description: "Noc, słaby wiatr, czyste niebo" },
};

// Turner (1970) coefficients: σ_y = a * x^b, σ_z = a * x^b (x in meters)
const DISPERSION_COEFFS: Record<StabilityClass, { syA: number; syB: number; szA: number; szB: number }> = {
  A: { syA: 0.3658, syB: 0.9031, szA: 0.192,  szB: 1.2604 },
  B: { syA: 0.2751, syB: 0.9031, szA: 0.156,  szB: 1.0857 },
  C: { syA: 0.2090, syB: 0.9031, szA: 0.116,  szB: 0.9615 },
  D: { syA: 0.1471, syB: 0.9031, szA: 0.079,  szB: 0.8183 },
  E: { syA: 0.1046, syB: 0.9031, szA: 0.063,  szB: 0.6853 },
  F: { syA: 0.0722, syB: 0.9031, szA: 0.053,  szB: 0.5527 },
};

// ---------------------------------------------------------------------------
// Auto stability class from weather conditions
// ---------------------------------------------------------------------------

export type TimeOfDay = "day" | "night";
export type CloudCover = "strong_sun" | "moderate_sun" | "weak_sun" | "cloudy";

export function autoStabilityClass(windSpeed: number, timeOfDay: TimeOfDay, cloudCover: CloudCover): StabilityClass {
  if (timeOfDay === "night") {
    if (windSpeed < 3) return "F";
    if (windSpeed < 5) return "E";
    return "D";
  }
  // Day
  if (cloudCover === "cloudy") return "D";
  if (cloudCover === "strong_sun") {
    if (windSpeed < 2) return "A";
    if (windSpeed < 3) return "A";
    if (windSpeed < 5) return "B";
    return "C";
  }
  if (cloudCover === "moderate_sun") {
    if (windSpeed < 2) return "A";
    if (windSpeed < 3) return "B";
    if (windSpeed < 5) return "B";
    if (windSpeed < 6) return "C";
    return "D";
  }
  // weak_sun
  if (windSpeed < 2) return "B";
  if (windSpeed < 5) return "C";
  return "D";
}

// ---------------------------------------------------------------------------
// Gaussian dispersion math
// ---------------------------------------------------------------------------

function sigmaY(x: number, stability: StabilityClass): number {
  const c = DISPERSION_COEFFS[stability];
  return c.syA * Math.pow(x, c.syB);
}

function sigmaZ(x: number, stability: StabilityClass): number {
  const c = DISPERSION_COEFFS[stability];
  return c.szA * Math.pow(x, c.szB);
}

/**
 * Find downwind distance where centerline concentration drops to threshold.
 * Bisection search on C_max(x) = Q / (π · u · σ_y · σ_z)
 */
function findZoneDistance(
  rateKgS: number,
  windSpeed: number,
  stability: StabilityClass,
  thresholdPpm: number,
  molecularWeight: number,
  densityRatio: number,
): number {
  const effectiveWind = Math.max(windSpeed, 0.5);
  let thresholdKgM3 = (thresholdPpm * molecularWeight) / 24.45e6;

  // Density correction: lighter gases rise → less ground concentration
  if (densityRatio < 1) thresholdKgM3 /= 0.7;
  else if (densityRatio > 1.5) thresholdKgM3 /= 1.3;

  let xMin = 1;
  let xMax = 100000;
  for (let i = 0; i < 60; i++) {
    const x = (xMin + xMax) / 2;
    const sy = sigmaY(x, stability);
    const sz = sigmaZ(x, stability);
    const conc = rateKgS / (Math.PI * effectiveWind * sy * sz);
    if (conc > thresholdKgM3) xMin = x;
    else xMax = x;
  }
  return (xMin + xMax) / 2;
}

/**
 * Generate a Gaussian plume sector polygon.
 * Width at each downwind distance x = 2 * σ_y(x) (~95% of concentration).
 */
function computeZonePolygon(
  origin: [number, number],
  windDirection: number,
  downwindDistanceM: number,
  stability: StabilityClass,
): Feature<Polygon> {
  const cloudDir = (windDirection + 180) % 360;
  const steps = 30;

  const rightSide: [number, number][] = [];
  const leftSide: [number, number][] = [];

  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * downwindDistanceM;
    const halfWidth = 2.0 * sigmaY(Math.max(x, 10), stability);

    const axisPoint = turf.destination(turf.point(origin), x / 1000, cloudDir, { units: "kilometers" });
    const axisCoords = axisPoint.geometry.coordinates as [number, number];

    const right = turf.destination(turf.point(axisCoords), halfWidth / 1000, (cloudDir + 90) % 360, { units: "kilometers" });
    rightSide.push(right.geometry.coordinates as [number, number]);

    const left = turf.destination(turf.point(axisCoords), halfWidth / 1000, (cloudDir + 270) % 360, { units: "kilometers" });
    leftSide.unshift(left.geometry.coordinates as [number, number]);
  }

  const coords: [number, number][] = [origin, ...rightSide, ...leftSide, origin];
  return turf.polygon([coords]);
}

// ---------------------------------------------------------------------------
// Public: zone computation results
// ---------------------------------------------------------------------------

export interface ZoneResult {
  level: "erpg3" | "erpg2" | "erpg1";
  thresholdPpm: number;
  distanceM: number;
  crosswindM: number;
  areaKm2: number;
}

export interface GaussianParams {
  origin: [number, number];
  windDirection: number;
  windSpeed: number;
  substanceId: SubstanceId;
  releaseScenario: ReleaseScenarioId;
  stabilityClass: StabilityClass;
}

const ZONE_STYLES: Record<string, { color: string; opacity: number; label: string; description: string }> = {
  erpg3: { color: "#DC2626", opacity: 0.35, label: "Strefa zagrożenia życia (ERPG-3)", description: "Natychmiastowa ewakuacja" },
  erpg2: { color: "#F59E0B", opacity: 0.30, label: "Strefa poważnych skutków (ERPG-2)", description: "Ryzyko zdrowotne, ewakuacja zalecana" },
  erpg1: { color: "#3B82F6", opacity: 0.25, label: "Strefa ewakuacji prewencyjnej (ERPG-1)", description: "Zalecane pozostanie w budynkach" },
};

export function generateGaussianZones(params: GaussianParams): { zones: ScenarioZone[]; results: ZoneResult[] } {
  const sub = SUBSTANCES[params.substanceId];
  const release = RELEASE_RATES[params.substanceId][params.releaseScenario];

  const levels: Array<{ level: "erpg3" | "erpg2" | "erpg1"; threshold: number }> = [
    { level: "erpg3", threshold: sub.erpg3 },
    { level: "erpg2", threshold: sub.erpg2 },
    { level: "erpg1", threshold: sub.erpg1 },
  ];

  const zones: ScenarioZone[] = [];
  const results: ZoneResult[] = [];

  for (const { level, threshold } of levels) {
    const distanceM = findZoneDistance(
      release.rateKgS, params.windSpeed, params.stabilityClass,
      threshold, sub.molecularWeight, sub.densityRatio,
    );

    // Cap at 50km with warning
    const cappedDistance = Math.min(distanceM, 50000);
    const crosswindM = 2 * sigmaY(cappedDistance, params.stabilityClass);

    const feature = computeZonePolygon(
      params.origin, params.windDirection, cappedDistance, params.stabilityClass,
    );

    const areaKm2 = turf.area(feature) / 1e6;
    const style = ZONE_STYLES[level];

    zones.push({
      zone: level,
      label: style.label,
      description: style.description,
      feature,
      color: style.color,
      opacity: style.opacity,
    });

    results.push({ level, thresholdPpm: threshold, distanceM: cappedDistance, crosswindM, areaKm2 });
  }

  return { zones, results };
}

// ---------------------------------------------------------------------------
// Helpers for release info
// ---------------------------------------------------------------------------

export function getReleaseRate(substanceId: SubstanceId, scenarioId: ReleaseScenarioId) {
  return RELEASE_RATES[substanceId][scenarioId];
}

/**
 * Estimate time for cloud to reach a given distance (minutes).
 */
export function timeToArrival(distanceM: number, windSpeed: number): number {
  return distanceM / Math.max(windSpeed, 0.5) / 60;
}

// ---------------------------------------------------------------------------
// Legacy exports for backward compatibility during transition
// ---------------------------------------------------------------------------

/** @deprecated Use generateGaussianZones instead */
export interface ToxicCloudParams {
  origin: [number, number];
  windDirection: number;
  windSpeed: number;
  hours: number;
}

/** @deprecated */
export interface ToxicCloudZone {
  zone: "red" | "orange" | "yellow";
  label: string;
  description: string;
  feature: Feature<Polygon>;
}

/** @deprecated Use generateGaussianZones instead */
export function generateToxicCloud(params: ToxicCloudParams): ToxicCloudZone[] {
  // Legacy: map to Gaussian model with defaults
  const { zones } = generateGaussianZones({
    origin: params.origin,
    windDirection: params.windDirection,
    windSpeed: params.windSpeed,
    substanceId: "ammonia",
    releaseScenario: "large_leak",
    stabilityClass: "D",
  });

  return zones.map((z) => ({
    zone: (z.zone === "erpg3" ? "red" : z.zone === "erpg2" ? "orange" : "yellow") as "red" | "orange" | "yellow",
    label: z.label,
    description: z.description,
    feature: z.feature as Feature<Polygon>,
  }));
}

/** @deprecated Use ScenarioZone from generateGaussianZones instead */
export function toxicCloudToScenarioZones(tcZones: ToxicCloudZone[]): ScenarioZone[] {
  const colorMap: Record<string, { color: string; opacity: number }> = {
    red: { color: "#DC2626", opacity: 0.35 },
    orange: { color: "#F59E0B", opacity: 0.30 },
    yellow: { color: "#3B82F6", opacity: 0.25 },
  };
  return tcZones.map((z) => ({
    zone: z.zone,
    label: z.label,
    description: z.description,
    feature: z.feature,
    color: colorMap[z.zone]?.color ?? "#DC2626",
    opacity: colorMap[z.zone]?.opacity ?? 0.25,
  }));
}

export function getCloudBounds(zones: ToxicCloudZone[]) {
  if (zones.length === 0) return null;
  const fc = turf.featureCollection(zones.map((z) => z.feature));
  return turf.bbox(fc);
}
