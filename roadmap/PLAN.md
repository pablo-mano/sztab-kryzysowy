# SZTAB KRYZYSOWY — Plan MVP

## Context
Hackathon civil42.pl — zadanie specjalne Marszałka Woj. Lubelskiego (10 000 PLN). Budujemy **uniwersalny Geospatial Decision Dashboard** — platformę do wizualizacji dowolnych danych geoprzestrzennych na warstwach, z wykresami i panelami informacyjnymi. Scenariusz D (pożar przemysłowy) jest **jednym z możliwych use case'ów**, nie jedynym celem systemu.

**Filozofia**: Platforma najpierw, scenariusz potem. System powinien być równie użyteczny dla danych demograficznych, infrastruktury drogowej, czy zasobów medycznych co dla symulacji kryzysowej.

---

## Architektura danych

```
┌─────────────────────────────────────────────────────────┐
│                    ŹRÓDŁA DANYCH                         │
│  GIOŚ API  │  OpenMeteo  │  GUS/BDL  │  OSM  │  Scraping│
└──────┬──────┬──────┬──────┬──────┬──────┬──────┬────────┘
       │      │      │      │      │      │      │
       ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌─────────────────────────────────────────────────────────┐
│                   SNOWFLAKE (OLAP)                       │
│                                                          │
│  Ingestion:  Snowpipe / scheduled COPY INTO              │
│  Storage:    raw_gios, raw_weather, raw_gus, raw_osm     │
│  Transform:  Scheduled Tasks → agregacje, joiny, geo     │
│  Serving:    Materialized views → gotowe widoki per       │
│              warstwa (GeoJSON-ready)                      │
│  Geospatial: GEOGRAPHY type, ST_DWITHIN, ST_COLLECT      │
└──────────────────────┬──────────────────────────────────┘
                       │ SQL query (snowflake-sdk)
                       ▼
┌─────────────────────────────────────────────────────────┐
│               NEXT.JS API ROUTES (cache layer)           │
│                                                          │
│  /api/layers/[id]     → query Snowflake view → cache     │
│  /api/aggregate       → ad-hoc agregacje → cache         │
│  /api/scenario        → scenariusz logika + Snowflake    │
│                                                          │
│  Cache: in-memory Map z TTL per warstwa                  │
│  Fallback: snapshot JSON gdy Snowflake niedostępne       │
└──────────────────────┬──────────────────────────────────┘
                       │ JSON / GeoJSON
                       ▼
┌─────────────────────────────────────────────────────────┐
│               FRONTEND (Next.js + MapLibre)              │
│                                                          │
│  MapLibre GL   → renderuje warstwy GeoJSON               │
│  SWR hooks     → auto-refresh per warstwa                │
│  Recharts      → wykresy z danych Snowflake              │
│  turf.js       → client-side geo (symulacja chmury)      │
└─────────────────────────────────────────────────────────┘
```

**Dlaczego Snowflake?**
- **Unified ingestion**: CSV, JSON, Parquet, XML — `COPY INTO` z external stage (S3/GCS) lub `PUT` + `COPY`
- **Scheduled Tasks**: co 5 min odśwież GIOŚ, co 10 min pogodę, co 1h GUS — automatyczny pipeline
- **Cross-source analytics**: "korelacja AQI z liczbą szpitali per powiat" = jeden SQL JOIN
- **Geospatial native**: `GEOGRAPHY` type, `ST_DWITHIN`, `ST_INTERSECTS`, `ST_BUFFER`
- **H3 native**: `H3_LATLNG_TO_CELL`, `H3_CELL_TO_BOUNDARY`, `H3_GRID_DISK` — hexagonalna agregacja geoprzestrzenna
- **Skalowalność**: jury widzi produkcyjną architekturę, nie hackathonowy hack
- **Diverse data types**: łatwo dodać nowe źródło — nowa tabela, nowy task, nowa warstwa

**Rozwiązanie problemu latencji:**
- Snowflake queries: 1-5s (warehouse spin-up + query)
- API Route cache: TTL per warstwa (5 min dla GIOŚ, 60 min dla statycznych)
- Frontend SWR: stale-while-revalidate — user widzi cached dane natychmiast
- Efekt: user czuje <200ms, Snowflake odświeża w tle

