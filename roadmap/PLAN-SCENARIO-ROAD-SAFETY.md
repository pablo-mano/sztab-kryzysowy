# Plan: Scenariusz C — Bezpieczeństwo drogowe i zarządzanie kryzysowe

## Context

Aplikacja Sztab Kryzysowy to geospatial decision dashboard dla Marszałka Woj. Lubelskiego (hackathon civil42.pl). Zaimplementowane są już:
- **Zestaw D** — Chmura toksyczna (Gaussian dispersion, ERPG, Puławy)
- **Zestaw A** — Powódź (ISOK, wodowskazy IMGW, strefy Q10/Q100/Q500)

Kolejny scenariusz to **Zestaw C — Bezpieczeństwo drogowe i zarządzanie kryzysowe**, który:
- Dane o wypadkach drogowych (KGP / dane publiczne)
- Korki i incydenty drogowe (symulowane / demonstracyjne)
- Lokalizacja jednostek PSP i OSP, strefy odpowiedzialności
- Cel: wyznaczyć najszybsze dysponowanie służb i alternatywne trasy ewakuacji przy blokadach dróg

**Dlaczego Zestaw C**: Dodaje zupełnie nowy wymiar do dashboardu (transport/drogi), komplementarny z istniejącymi scenariuszami (powódź blokuje drogi, chmura toksyczna wymaga ewakuacji drogowej). Tworzy cross-layer analysis: wypadki × jednostki PSP/OSP → czas dojazdu, blokady dróg × trasy alternatywne.

---

## Krok 1: Nowy typ scenariusza + rozszerzenie hooka

### 1a. Rozszerzenie `ScenarioType`
**Plik**: `frontend/src/types/scenario.ts`
- Dodać `"road-crisis"` do `ScenarioType`
- Nowy typ `RoadIncidentSeverity = "minor" | "major" | "critical"`
- Nowy typ `IncidentType = "accident" | "traffic_jam" | "road_closure" | "construction"`

### 1b. Rozszerzenie `useScenario.ts`
**Plik**: `frontend/src/hooks/useScenario.ts`
- Dodać stan dla road-crisis:
  - `selectedIncidentId: string | null` — aktualnie wybrany incydent
  - `dispatchRadius: number` — promień wyszukiwania jednostek (domyślnie 30 km)
  - `showAlternativeRoutes: boolean` — czy pokazywać trasy alternatywne
- W `selectScenario("road-crisis")`: ustawić domyślne wartości
- Nowa logika generowania stref:
  - Strefa czerwona (500m) — bezpośrednie zagrożenie wokół incydentu
  - Strefa pomarańczowa (2km) — strefa objazdu
  - Strefa żółta (5km) — strefa spowolnionego ruchu
- Promienie skalowane wg `severity`: minor ×0.5, major ×1.0, critical ×2.0

### 1c. Nowy moduł generowania stref
**Nowy plik**: `frontend/src/lib/scenarios/road-crisis.ts`

```typescript
interface RoadIncident {
  id: string;
  location: [number, number]; // [lng, lat]
  type: IncidentType;
  severity: RoadIncidentSeverity;
  description: string;
  timestamp: string;
  blockedRoads: string[];    // nazwy dróg zablokowanych
}

interface DispatchResult {
  unitId: string;
  unitName: string;
  unitType: "PSP" | "OSP";
  distance_km: number;
  estimated_time_min: number;
  location: [number, number];
}

function generateIncidentZones(incident: RoadIncident): ScenarioZone[]
function findNearestUnits(incident: RoadIncident, units: FireUnit[], radius_km: number): DispatchResult[]
```

Algorytm stref (turf.buffer wokół punktu incydentu):
- **Strefa zagrożenia** (`#ef4444`, opacity 0.4): `radius = 0.5km × severityFactor`
- **Strefa objazdu** (`#f97316`, opacity 0.25): `radius = 2km × severityFactor`
- **Strefa wpływu** (`#eab308`, opacity 0.12): `radius = 5km × severityFactor`

