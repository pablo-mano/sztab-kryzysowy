# SZTAB KRYZYSOWY — Specyfikacja Frontend + API (Claude Code)

> Ten dokument opisuje **wszystko poza Snowflake** — Next.js app, MapLibre mapa, sidebar, wykresy, API Routes (cache layer), scenariusz kryzysowy, demo mode. Wykonywane przez **Claude Code**.
>
> **Zależność**: Snowflake musi być postawiony i mieć dane (patrz `SNOWFLAKE.md`). Frontend łączy się z Snowflake via `snowflake-sdk` w API Routes.

---

## 1. Tech Stack

```
Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
MapLibre GL JS via react-maplibre (WebGL, vector tiles)
@turf/turf (client-side: symulacja chmury, bufory)
Recharts (wykresy)
SWR (data fetching + cache frontend)
snowflake-sdk (connection z API Routes do Snowflake)
Deploy: Vercel
```

---

## 2. Struktura projektu

```
sztab-kryzysowy/
├── public/
│   └── data/
│       └── fallback/                          # snapshoty JSON na wypadek braku Snowflake
│           ├── air-quality-snapshot.json
│           ├── powiaty-snapshot.geojson
│           └── pois-snapshot.geojson
├── src/
│   ├── app/
│   │   ├── layout.tsx                         # root layout, fonty, metadata
│   │   ├── page.tsx                           # dashboard: mapa + sidebar
│   │   ├── globals.css                        # dark theme, animacje
│   │   └── api/
│   │       ├── layers/[layerId]/route.ts      # query Snowflake view → GeoJSON + cache
│   │       ├── aggregate/route.ts             # ad-hoc: radius search, stats per powiat
│   │       └── scenario/route.ts              # affected objects via Snowflake spatial query
│   ├── components/
│   │   ├── map/
│   │   │   ├── DashboardMap.tsx               # MapLibre, renderuje warstwy z rejestru
│   │   │   ├── GeoJsonLayer.tsx               # jedna warstwa (fill/circle/line)
│   │   │   ├── H3HexLayer.tsx                 # H3 heksagony (flat heatmap / 3D extrusion)
│   │   │   ├── LayerPanel.tsx                 # toggle, opacity, grupowanie
│   │   │   ├── RegionSelector.tsx             # dropdown powiat/gmina → flyTo
│   │   │   ├── MapLegend.tsx                  # dynamiczna legenda z config
│   │   │   └── FeaturePopup.tsx               # popup z properties dowolnego feature
│   │   ├── dashboard/
│   │   │   ├── Sidebar.tsx                    # collapsible panel (desktop: stały, tablet: sheet)
│   │   │   ├── KpiCard.tsx                    # uniwersalna karta KPI
│   │   │   ├── KpiGrid.tsx                    # siatka kart (dynamiczna z config)
│   │   │   ├── DataTimestamp.tsx              # "Dane z: ..." per warstwa, pulsująca kropka
│   │   │   ├── FilterPanel.tsx                # dynamiczne filtry z properties warstw
│   │   │   └── FeatureList.tsx                # tabela obiektów, sortowanie, klik → zoom
│   │   ├── charts/
│   │   │   ├── TimeSeriesChart.tsx            # uniwersalny wykres czasowy (Recharts)
│   │   │   ├── BarChart.tsx                   # porównanie regionów/kategorii
│   │   │   ├── StatCard.tsx                   # wartość + trend ↑/↓ + sparkline
│   │   │   └── WindIndicator.tsx              # strzałka kierunku + prędkość
│   │   ├── scenario/
│   │   │   ├── ScenarioPanel.tsx              # aktywuje scenariusz, dodaje warstwy
│   │   │   ├── TimelineSlider.tsx             # 0-8h, play/pause, "T + 2:00h"
│   │   │   ├── ThreatList.tsx                 # tabela zagrożonych obiektów
│   │   │   └── DemoMode.tsx                   # automatyczna animacja prezentacyjna
│   │   └── ui/                                # shadcn/ui (generowane)
│   ├── hooks/
│   │   ├── useLayers.ts                       # toggle, opacity, order warstw
│   │   ├── useLayerData.ts                    # SWR → /api/layers/[id]
│   │   ├── useAggregate.ts                    # SWR → /api/aggregate
│   │   ├── useMapView.ts                      # center, zoom, bounds
│   │   ├── useFeatureSelection.ts             # wybrany feature → popup/detail
│   │   └── useScenario.ts                     # czas, play/pause, chmura, affected, stats
│   ├── lib/
│   │   ├── snowflake.ts                       # Snowflake connection pool + typed query helper
│   │   ├── cache.ts                           # in-memory Map z TTL
│   │   ├── layer-registry.ts                  # ładuje layer-registry.json
│   │   ├── h3-utils.ts                        # pickH3Resolution(zoom), GEOGRAPHY → GeoJSON
│   │   ├── geo-utils.ts                       # turf.js: bbox, fitBounds, distance
│   │   ├── style-utils.ts                     # LayerConfig → MapLibre layer spec
│   │   └── scenarios/
│   │       └── toxic-cloud.ts                 # generateToxicCloud, getAffectedBuildings
│   └── types/
│       ├── layer.ts                           # LayerConfig, DataSource, LayerStyle
│       ├── feature.ts                         # GeoFeature, FeatureProperties
│       ├── snowflake.ts                       # SnowflakeRow types per view
│       └── dashboard.ts                       # KpiConfig, ChartConfig
├── layer-registry.json                        # rejestr warstw (metadane, style, source)
├── .env.local                                 # SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, etc.
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 3. Layer Registry (`layer-registry.json`)

Config-driven: nowa warstwa = nowy wpis w JSON. Zero kodu per warstwa.

Pełny format wpisu:
```typescript
interface LayerConfig {
  id: string;
  name: string;                        // wyświetlana nazwa
  group: string;                       // grupowanie w LayerPanel (Administracja, Infrastruktura, Środowisko, Analityka H3)
  source: {
    type: "snowflake";
    view: string;                      // nazwa view/tabeli w Snowflake
    where?: string;                    // opcjonalny filtr WHERE
    geoColumn?: string;                // kolumna GEOGRAPHY (domyślnie: lat/lon)
    cacheTTL: number;                  // ms — jak długo cache'ować w API Route
  };
  style: {
    type: "fill" | "circle" | "line" | "fill-extrusion";
    paint: Record<string, any>;        // MapLibre paint properties
  };
  interactive: boolean;                // kliknięcie → popup
  popupFields?: string[];              // jakie kolumny pokazać w popup
  defaultVisible: boolean;
  legend?: {
    type: "simple" | "gradient" | "categorical";
    label: string;
    color?: string;
    stops?: string[];
  };
  chart?: {
    type: "timeseries" | "bar";
    query: string;                     // SQL z :id placeholder
    dataKey: string;
    label: string;
  };
  kpi?: {
    field: string;
    label: string;
    colorMap?: string;
  };
}
```

Warstwy zdefiniowane w rejestrze — patrz sekcja Layer Registry w `PLAN.md`.

---

## 4. API Routes (cache layer między Snowflake a frontendem)

### 4.1 `/api/layers/[layerId]/route.ts`

```
GET /api/layers/admin-powiaty
GET /api/layers/poi-hospitals
GET /api/layers/h3-poi-density
...
```

Logika:
1. Czyta `LayerConfig` z `layer-registry.json` po `layerId`
2. Sprawdza cache (in-memory Map z TTL)
3. Cache miss → query Snowflake view (z opcjonalnym WHERE)
4. Konwertuje rows → GeoJSON FeatureCollection:
   - Jeśli `geoColumn` → parsuj GEOGRAPHY jako GeoJSON geometry
   - Jeśli `latitude/longitude` → `Point(lon, lat)`
   - Reszta kolumn → `properties`
5. Zapisuje w cache z TTL z config
6. Fallback: jeśli Snowflake error → czytaj `/public/data/fallback/`
7. Zwraca `Response` z `Content-Type: application/geo+json`

### 4.2 `/api/aggregate/route.ts`

```
POST /api/aggregate
Body: { "query": "radius_search", "params": { "lat": 51.42, "lon": 21.97, "radius": 30000 } }
POST /api/aggregate
Body: { "query": "poi_by_powiat" }
POST /api/aggregate  
Body: { "query": "powiat_stats" }
POST /api/aggregate
Body: { "query": "timeseries", "params": { "station_id": 123, "param_code": "PM10" } }
```

Predefined SQL queries (nie pozwalamy na arbitrary SQL!):
- `radius_search` → `SELECT ... FROM raw_osm_pois WHERE ST_DWITHIN(...)`
- `poi_by_powiat` → `SELECT * FROM v_poi_by_powiat`
- `powiat_stats` → `SELECT * FROM v_powiat_stats`
- `timeseries` → `SELECT measure_date, value FROM raw_gios_measurements WHERE station_id = :id AND param_code = :param ORDER BY measure_date DESC LIMIT 48`

### 4.3 `/api/scenario/route.ts`

```
POST /api/scenario
Body: { "cloud_geojson": "...", "origin_lat": 51.42, "origin_lon": 21.97 }
```

Query Snowflake:
1. Obiekty w strefie (ST_WITHIN)
2. H3 agregacja strefy zagrożenia
3. Zwraca: `{ affected: Feature[], h3_heatmap: Feature[], stats: { ... } }`

---

## 5. Kluczowe komponenty

### 5.1 `lib/snowflake.ts`

Singleton connection, typed query helper. Env vars:
```
SNOWFLAKE_ACCOUNT=xxx
SNOWFLAKE_USER=xxx
SNOWFLAKE_PASSWORD=xxx
SNOWFLAKE_WAREHOUSE=SZTAB_WH
SNOWFLAKE_DATABASE=SZTAB_DB
```

### 5.2 `lib/cache.ts`

In-memory Map z TTL. Klucz = layerId lub query hash. Proste:
```typescript
const cache = new Map<string, { data: any; expires: number }>();
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>
```

### 5.3 `lib/scenarios/toxic-cloud.ts`

Client-side (turf.js), zero Snowflake. Generuje GeoJSON chmury:
- `generateToxicCloud(origin: [lon, lat], windDirection: number, windSpeed: number, hoursElapsed: number)`
- Zwraca: `{ red: Polygon, orange: Polygon, yellow: Polygon }` (3 strefy)
- Logika: turf.sector w kierunku wiatru, radius rośnie z czasem
- Strefy: czerwona (0-5km), pomarańczowa (5-15km), żółta (15-30km)

Frontend generuje chmurę → wysyła GeoJSON do `/api/scenario` → Snowflake zwraca affected objects.

### 5.4 `components/map/H3HexLayer.tsx`

Renderuje heksagony H3 z Snowflake. Dwa tryby:
- **Flat heatmap**: MapLibre `fill` layer z kolorem wg wartości (poi_count, avg_pm10, risk_score)
- **3D extrusion**: MapLibre `fill-extrusion` z wysokością wg wartości — spektakularny efekt na dark theme

Adaptive resolution: API Route przekazuje `?resolution=7` lub `?resolution=9` w zależności od zoom level.

---

## 6. Fazy implementacji

### FAZA 1: Uniwersalna platforma (Etapy 0–3)

**Etap 0 (1.5h)**: Scaffold Next.js + shadcn/ui + dark theme + `lib/snowflake.ts` + `lib/cache.ts` + deploy Vercel + fallback snapshots

**Etap 1 (3h)**: DashboardMap + GeoJsonLayer + H3HexLayer + LayerPanel + RegionSelector + FeaturePopup + `/api/layers/[id]` + useLayers + useLayerData

**Etap 2 (2.5h)**: Sidebar + KpiGrid + FeatureList + FilterPanel + DataTimestamp + MapLegend + responsywność (desktop/tablet)

**Etap 3 (2.5h)**: `/api/aggregate` + TimeSeriesChart + BarChart + StatCard + WindIndicator + useAggregate

### FAZA 2: Scenariusz D — pożar Puławy (Etapy 4–6)

**Etap 4 (3-4h)**: toxic-cloud.ts (turf.js) + `/api/scenario` + useScenario + TimelineSlider + ScenarioPanel + ThreatList + KPI scenariusza + H3 heatmap zagrożenia

**Etap 5 (1.5h)**: Filtry scenariuszowe + warstwa wiatru + stackowanie warstw

**Etap 6 (2h)**: DemoMode (automatyczna animacja ~90s) + animacje + loading states + README

### FAZA 3: Bonusy

1. **Kalkulator zasobów** (+10 pkt, ~2h) — klik na mapę → suwak promienia → query `/api/aggregate?radius_search`
2. **Scraping** (+10 pkt, ~2h) — nowy data provider → Snowflake → warstwa
3. **Social media** (+10 pkt, ~2h) — syntetyczne piny → Snowflake → warstwa
4. **Asystent głosowy** (+10 pkt, ~3h) — Web Speech API → komendy → akcje

---

## 7. UI / Design

- **Dark theme**: tło `#0a0a0f`, karty z subtle border `#1a1a2e`, akcenty per strefa (czerwony/pomarańczowy/żółty)
- **Layout**: mapa ~70% + sidebar ~30%. Desktop: sidebar stały. Tablet: sidebar jako shadcn Sheet.
- **Sidebar tabs**: Warstwy | Dane | Wykresy (+ Zagrożenia gdy scenariusz aktywny)
- **KPI cards**: ikona + label + wartość + kolor. Dynamiczne z layer config.
- **3D hexagony**: na ciemnym tle z fill-extrusion wyglądają spektakularnie
- **Animacje**: flyTo (smooth), pulse (zagrożone obiekty), fade-in (warstwy)