---

## Tech Stack

```
Frontend:     Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
Mapy:         MapLibre GL JS via react-maplibre (WebGL, vector tiles)
Geo-index:    H3 (Uber hexagonal grid) — agregacja danych w heksagonach
Geo-analiza:  @turf/turf (client-side: symulacja chmury, bufory)
Wykresy:      Recharts
Data:         Snowflake (OLAP, ingestion, H3 aggregation, geospatial)
Cache:        Next.js API Routes (in-memory TTL cache)
State:        React Context + SWR
Deploy:       Vercel (frontend) + Snowflake (free trial $400 credits)
```

---

## Snowflake Schema

```sql
-- ============ RAW TABLES (ingestion) ============

CREATE TABLE raw_gios_stations (
  station_id INT, station_name STRING, 
  latitude FLOAT, longitude FLOAT,
  city STRING, commune STRING,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE raw_gios_measurements (
  station_id INT, sensor_id INT, param_code STRING,  -- PM10, PM25, SO2, NO2, O3
  value FLOAT, measure_date TIMESTAMP,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE raw_weather (
  latitude FLOAT, longitude FLOAT,
  temperature FLOAT, wind_speed FLOAT, wind_direction FLOAT,
  humidity FLOAT, precipitation FLOAT,
  measure_time TIMESTAMP,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE raw_osm_pois (
  osm_id BIGINT, name STRING, amenity_type STRING,  -- hospital, school, etc.
  latitude FLOAT, longitude FLOAT,
  tags VARIANT,  -- JSON z dodatkowymi properties
  estimated_population INT,
  geo GEOGRAPHY,                                     -- ST_MAKEPOINT(longitude, latitude)
  h3_res7 STRING,                                    -- H3_LATLNG_TO_CELL(lat, lon, 7)
  h3_res9 STRING                                     -- H3_LATLNG_TO_CELL(lat, lon, 9)
);

CREATE TABLE raw_admin_boundaries (
  teryt STRING, name STRING, level STRING,  -- wojewodztwo, powiat, gmina
  geo GEOGRAPHY,  -- polygon
  population INT, area_km2 FLOAT
);

-- ============ H3 HEXAGONAL GRID ============
-- 
-- H3 resolution guide (woj. lubelskie ~25 000 km²):
--   res 5: ~253 km² per hex  → ~100 hexów   → widok województwa (overview)
--   res 7: ~5.2 km² per hex  → ~4800 hexów  → widok powiatowy (analityka)
--   res 9: ~0.1 km² per hex  → ~250k hexów  → widok gminny (detail)
--
-- Snowflake H3 functions (natywne, zero UDF):
--   H3_LATLNG_TO_CELL(lat, lon, resolution) → H3 index
--   H3_CELL_TO_BOUNDARY(h3_index) → GEOGRAPHY polygon  
--   H3_GRID_DISK(h3_index, k) → sąsiednie hexagony
--   H3_CELL_TO_PARENT(h3_index, parent_res) → agregacja do wyższej rez.
--   H3_INT_TO_STRING / H3_STRING_TO_INT → konwersja formatów

-- Przy INSERT do raw_osm_pois automatycznie oblicz H3:
-- INSERT INTO raw_osm_pois (..., h3_res7, h3_res9)
-- VALUES (..., H3_LATLNG_TO_CELL(lat, lon, 7), H3_LATLNG_TO_CELL(lat, lon, 9));

-- Przy INSERT do raw_gios_measurements dodaj H3 stacji:
-- (h3 obliczany z pozycji stacji via JOIN z raw_gios_stations)

-- ============ MATERIALIZED VIEWS (serving) ============

-- Warstwa: aktualna jakość powietrza
CREATE VIEW v_air_quality_current AS
SELECT s.station_id, s.station_name, s.latitude, s.longitude,
       m.param_code, m.value, m.measure_date,
       H3_LATLNG_TO_CELL(s.latitude, s.longitude, 7) AS h3_index,
       CASE WHEN m.param_code = 'PM10' AND m.value <= 50 THEN 'dobry'
            WHEN m.param_code = 'PM10' AND m.value <= 100 THEN 'umiarkowany'
            WHEN m.param_code = 'PM10' AND m.value <= 150 THEN 'niezdrowy'
            ELSE 'zły' END AS aqi_label
FROM raw_gios_stations s
JOIN raw_gios_measurements m ON s.station_id = m.station_id
WHERE m.measure_date = (SELECT MAX(measure_date) FROM raw_gios_measurements WHERE station_id = s.station_id);

-- ★ H3 HEATMAP: agregacja POI w heksagonach (warstwa wizualna)
CREATE VIEW v_h3_poi_density AS
SELECT h3_res7 AS h3_index,
       COUNT(*) AS poi_count,
       SUM(estimated_population) AS total_population,
       ARRAY_AGG(DISTINCT amenity_type) AS amenity_types,
       H3_CELL_TO_BOUNDARY(h3_res7) AS hex_boundary  -- polygon do renderowania
FROM raw_osm_pois
GROUP BY h3_res7;

-- ★ H3 HEATMAP: jakość powietrza interpolowana na heksagony
-- (rozszerza punkt stacji na sąsiednie hexy via H3_GRID_DISK)
CREATE VIEW v_h3_air_quality AS
SELECT n.value AS h3_index,
       AVG(aq.value) AS avg_value,
       aq.param_code,
       H3_CELL_TO_BOUNDARY(n.value) AS hex_boundary
FROM v_air_quality_current aq,
     LATERAL FLATTEN(input => H3_GRID_DISK(aq.h3_index, 3)) n  -- 3-ring = ~15km radius
WHERE aq.param_code = 'PM10'
GROUP BY n.value, aq.param_code;

-- ★ H3 CROSS-ANALYSIS: korelacja AQI × gęstość populacji per hex
CREATE VIEW v_h3_risk_score AS
SELECT d.h3_index,
       d.total_population,
       COALESCE(a.avg_value, 0) AS avg_pm10,
       d.total_population * COALESCE(a.avg_value, 0) / 100 AS risk_score,
       d.hex_boundary
FROM v_h3_poi_density d
LEFT JOIN v_h3_air_quality a ON d.h3_index = a.h3_index AND a.param_code = 'PM10';

-- Warstwa: POI z agregacją per powiat
CREATE VIEW v_poi_by_powiat AS
SELECT b.teryt, b.name AS powiat, p.amenity_type,
       COUNT(*) AS count, SUM(p.estimated_population) AS total_population
FROM raw_osm_pois p
JOIN raw_admin_boundaries b ON ST_WITHIN(p.geo, b.geo) AND b.level = 'powiat'
GROUP BY b.teryt, b.name, p.amenity_type;

-- Agregacja: statystyki per powiat (KPI)
CREATE VIEW v_powiat_stats AS
SELECT b.teryt, b.name, b.population, b.area_km2,
       COUNT(DISTINCT CASE WHEN p.amenity_type = 'hospital' THEN p.osm_id END) AS hospitals,
       COUNT(DISTINCT CASE WHEN p.amenity_type = 'school' THEN p.osm_id END) AS schools,
       COUNT(DISTINCT CASE WHEN p.amenity_type = 'nursing_home' THEN p.osm_id END) AS care_homes
FROM raw_admin_boundaries b
LEFT JOIN raw_osm_pois p ON ST_WITHIN(p.geo, b.geo)
WHERE b.level = 'powiat'
GROUP BY b.teryt, b.name, b.population, b.area_km2;
```