Algorytm dysponowania:
- Pobierz jednostki PSP/OSP z Snowflake w promieniu `dispatchRadius`
- Oblicz odległość (turf.distance) od incydentu
- Szacowany czas dojazdu: `distance_km / avgSpeed` (PSP: 60 km/h, OSP: 45 km/h)
- Sortuj po czasie dojazdu, zwróć top-5
- Uwzględnij blokady dróg — jeśli droga zablokowana, pomnóż czas ×1.5

---

## Krok 2: Nowe warstwy w layer-registry.json

**Plik**: `frontend/layer-registry.json` — dodać grupę "Transport" i "Służby ratunkowe":

### Grupa: Służby ratunkowe

1. **`emergency-psp`** (Jednostki PSP — Państwowa Straż Pożarna)
   - Source: `raw_fire_stations` WHERE `type = 'PSP'`
   - Styl: circle, `#ef4444`, radius 8, biała ramka
   - PopupFields: `name`, `address`, `vehicle_count`, `personnel_count`
   - Legenda: simple, "PSP", czerwony

2. **`emergency-osp`** (Jednostki OSP — Ochotnicza Straż Pożarna)
   - Source: `raw_fire_stations` WHERE `type = 'OSP'`
   - Styl: circle, `#f97316`, radius 6, biała ramka
   - PopupFields: `name`, `address`, `vehicle_count`
   - Legenda: simple, "OSP", pomarańczowy

### Grupa: Transport

3. **`road-accidents`** (Wypadki drogowe)
   - Source: `raw_road_accidents`
   - Styl: circle z kolorami wg `severity`:
     ```json
     ["match", ["get", "severity"],
       "critical", "#ef4444",
       "major", "#f97316",
       "minor", "#eab308",
       "#94a3b8"]
     ```
   - PopupFields: `date`, `road_name`, `severity`, `casualties`, `description`
   - Legenda: categorical — Krytyczny/Poważny/Drobny

4. **`road-incidents`** (Incydenty drogowe — bieżące)
   - Source: `v_road_incidents_active`
   - Styl: circle, pulsujący (duży radius + niska opacity), `#f43f5e`
   - PopupFields: `type`, `road_name`, `description`, `reported_at`, `status`
   - cacheTTL: 30000 (30s — "live" dane)
   - Legenda: categorical — Wypadek/Korek/Zamknięcie/Roboty

5. **`road-network`** (Sieć dróg głównych)
   - Source: `raw_roads_main`
   - Styl: line z kolorami wg `road_class`:
     ```json
     ["match", ["get", "road_class"],
       "expressway", "#22c55e",
       "national", "#3b82f6",
       "regional", "#8b5cf6",
       "#64748b"]
     ```
   - PopupFields: `road_number`, `road_name`, `road_class`, `length_km`
   - Legenda: categorical — Ekspresowa/Krajowa/Wojewódzka

### Grupa: Analityka H3

6. **`h3-accident-density`** (Gęstość wypadków H3)
   - Source: `v_h3_accident_density`, h3: true
   - Styl: fill z interpolacją (`#1e3a5f` → `#f97316` → `#ef4444`)
   - PopupFields: `accident_count`, `casualties_total`, `critical_pct`
   - Legenda: gradient — "Wypadki/km²"

---

## Krok 3: Tabele i widoki Snowflake

**Nowy plik**: `snowflake/sql/05-road-safety-tables.sql`

### Tabele:

```sql
-- Jednostki straży pożarnej (PSP + OSP)
CREATE TABLE IF NOT EXISTS raw_fire_stations (
  station_id    VARCHAR PRIMARY KEY,
  name          VARCHAR,
  type          VARCHAR,        -- 'PSP' | 'OSP'
  address       VARCHAR,
  powiat        VARCHAR,
  gmina         VARCHAR,
  latitude      FLOAT,
  longitude     FLOAT,
  vehicle_count INT,
  personnel_count INT,          -- NULL dla OSP (ochotnicy)
  geo           GEOGRAPHY,
  response_zone GEOGRAPHY       -- polygon strefy odpowiedzialności (Voronoi / bufor)
);

-- Wypadki drogowe (dane historyczne KGP)
CREATE TABLE IF NOT EXISTS raw_road_accidents (
  accident_id   VARCHAR PRIMARY KEY,
  date          DATE,
  time          TIME,
  latitude      FLOAT,
  longitude     FLOAT,
  road_name     VARCHAR,
  road_number   VARCHAR,
  road_class    VARCHAR,        -- 'expressway' | 'national' | 'regional' | 'local'
  severity      VARCHAR,        -- 'minor' | 'major' | 'critical'
  casualties    INT,
  injuries      INT,
  vehicles      INT,
  description   VARCHAR,
  weather       VARCHAR,        -- 'clear' | 'rain' | 'snow' | 'fog'
  light         VARCHAR,        -- 'day' | 'night' | 'dusk'
  cause         VARCHAR,
  geo           GEOGRAPHY
);

-- Incydenty drogowe (bieżące / symulowane)
CREATE TABLE IF NOT EXISTS raw_road_incidents (
  incident_id   VARCHAR PRIMARY KEY,
  type          VARCHAR,        -- 'accident' | 'traffic_jam' | 'road_closure' | 'construction'
  severity      VARCHAR,        -- 'minor' | 'major' | 'critical'
  road_name     VARCHAR,
  road_number   VARCHAR,
  latitude      FLOAT,
  longitude     FLOAT,
  description   VARCHAR,
  reported_at   TIMESTAMP_NTZ,
  resolved_at   TIMESTAMP_NTZ,  -- NULL = aktywny
  status        VARCHAR,        -- 'active' | 'resolved'
  blocked_lanes INT,
  geo           GEOGRAPHY
);

-- Sieć dróg głównych
CREATE TABLE IF NOT EXISTS raw_roads_main (
  road_id       VARCHAR PRIMARY KEY,
  road_number   VARCHAR,
  road_name     VARCHAR,
  road_class    VARCHAR,        -- 'expressway' | 'national' | 'regional'
  length_km     FLOAT,
  geo           GEOGRAPHY       -- LineString
);
```

### Widoki:

```sql
-- Aktywne incydenty drogowe
CREATE OR REPLACE VIEW v_road_incidents_active AS
SELECT incident_id, type, severity, road_name, road_number,
       latitude, longitude, description, reported_at, status,
       blocked_lanes, geo
FROM raw_road_incidents
WHERE status = 'active'
  OR resolved_at > DATEADD('hour', -2, CURRENT_TIMESTAMP());

-- Gęstość wypadków H3 (res7)
CREATE OR REPLACE VIEW v_h3_accident_density AS
SELECT
  H3_POINT_TO_CELL_STRING(TO_GEOGRAPHY(ST_MAKEPOINT(longitude, latitude)), 7) AS h3_index,
  H3_CELL_TO_BOUNDARY_WKT(h3_index) AS hex_boundary,
  COUNT(*) AS accident_count,
  SUM(casualties) AS casualties_total,
  SUM(injuries) AS injuries_total,
  ROUND(100.0 * SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) / COUNT(*), 1) AS critical_pct
FROM raw_road_accidents
WHERE date >= DATEADD('year', -2, CURRENT_DATE())
GROUP BY h3_index;

-- Statystyki wypadków per powiat (do KPI)
CREATE OR REPLACE VIEW v_accidents_by_powiat AS
SELECT
  b.name AS powiat,
  COUNT(a.accident_id) AS accident_count,
  SUM(a.casualties) AS casualties_total,
  SUM(a.injuries) AS injuries_total,
  ROUND(AVG(a.casualties + a.injuries), 2) AS avg_victims_per_accident
FROM raw_road_accidents a
JOIN raw_admin_boundaries b
  ON ST_WITHIN(a.geo, b.geo) AND b.level = 'powiat'
WHERE a.date >= DATEADD('year', -1, CURRENT_DATE())
GROUP BY b.name;

-- Najbliższe jednostki do incydentu (funkcja, nie widok)
-- Wywoływana z parametrem lokalizacji incydentu
CREATE OR REPLACE VIEW v_fire_station_coverage AS
SELECT
  s.station_id, s.name, s.type, s.powiat,
  s.vehicle_count, s.personnel_count,
  s.latitude, s.longitude, s.geo,
  -- Statystyka: ile wypadków w promieniu 15km od stacji (last year)
  (SELECT COUNT(*)
   FROM raw_road_accidents a
   WHERE ST_DISTANCE(a.geo, s.geo) < 15000
     AND a.date >= DATEADD('year', -1, CURRENT_DATE())
  ) AS nearby_accidents_year
FROM raw_fire_stations s;
```