---

## 8. Env vars (Vercel)

```
SNOWFLAKE_ACCOUNT=xxxxx.eu-central-1
SNOWFLAKE_USER=sztab_user
SNOWFLAKE_PASSWORD=xxxxx
SNOWFLAKE_WAREHOUSE=SZTAB_WH
SNOWFLAKE_DATABASE=SZTAB_DB
SNOWFLAKE_SCHEMA=PUBLIC
```

---

## 9. Weryfikacja (checklist Claude Code)

### Faza 1:
- [ ] `pnpm dev` → mapa z granicami lubelskiego (z Snowflake), dark theme
- [ ] LayerPanel → toggle szpitale → markery pojawiają się (dane z Snowflake)
- [ ] Kliknięcie szpitala → popup z name, estimated_population
- [ ] Toggle "Jakość powietrza" → markery stacji GIOŚ z kolorami AQI
- [ ] Toggle "Gęstość infrastruktury (H3)" → heksagony 3D
- [ ] Kliknięcie stacji GIOŚ → wykres PM10 24h w sidebar
- [ ] BarChart: szpitale per powiat
- [ ] FilterPanel → filtruj szkoły → mapa aktualizuje się
- [ ] RegionSelector → zmiana powiatu → flyTo
- [ ] Tablet: sidebar jako sheet

### Faza 2:
- [ ] Aktywacja scenariusza → punkt pożaru + chmura na mapie
- [ ] Timeline 0→8h → chmura rośnie
- [ ] ThreatList + KPI aktualizują się (dane z Snowflake)
- [ ] H3 heatmap zagrożenia widoczny
- [ ] Demo mode → 90s automatyczna animacja

### Deploy:
- [ ] `vercel deploy` → link publiczny
- [ ] Env vars ustawione
- [ ] Fallback działa gdy Snowflake niedostępne
