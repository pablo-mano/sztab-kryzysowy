import type { CivilReport, ScenarioZone } from "@/types/scenario";
import type { Feature, Polygon } from "geojson";

export interface TimeRangeOption {
  id: string;
  minutes: number | null;
  label: string;
}

export const TIME_RANGES: TimeRangeOption[] = [
  { id: "15m", minutes: 15, label: "15 min" },
  { id: "1h", minutes: 60, label: "1h" },
  { id: "6h", minutes: 360, label: "6h" },
  { id: "all", minutes: null, label: "Wszystkie" },
];

interface ReportCluster {
  center: [number, number]; // [lon, lat]
  reports: CivilReport[];
}

/** Haversine distance in km */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Fetch reports from the existing civil-reports layer endpoint */
export async function fetchCivilReports(): Promise<CivilReport[]> {
  const res = await fetch("/api/layers/civil-reports");
  if (!res.ok) throw new Error(`Civil reports API error: ${res.status}`);
  const geojson = await res.json();
  const features = geojson.features ?? [];

  return features.map((f: { properties: Record<string, unknown>; geometry: { coordinates: [number, number] } }) => ({
    id: String(f.properties.id ?? ""),
    createdAt: String(f.properties.created_at ?? ""),
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    imageUrl: f.properties.image_url ? String(f.properties.image_url) : undefined,
    audioUrl: f.properties.audio_url ? String(f.properties.audio_url) : undefined,
  }));
}

/** Filter reports by time range (minutes from now). null = all. */
export function filterByTimeRange(reports: CivilReport[], rangeMinutes: number | null): CivilReport[] {
  if (rangeMinutes === null) return reports;
  const cutoff = Date.now() - rangeMinutes * 60 * 1000;
  return reports.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
}

/** Simple distance-based clustering */
export function clusterReports(reports: CivilReport[], radiusKm = 1.0): ReportCluster[] {
  const clusters: ReportCluster[] = [];

  for (const report of reports) {
    let nearest: ReportCluster | null = null;
    let nearestDist = Infinity;

    for (const cluster of clusters) {
      const dist = haversineKm(report.lat, report.lon, cluster.center[1], cluster.center[0]);
      if (dist < radiusKm && dist < nearestDist) {
        nearest = cluster;
        nearestDist = dist;
      }
    }

    if (nearest) {
      nearest.reports.push(report);
      // Update center as weighted average
      const n = nearest.reports.length;
      nearest.center = [
        nearest.center[0] + (report.lon - nearest.center[0]) / n,
        nearest.center[1] + (report.lat - nearest.center[1]) / n,
      ];
    } else {
      clusters.push({
        center: [report.lon, report.lat],
        reports: [report],
      });
    }
  }

  return clusters;
}

/** Generate a circular polygon with N vertices */
function circlePolygon(center: [number, number], radiusKm: number, segments = 32): Feature<Polygon> {
  const [lon, lat] = center;
  const coords: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const dLat = (radiusKm / 6371) * (180 / Math.PI) * Math.cos(angle);
    const dLon = (radiusKm / 6371) * (180 / Math.PI) * Math.sin(angle) / Math.cos((lat * Math.PI) / 180);
    coords.push([lon + dLon, lat + dLat]);
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coords] },
  };
}

/** Convex hull (Graham scan) for a set of [lon, lat] points, with buffer */
function convexHullPolygon(points: [number, number][], bufferKm: number): Feature<Polygon> {
  if (points.length < 3) {
    const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
    const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
    return circlePolygon([cx, cy], bufferKm);
  }

  // Graham scan
  const sorted = [...points].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  const hull = [...lower, ...upper];

  // Buffer: expand each point outward from centroid
  const cx = hull.reduce((s, p) => s + p[0], 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
  const buffered = hull.map(([lon, lat]) => {
    const dx = lon - cx;
    const dy = lat - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return [lon, lat] as [number, number];
    const bufferDeg = (bufferKm / 6371) * (180 / Math.PI);
    const scale = (dist + bufferDeg) / dist;
    return [cx + dx * scale, cy + dy * scale] as [number, number];
  });
  buffered.push(buffered[0]); // close ring

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [buffered] },
  };
}

/** Severity color based on report count */
function severityColor(count: number): { color: string; opacity: number } {
  if (count >= 10) return { color: "#ef4444", opacity: 0.35 };
  if (count >= 4) return { color: "#f97316", opacity: 0.3 };
  return { color: "#eab308", opacity: 0.25 };
}

/** Convert clusters to ScenarioZone[] for map rendering and impact calc */
export function clustersToZones(clusters: ReportCluster[]): ScenarioZone[] {
  // Sort by report count descending
  const sorted = [...clusters].sort((a, b) => b.reports.length - a.reports.length);

  return sorted.map((cluster, i) => {
    const { color, opacity } = severityColor(cluster.reports.length);
    const points = cluster.reports.map((r) => [r.lon, r.lat] as [number, number]);

    let feature: Feature<Polygon>;
    if (points.length <= 2) {
      feature = circlePolygon(cluster.center, 0.5);
    } else {
      feature = convexHullPolygon(points, 0.2);
    }

    return {
      zone: `cluster_${i + 1}`,
      label: `Ognisko #${i + 1}`,
      description: `${cluster.reports.length} zgłoszeń w promieniu ~1 km`,
      feature,
      color,
      opacity,
    };
  });
}

/** Compute bounding box for auto-flyTo: [[minLon, minLat], [maxLon, maxLat]] */
export function computeReportsBounds(
  reports: CivilReport[],
): [[number, number], [number, number]] | null {
  if (reports.length === 0) return null;
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const r of reports) {
    if (r.lon < minLon) minLon = r.lon;
    if (r.lat < minLat) minLat = r.lat;
    if (r.lon > maxLon) maxLon = r.lon;
    if (r.lat > maxLat) maxLat = r.lat;
  }
  // Add small padding
  const pad = 0.02;
  return [
    [minLon - pad, minLat - pad],
    [maxLon + pad, maxLat + pad],
  ];
}