---

## Krok 4: Dane demo (seed)

**Nowy plik**: `snowflake/seed/seed-road-safety-data.sql`

### 4a. Jednostki PSP (dane rzeczywiste z OSM/KG PSP)
Woj. lubelskie ma ~20 jednostek PSP. Seed z realnymi lokalizacjami:
- KM PSP Lublin (ul. Szczerbowskiego)
- KP PSP Puławy, Świdnik, Kraśnik, Zamość, Biała Podlaska, Chełm, Łuków, Tomaszów Lub., Janów Lub., Biłgoraj, Hrubieszów, Włodawa, Radzyń Podlaski, Lubartów, Opole Lubelskie, Ryki, Parczew, Łęczna, Krasnystaw
- Każda z: `vehicle_count` 3-8, `personnel_count` 30-80

### 4b. Jednostki OSP (demonstracyjne, ~60 punktów)
Losowe rozmieszczenie w gminach wiejskich, `vehicle_count` 1-3, bez `personnel_count`.

### 4c. Wypadki drogowe (syntetyczne, ~500 rekordów)
Bazowane na realnej statystyce KGP dla Lubelskiego:
- Zagęszczenie wzdłuż dróg S12, S17, S19, DK17, DK19, DK82
- Rozkład severity: 60% minor, 30% major, 10% critical
- Sezonowość: więcej latem (turystyka), zimą (warunki)
- Atrybuty: pogoda, oświetlenie, przyczyna

### 4d. Incydenty drogowe (bieżące, 8-12 aktywnych)
Symulowane "live" incydenty:
- 3-4 wypadki (różne severity)
- 2-3 korki (S17 pod Lublinem, DK19 Lubartów)
- 1-2 zamknięcia dróg (remont mostu, roboty)
- 1 zamknięcie kryzysowe (np. kolizja TIR-ów na S12)

### 4e. Sieć dróg głównych (LineString z OSM)
Kluczowe drogi woj. lubelskiego:
- **S12** (Piotrków → Lublin → Chełm → granica)
- **S17** (Warszawa → Lublin → Piaski)
- **S19** (Lublin → Kraśnik → Rzeszów)
- **DK17** (Lublin → Zamość → Hrubieszów)
- **DK19** (Lublin → Lubartów → Radzyń Podlaski)
- **DK82** (Lublin → Łęczna → Włodawa)
- **DK74** (Kraśnik → Janów Lubelski → Biłgoraj)
- ~10-12 dróg wojewódzkich

---

## Krok 5: Nowe komponenty UI

### 5a. RoadCrisisControls.tsx
**Nowy plik**: `frontend/src/components/scenario/RoadCrisisControls.tsx`

Zawartość:
- **Lista aktywnych incydentów** — karty z ikoną typu, nazwą drogi, severity badge
  - Klik na incydent → flyTo + zaznaczenie + generowanie stref
- **Slider: promień dysponowania** (10-50 km, domyślnie 30)
- **Toggle: pokaż trasy alternatywne**
- **Panel dysponowania** (po wybraniu incydentu):
  - Lista top-5 najbliższych jednostek PSP/OSP
  - Dla każdej: nazwa, typ (PSP/OSP badge), odległość, szacowany czas dojazdu
  - Linia na mapie od jednostki do incydentu (opcjonalnie)