### Snowflake Scheduled Tasks (ingestion pipeline)

```sql
-- Odświeżanie GIOŚ co 5 minut
CREATE TASK task_refresh_gios
  WAREHOUSE = SZTAB_WH
  SCHEDULE = '5 MINUTE'
AS
  -- External function wywołuje GIOŚ API i ładuje dane
  CALL refresh_gios_data();

-- Odświeżanie pogody co 10 minut
CREATE TASK task_refresh_weather
  WAREHOUSE = SZTAB_WH  
  SCHEDULE = '10 MINUTE'
AS
  CALL refresh_weather_data();
```

---

## Struktura projektu

```
sztab-kryzysowy/
├── public/
│   └── data/
│       └── fallback/                          # snapshoty na wypadek braku Snowflake
│           ├── air-quality-snapshot.json
│           ├── powiaty-snapshot.geojson
│           └── pois-snapshot.geojson
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                           # dashboard (mapa + sidebar)
│   │   ├── globals.css
│   │   └── api/
│   │       ├── layers/[layerId]/route.ts      # query Snowflake view → GeoJSON + cache
│   │       ├── aggregate/route.ts             # ad-hoc agregacje (radius, cross-layer)
│   │       └── scenario/route.ts              # scenariusz: affected objects via Snowflake
│   ├── components/
│   │   ├── map/
│   │   │   ├── DashboardMap.tsx               # główny komponent MapLibre (generyczny)
│   │   │   ├── GeoJsonLayer.tsx               # renderuje warstwę z rejestru
│   │   │   ├── H3HexLayer.tsx                 # renderuje H3 heksagony (heatmap/choropleth)
│   │   │   ├── LayerPanel.tsx                 # toggle, opacity, grouping
│   │   │   ├── RegionSelector.tsx             # dropdown powiat/gmina → zoom
│   │   │   ├── MapLegend.tsx                  # dynamiczna legenda
│   │   │   └── FeaturePopup.tsx               # popup z properties
│   │   ├── dashboard/
│   │   │   ├── Sidebar.tsx                    # panel boczny (collapsible, tabs)
│   │   │   ├── KpiCard.tsx                    # uniwersalna karta KPI
│   │   │   ├── KpiGrid.tsx                    # siatka kart
│   │   │   ├── DataTimestamp.tsx              # znacznik aktualizacji per warstwa
│   │   │   ├── FilterPanel.tsx                # dynamiczne filtry
│   │   │   └── FeatureList.tsx                # lista/tabela obiektów
│   │   ├── charts/
│   │   │   ├── TimeSeriesChart.tsx            # wykres czasowy (uniwersalny)
│   │   │   ├── BarChart.tsx                   # porównanie regionów/kategorii
│   │   │   ├── StatCard.tsx                   # statystyka z trendem
│   │   │   └── WindIndicator.tsx              # kierunek + prędkość wiatru
│   │   ├── scenario/
│   │   │   ├── ScenarioPanel.tsx              # panel scenariusza kryzysowego
│   │   │   ├── TimelineSlider.tsx             # oś czasu 0-8h
│   │   │   ├── ThreatList.tsx                 # lista zagrożonych obiektów
│   │   │   └── DemoMode.tsx                   # automatyczna prezentacja
│   │   └── ui/                                # shadcn/ui
│   ├── hooks/
│   │   ├── useLayers.ts                       # zarządzanie warstwami
│   │   ├── useLayerData.ts                    # SWR → /api/layers/[id]
│   │   ├── useAggregate.ts                    # SWR → /api/aggregate
│   │   ├── useMapView.ts                      # stan mapy
│   │   ├── useFeatureSelection.ts             # wybrany feature
│   │   └── useScenario.ts                     # stan scenariusza
│   ├── lib/
│   │   ├── snowflake.ts                       # Snowflake client (connection pool + query)
│   │   ├── cache.ts                           # in-memory TTL cache
│   │   ├── layer-registry.ts                  # rejestr warstw (config)
│   │   ├── h3-utils.ts                        # H3 → GeoJSON polygon conversion, resolution picker
│   │   ├── geo-utils.ts                       # turf.js helpers
│   │   ├── style-utils.ts                     # MapLibre style z config
│   │   └── scenarios/
│   │       └── toxic-cloud.ts                 # logika chmury (turf.js client-side)
│   └── types/
│       ├── layer.ts                           # LayerConfig, DataSource
│       ├── feature.ts                         # GeoFeature
│       ├── snowflake.ts                       # query types
│       └── dashboard.ts                       # KPI, Chart config
├── snowflake/
│   ├── setup.sql                              # DDL: tables, views, tasks
│   ├── seed-boundaries.sql                    # COPY INTO admin boundaries
│   ├── seed-pois.sql                          # COPY INTO POIs
│   └── functions/
│       ├── refresh_gios.sql                   # external function → GIOŚ API
│       └── refresh_weather.sql                # external function → OpenMeteo
├── scripts/
│   ├── fetch-boundaries.ts                    # pobiera GeoJSON → upload do Snowflake stage
│   ├── fetch-osm-pois.ts                      # Overpass → upload do Snowflake stage
│   └── seed-snowflake.ts                      # uruchamia setup.sql + seed
├── layer-registry.json                        # rejestr warstw
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Layer Registry (z Snowflake jako source)

```jsonc
{
  "layers": [
    {
      "id": "admin-powiaty",
      "name": "Powiaty",
      "group": "Administracja",
      "source": { 
        "type": "snowflake", 
        "view": "v_admin_boundaries",
        "where": "level = 'powiat'",
        "geoColumn": "geo",
        "cacheTTL": 3600000    // 1h — granice się nie zmieniają
      },
      "style": { "type": "fill", "paint": { "fill-color": "#1e3a5f", "fill-opacity": 0.3 } },
      "interactive": true,
      "defaultVisible": true
    },
    {
      "id": "env-air-quality",
      "name": "Jakość powietrza (GIOŚ)",
      "group": "Środowisko",
      "source": {
        "type": "snowflake",
        "view": "v_air_quality_current",
        "cacheTTL": 300000     // 5 min — dane live
      },
      "style": {
        "type": "circle",
        "paint": {
          "circle-color": ["step", ["get", "aqi"], "#22c55e", 2, "#eab308", 3, "#f97316", 4, "#ef4444"],
          "circle-radius": 10
        }
      },
      "chart": { "type": "timeseries", "query": "SELECT measure_date, value FROM raw_gios_measurements WHERE station_id = :id AND param_code = 'PM10' ORDER BY measure_date DESC LIMIT 48" },
      "kpi": { "field": "aqi_label", "label": "Jakość powietrza" },
      "interactive": true,
      "defaultVisible": true
    },
    {
      "id": "poi-hospitals",
      "name": "Szpitale",
      "group": "Infrastruktura",
      "source": {
        "type": "snowflake",
        "view": "raw_osm_pois",
        "where": "amenity_type = 'hospital'",
        "cacheTTL": 3600000
      },
      "style": { "type": "circle", "paint": { "circle-color": "#ef4444", "circle-radius": 6 } },
      "interactive": true,
      "popupFields": ["name", "estimated_population"],
      "defaultVisible": false
    },
    {
      "id": "h3-poi-density",
      "name": "Gęstość infrastruktury (H3)",
      "group": "Analityka H3",
      "source": {
        "type": "snowflake",
        "view": "v_h3_poi_density",
        "geoColumn": "hex_boundary",
        "cacheTTL": 3600000
      },
      "style": {
        "type": "fill-extrusion",
        "paint": {
          "fill-extrusion-color": ["interpolate", ["linear"], ["get", "poi_count"], 0, "#1e3a5f", 5, "#eab308", 15, "#ef4444"],
          "fill-extrusion-height": ["*", ["get", "poi_count"], 500],
          "fill-extrusion-opacity": 0.7
        }
      },
      "interactive": true,
      "popupFields": ["poi_count", "total_population", "amenity_types"],
      "defaultVisible": false
    },
    {
      "id": "h3-air-quality",
      "name": "Jakość powietrza — heatmap (H3)",
      "group": "Analityka H3",
      "source": {
        "type": "snowflake",
        "view": "v_h3_air_quality",
        "geoColumn": "hex_boundary",
        "cacheTTL": 300000
      },
      "style": {
        "type": "fill",
        "paint": {
          "fill-color": ["interpolate", ["linear"], ["get", "avg_value"], 0, "#22c55e", 50, "#eab308", 100, "#f97316", 150, "#ef4444"],
          "fill-opacity": 0.5
        }
      },
      "interactive": true,
      "popupFields": ["avg_value", "param_code"],
      "defaultVisible": false
    },
    {
      "id": "h3-risk-score",
      "name": "Wskaźnik ryzyka (H3)",
      "group": "Analityka H3",
      "source": {
        "type": "snowflake",
        "view": "v_h3_risk_score",
        "geoColumn": "hex_boundary",
        "cacheTTL": 300000
      },
      "style": {
        "type": "fill-extrusion",
        "paint": {
          "fill-extrusion-color": ["interpolate", ["linear"], ["get", "risk_score"], 0, "#22c55e", 50, "#eab308", 200, "#ef4444"],
          "fill-extrusion-height": ["*", ["get", "risk_score"], 100],
          "fill-extrusion-opacity": 0.6
        }
      },
      "interactive": true,
      "popupFields": ["total_population", "avg_pm10", "risk_score"],
      "defaultVisible": false
    }
    // ... kolejne warstwy
  ]
}
```

---

# FAZA 1: Uniwersalna platforma (Etapy 0–3)

## Etap 0: Scaffold + Snowflake setup (2h)

**Cel**: Projekt + Snowflake z danymi, gotowe do query.

- [ ] `pnpm create next-app@latest` + zależności:
  - `maplibre-gl react-maplibre @turf/turf swr recharts snowflake-sdk`
- [ ] shadcn/ui init + komponenty
- [ ] Dark theme
- [ ] **Snowflake setup**:
  - Konto free trial (30 dni, $400 credits)
  - Warehouse: `SZTAB_WH` (X-Small, auto-suspend 60s)
  - Database: `SZTAB_DB`, Schema: `PUBLIC`
  - Uruchomienie `snowflake/setup.sql` → tabele + views
- [ ] **Seed data**:
  - `scripts/fetch-boundaries.ts` → pobiera GeoJSON → upload na Snowflake stage → `COPY INTO raw_admin_boundaries`
  - `scripts/fetch-osm-pois.ts` → Overpass API → upload → `COPY INTO raw_osm_pois`
- [ ] `lib/snowflake.ts` — connection pool + query helper:
  ```typescript
  // Singleton connection, query z parametrami, zwraca typed rows
  export async function query<T>(sql: string, binds?: any[]): Promise<T[]>
  ```
- [ ] `lib/cache.ts` — in-memory Map z TTL:
  ```typescript
  export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>
  ```
- [ ] Fallback snapshots w `/public/data/fallback/`
- [ ] Deploy Vercel + env vars (SNOWFLAKE_ACCOUNT, USER, PASSWORD, WAREHOUSE, DATABASE)
- [ ] Commit + push

## Etap 1: Mapa + silnik warstw (3h)

**Cel**: Mapa renderuje warstwy z Snowflake dynamicznie.

- [ ] `DashboardMap.tsx` — MapLibre z OpenFreeMap tiles, centrum Lublin
- [ ] `GeoJsonLayer.tsx` — renderuje jedną warstwę (fill/circle/line)
- [ ] `H3HexLayer.tsx` — renderuje heksagony H3:
  - Dane z Snowflake: `v_h3_poi_density`, `v_h3_air_quality`, `v_h3_risk_score`
  - `hex_boundary` (GEOGRAPHY polygon) → GeoJSON → MapLibre fill/fill-extrusion
  - Obsługuje: flat heatmap (fill + color scale) i 3D (fill-extrusion + height z wartości)
  - Adaptive resolution: zoom < 10 → res 7, zoom ≥ 10 → res 9
- [ ] `h3-utils.ts`:
  - `pickH3Resolution(zoomLevel)` → resolution (5/7/9)
  - Konwersja Snowflake GEOGRAPHY → GeoJSON polygon (jeśli potrzebna)
- [ ] `/api/layers/[layerId]/route.ts`:
  - Czyta config warstwy z `layer-registry.json`
  - `source.type === "snowflake"` → query view + WHERE + cache z TTL
  - Konwertuje rows → GeoJSON FeatureCollection
  - Fallback: `/public/data/fallback/`
- [ ] `useLayers.ts` — toggle, opacity, order
- [ ] `useLayerData.ts` — SWR → `/api/layers/[id]`, refreshInterval z config
- [ ] `RegionSelector.tsx` — dropdown powiatów → flyTo
- [ ] `FeaturePopup.tsx` — popup z properties (wg `popupFields`)
- [ ] `layer-registry.ts` — ładuje config

**Wynik**: Mapa wyświetla warstwy admin + POI. Dane z Snowflake, cache'd.

## Etap 2: Dashboard layout + panel informacyjny (2.5h)

**Cel**: Sidebar z KPI, listami, filtrami — zasilany z Snowflake.

- [ ] `page.tsx` — mapa ~70% + sidebar ~30%
- [ ] `Sidebar.tsx` — collapsible, z Tabs (Warstwy | Dane | Wykresy)
- [ ] `LayerPanel.tsx` — toggle/opacity per warstwa, grupowanie
- [ ] `KpiGrid.tsx` + `KpiCard.tsx` — dynamiczne karty z `layer.kpi`
- [ ] `FeatureList.tsx` — tabela obiektów z aktywnej warstwy
  - Sortowanie, wyszukiwanie, kliknięcie → zoom
- [ ] `FilterPanel.tsx` — dynamiczne filtry z properties
- [ ] `DataTimestamp.tsx` — per warstwa
- [ ] `MapLegend.tsx` — generowana z config

## Etap 3: Dane live + wykresy + agregacje (2.5h)

**Cel**: Snowflake pipeline live + uniwersalne wykresy.

- [ ] Snowflake scheduled tasks:
  - Task `refresh_gios` co 5 min → fetch GIOŚ API → INSERT INTO raw_gios_measurements
  - Task `refresh_weather` co 10 min → fetch OpenMeteo → INSERT INTO raw_weather
  - (Implementowane jako external functions lub via API Route cron na Vercel)
- [ ] `/api/aggregate/route.ts`:
  - Parametry: `{ query: "poi_by_powiat" | "radius_search" | "stats", params: {...} }`
  - Radius search: `SELECT * FROM raw_osm_pois WHERE ST_DWITHIN(geo, ST_MAKEPOINT(:lon,:lat), :radius)`
  - Stats per powiat: query `v_powiat_stats`
- [ ] `TimeSeriesChart.tsx` — kliknięcie feature z `chart` → query Snowflake → wykres
- [ ] `BarChart.tsx` — porównanie powiatów (szpitale, szkoły, AQI)
- [ ] `StatCard.tsx` — wartość + trend
- [ ] `WindIndicator.tsx` — z danych weather
- [ ] `useAggregate.ts` — SWR hook do ad-hoc queries

**Wynik Fazy 1**: Kompletna platforma — dowolne warstwy z Snowflake, wykresy, filtry, KPI. Nowe źródło danych = nowa tabela + nowy wpis w rejestrze.

---

# FAZA 2: Scenariusz D — pożar przemysłowy (Etapy 4–6)

## Etap 4: Silnik scenariusza + warstwy kryzysowe (3-4h)

### 4a: Logika chmury (client-side turf.js)
- [ ] `lib/scenarios/toxic-cloud.ts`:
  - `generateToxicCloud(origin, windDir, windSpeed, hours)` → 3 strefy GeoJSON
  - Kształt: sektor + buffer, rośnie z czasem

### 4b: Analiza zagrożeń (Snowflake + H3)
- [ ] `/api/scenario/route.ts`:
  - Przyjmuje GeoJSON chmury → query Snowflake:
    ```sql
    -- Obiekty zagrożone (dokładne)
    SELECT * FROM raw_osm_pois 
    WHERE ST_WITHIN(geo, TO_GEOGRAPHY(:cloud_geojson))
    ```
  - Zwraca zagrożone obiekty z properties + strefą + dystansem
  - Agreguje: populacja per strefa, obiekty per typ
- [ ] **H3 analiza strefy zagrożenia**:
  ```sql
  -- Heksagony pokrywające chmurę toksyczną z risk score
  SELECT p.h3_res7, COUNT(*) as affected_pois, 
         SUM(p.estimated_population) as affected_pop,
         H3_CELL_TO_BOUNDARY(p.h3_res7) as hex_boundary
  FROM raw_osm_pois p
  WHERE ST_WITHIN(p.geo, TO_GEOGRAPHY(:cloud_geojson))
  GROUP BY p.h3_res7
  ```
  - Wizualizacja: heksagony w strefie chmury kolorowane wg zagrożenia
  - Daje efekt "heatmap zagrożenia" — bardziej analityczny niż zwykłe punkty

### 4c: UI scenariusza
- [ ] `useScenario.ts` — state: czas, play/pause, chmura, affected, stats
- [ ] `TimelineSlider.tsx` — 0-8h, play/pause
- [ ] `ScenarioPanel.tsx` — aktywuje scenariusz, dodaje warstwy dynamicznie
- [ ] `ThreatList.tsx` — tabela zagrożonych, klik → zoom
- [ ] KPI scenariusza w KpiGrid

## Etap 5: Dodatkowe warstwy + integracja (1.5h)

- [ ] Filtry scenariuszowe (strefa, typ, promień)
- [ ] Warstwa wiatru (strzałka na mapie)
- [ ] Stackowanie: admin + POI + środowisko + scenariusz

## Etap 6: Demo mode + polish (2h)

- [ ] `DemoMode.tsx`:
  1. Widok ogólny → warstwy admin + POI
  2. Zoom stacja GIOŚ → dane live z Snowflake
  3. Scenariusz → zoom Puławy → chmura → zagrożenia
  4. ~90s automatyczna animacja
- [ ] Animacje, loading states, error boundaries
- [ ] README.md

---

# FAZA 3: Bonusy

### Bonus 1: Kalkulator zasobów (+10 pkt, ~2h) — PRIORYTET
- Klik na mapę → punkt → suwak promienia
- Query Snowflake: `ST_DWITHIN(geo, point, radius)` na **dowolnych warstwach**
- Wynik: tabela + okrąg na mapie

### Bonus 2: Scraping danych publicznych (+10 pkt, ~2h)
- Nowe źródło → Snowflake table → nowa warstwa
- WIOŚ, GUS CSV, dane.gov.pl

### Bonus 3: Agent social media (+10 pkt, ~2h)
- Syntetyczne piny → Snowflake table → warstwa

### Bonus 4: Asystent głosowy (+10 pkt, ~3h)
- Web Speech API → komendy → akcje na mapie

---

## Źródła danych

| Dane | Źródło | Ingestion | Snowflake table | Refresh |
|------|--------|-----------|-----------------|---------|
| Granice admin. | ppatrzyk/polska-geojson | Seed script | raw_admin_boundaries | Jednorazowo |
| POI (szpitale, szkoły, DPS) | OSM Overpass | Seed script | raw_osm_pois | Jednorazowo |
| Jakość powietrza | GIOŚ API v1 | Scheduled task | raw_gios_measurements | 5 min |
| Pogoda + wiatr | Open-Meteo | Scheduled task | raw_weather | 10 min |
| Szpitale/łóżka | dane.gov.pl | Seed script | raw_hospitals_detail | Jednorazowo |
| Tło mapy | OpenFreeMap | Direct (tiles) | — | Live |

---

## Kluczowe decyzje

1. **Snowflake jako data backbone** — unified ingestion, analytics, geospatial. Nowe źródło = nowa tabela + task.
2. **H3 hexagonal grid** — agregacja geoprzestrzenna w heksagonach. Snowflake ma natywne H3 functions. Daje: heatmapy, risk scores, cross-layer korelacje. Wizualnie robi wrażenie (3D extrusion hexagons). Analitycznie solidne (uniform area, no edge effects).
3. **Layer registry** — config-driven warstwy, zero kodu per warstwa.
4. **Cache layer** — API Routes z TTL cache rozwiązuje latencję Snowflake.
5. **Platforma-first** — Faza 1 uniwersalna, scenariusz to plugin.
6. **Client-side simulation** — chmura toksyczna via turf.js (instant), analiza zagrożeń via Snowflake+H3 (cached).
7. **MapLibre + dark theme** — profesjonalny wygląd dashboardu kryzysowego. 3D hex extrusion wygląda spektakularnie na ciemnym tle.

---

## Weryfikacja

### Faza 1 (platforma):
1. `pnpm dev` → mapa z granicami z Snowflake, dark theme
2. LayerPanel → toggle szpitali → markery (dane z Snowflake)
3. Kliknięcie szpitala → popup z properties
4. Stacje GIOŚ → prawdziwe AQI (Snowflake → cache → mapa)
5. Kliknięcie stacji → wykres PM10 24h (query Snowflake)
6. BarChart: szpitale per powiat (Snowflake aggregate)
7. FilterPanel → filtruj per region → mapa się aktualizuje
8. Responsywność: tablet → sidebar jako sheet

### Faza 2 (scenariusz):
9. Scenariusz aktywowany → chmura + zagrożone obiekty
10. Timeline 0→8h → chmura rośnie (client) → affected query (Snowflake)
11. ThreatList + KPI aktualizują się
12. Demo mode → 90s animacja

### Infra:
13. Snowflake dashboard → tabele mają dane, tasks działają
14. `vercel deploy` → link publiczny, env vars ustawione