- **Statystyki** (mini KPI):
  - Aktywne incydenty: X
  - Zablokowane drogi: X
  - Jednostki w gotowości: X

### 5b. Rozszerzenie ScenarioPanel.tsx
**Plik**: `frontend/src/components/scenario/ScenarioPanel.tsx`
- Dodać trzecią kartę scenariusza:
  - Ikona: `Car` (lucide) lub `AlertTriangle`
  - Tytuł: "Bezpieczeństwo drogowe"
  - Opis: "Wypadki, incydenty drogowe i dysponowanie służb PSP/OSP. Analiza czasu dojazdu i tras alternatywnych."
  - Kolor: pomarańczowy (#f97316)
- Routing do `RoadCrisisControls` gdy `scenarioType === "road-crisis"`
- Blok źródeł danych:
  - Wypadki — dane syntetyczne oparte na statystykach KGP
  - Jednostki PSP — KG PSP / OSM
  - Incydenty — dane demonstracyjne symulujące GDDKiA/ruch
  - Sieć dróg — OpenStreetMap

### 5c. Rozszerzenie ThreatList.tsx
**Plik**: `frontend/src/components/scenario/ThreatList.tsx`
- Dla scenariusza `road-crisis`:
  - Zamiast "zagrożona populacja" → "obiekty w strefie incydentu"
  - Dodać sekcję "Dysponowanie" z listą jednostek
  - Czas dojazdu najszybszej jednostki jako KPI

---

## Krok 6: Nowe API i rozszerzenie istniejących

### 6a. Endpoint: `/api/dispatch`
**Nowy plik**: `frontend/src/app/api/dispatch/route.ts`

```typescript
// POST /api/dispatch
// Body: { lat, lng, radius_km, severity }
// Response: { units: DispatchResult[], alternativeRoutes: Route[] }

// SQL: znajdź jednostki PSP/OSP w promieniu, oblicz odległość
SELECT
  s.station_id, s.name, s.type, s.vehicle_count,
  s.latitude, s.longitude,
  ST_DISTANCE(s.geo, TO_GEOGRAPHY(ST_MAKEPOINT(:lng, :lat))) / 1000 AS distance_km
FROM raw_fire_stations s
WHERE ST_DISTANCE(s.geo, TO_GEOGRAPHY(ST_MAKEPOINT(:lng, :lat))) < :radius_m
ORDER BY distance_km
LIMIT 10;
```

### 6b. Rozszerzenie `/api/scenario/route.ts`
**Plik**: `frontend/src/app/api/scenario/route.ts`
- Dodać obsługę `scenarioType: "road-crisis"`
- Dla tego typu: zliczaj POI w strefach + dodaj pole `nearest_units` z `/api/dispatch`

### 6c. Rozszerzenie `/api/layers/[layerId]/route.ts`
- Obsługa nowych warstw (fire stations, accidents, incidents, roads) — standardowa ścieżka z layer-registry.json, nie wymaga specjalnej logiki

---

## Krok 7: Nowy hook `useDispatch`

**Nowy plik**: `frontend/src/hooks/useDispatch.ts`

```typescript
interface UseDispatchResult {
  units: DispatchResult[];
  loading: boolean;
  error: string | null;
}

function useDispatch(
  incidentLocation: [number, number] | null,
  radiusKm: number,
  severity: RoadIncidentSeverity | null
): UseDispatchResult
```

- SWR fetch do `/api/dispatch`
- Debounce 300ms na zmianę promienia
- Cache: 60s (jednostki się nie przemieszczają szybko)

---

## Krok 8: Rozszerzenie mapy

### 8a. DashboardMap.tsx — linie dysponowania
**Plik**: `frontend/src/components/map/DashboardMap.tsx`
- Gdy scenariusz `road-crisis` aktywny i incydent wybrany:
  - Rysuj linie (dashed) od wybranych jednostek do incydentu
  - Kolor linii: PSP → czerwony, OSP → pomarańczowy
  - Etykieta na linii: szacowany czas dojazdu

### 8b. Flyto na incydent
**Plik**: `frontend/src/app/page.tsx`
- Gdy `scenarioType === "road-crisis"` i `selectedIncidentId` się zmieni:
  - `map.flyTo({ center: incidentLocation, zoom: 13 })`

---

## Krok 9: Integracja cross-layer

### 9a. Filtrowanie POI w strefie incydentu
Analogicznie do `FLOOD_FILTERABLE_LAYERS` w `page.tsx`:
- Dodać `ROAD_CRISIS_FILTERABLE_LAYERS` = szkoły, szpitale, DPS, przedszkola
- Gdy incydent aktywny → filtruj POI do strefy wpływu (5km)
- Pokaż w ThreatList ile obiektów wrażliwych jest w strefie

### 9b. Cross-scenario: wypadek + powódź
- Jeśli wypadek jest w strefie zalewowej → dodać badge "Strefa powodziowa"
- Czas dojazdu ×2.0 jeśli trasa przebiega przez strefę zalewową

---

## Pliki do modyfikacji (summary)

| Plik | Akcja |
|------|-------|
| `frontend/src/types/scenario.ts` | EDIT — dodać `"road-crisis"`, nowe typy |
| `frontend/src/lib/scenarios/road-crisis.ts` | **NOWY** — generowanie stref, dysponowanie |
| `frontend/src/hooks/useScenario.ts` | EDIT — road-crisis params, selectScenario |
| `frontend/src/hooks/useDispatch.ts` | **NOWY** — hook dysponowania jednostek |
| `frontend/src/components/scenario/RoadCrisisControls.tsx` | **NOWY** — UI kontrolki |
| `frontend/src/components/scenario/ScenarioPanel.tsx` | EDIT — 3. karta + routing |
| `frontend/src/components/scenario/ThreatList.tsx` | EDIT — wariant road-crisis |
| `frontend/src/components/map/DashboardMap.tsx` | EDIT — linie dysponowania |
| `frontend/src/app/page.tsx` | EDIT — handlery, flyTo, filterable layers |
| `frontend/src/app/api/dispatch/route.ts` | **NOWY** — endpoint dysponowania |
| `frontend/src/app/api/scenario/route.ts` | EDIT — obsługa road-crisis |
| `frontend/layer-registry.json` | EDIT — 6 nowych warstw |
| `snowflake/sql/05-road-safety-tables.sql` | **NOWY** — tabele + widoki |
| `snowflake/seed/seed-road-safety-data.sql` | **NOWY** — dane demo |

---

## Kolejność implementacji (priorytet)

1. **Snowflake**: tabele + seed data (bez danych nic nie działa)
2. **layer-registry.json**: definicje warstw (natychmiast widoczne na mapie)
3. **API dispatch**: endpoint dysponowania
4. **road-crisis.ts**: logika stref i dysponowania
5. **useScenario.ts + useDispatch.ts**: stan scenariusza
6. **RoadCrisisControls.tsx**: UI kontrolek
7. **ScenarioPanel.tsx**: trzecia karta
8. **DashboardMap.tsx**: linie dysponowania
9. **page.tsx**: integracja + flyTo
10. **Cross-layer**: filtrowanie POI, cross-scenario

---

## Weryfikacja

1. **Regresja**: scenariusze toxic-cloud i flood działają bez zmian
2. **Nowy scenariusz**:
   - 3. karta w panelu scenariuszy → klik → aktywacja road-crisis
   - Lista aktywnych incydentów w panelu
   - Klik na incydent → flyTo, strefy na mapie, panel dysponowania
   - Top-5 jednostek z czasem dojazdu
   - Slider promienia zmienia wyniki
3. **Nowe warstwy**: PSP, OSP, wypadki, incydenty, drogi główne — widoczne na mapie
4. **H3**: heatmapa gęstości wypadków
5. **Cross-layer**: filtrowane POI w strefie incydentu w ThreatList
6. **Dev server**: `cd frontend && npm run dev` — pełny test w przeglądarce
