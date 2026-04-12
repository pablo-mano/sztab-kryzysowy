# Plan: Scenariusz B — Pożar w muzeum – ewakuacja dzieł sztuki

## Context

Aplikacja Sztab Kryzysowy to geospatial decision dashboard dla Marszałka Woj. Lubelskiego (hackathon civil42.pl). Obecnie zaimplementowane są:
- **Zestaw D** — pożar przemysłowy / chmura toksyczna (Gaussian plume, Puławy)
- **Zestaw A** — kryzys medyczny w warunkach powodzi (ISOK, wodowskazy IMGW)

Kolejny scenariusz to **Zestaw B — Pożar w muzeum – ewakuacja dzieł sztuki**, który:

- Dodaje nową warstwę POI: muzea i zbiory chronione w woj. lubelskim
- Wprowadza scenariusz pożaru w konkretnym muzeum z symulacją strefy zagrożenia
- Wyznacza priorytety ewakuacji dzieł (klasa ochrony, wartość, wrażliwość)
- Oblicza trasy transportu do magazynów awaryjnych
- Pokazuje strefy odcięcia i drogi dojazdu służb ratowniczych

**Dlaczego Zestaw B**: Wprowadza unikalną domenę (ochrona dziedzictwa kulturowego), która odróżnia nas od typowych scenariuszy kryzysowych. Wymaga cross-layer analysis (muzea × jednostki PSP × drogi × magazyny awaryjne). Lubelskie ma bogaty zasób muzealny (Muzeum Lubelskie, Muzeum na Majdanku, Muzeum Nadwiślańskie w Kazimierzu).

---

## Stan obecny — co już mamy i co reusujemy

| Istniejący element | Reuse w Zestawie B |
|---|---|
| `ScenarioType` w `types/scenario.ts` | Dodajemy `"museum-fire"` |
| `useScenario.ts` — multi-scenario hook | Rozszerzamy o parametry pożaru muzealnego |
| `ScenarioPanel.tsx` — selektor scenariuszy | Dodajemy trzecią kartę: "Pożar w muzeum" |
| `/api/scenario/route.ts` — impact analysis | Rozszerzamy o logikę ewakuacji dzieł |
| `DashboardMap.tsx` — renderowanie stref | Strefy pożarowe renderowane identycznie jak inne scenariusze |
| `ThreatList.tsx` — lista zagrożeń per strefa | Dostosowujemy do wyświetlania zagrożonych zbiorów |
| `layer-registry.json` — deklaratywne warstwy | Dodajemy 4 nowe warstwy |
| Snowflake `raw_osm_pois` + spatial queries | Nowe tabele muzeów z metadanymi kolekcji |
| `geo-utils.ts` — Turf.js operacje | Buffer stref pożarowych, routing |

---

## Krok 1: Dane — tabele Snowflake i seed

### 1a. Nowa tabela: `raw_museums`
**Nowy plik**: `snowflake/sql/05-museum-fire-tables.sql`

```sql
CREATE TABLE IF NOT EXISTS raw_museums (
  museum_id       VARCHAR(50) PRIMARY KEY,
  name            VARCHAR(200) NOT NULL,
  museum_type     VARCHAR(50),       -- 'sztuka','historia','etnografia','martyrologia','archeologia','skansen'
  protection_class VARCHAR(10),       -- 'A' (najwyższa) / 'B' / 'C'
  total_objects    INTEGER,           -- łączna liczba eksponatów
  priority_objects INTEGER,           -- obiekty klasy A (bezcenne)
  has_sprinklers   BOOLEAN DEFAULT FALSE,
  has_fire_alarm   BOOLEAN DEFAULT TRUE,
  fire_resistance_minutes INTEGER DEFAULT 30, -- czas odporności budynku
  address         VARCHAR(300),
  city            VARCHAR(100),
  powiat          VARCHAR(100),
  latitude        DOUBLE,
  longitude       DOUBLE,
  geo             GEOGRAPHY
);
```

### 1b. Nowa tabela: `raw_emergency_storages`
```sql
CREATE TABLE IF NOT EXISTS raw_emergency_storages (
  storage_id      VARCHAR(50) PRIMARY KEY,
  name            VARCHAR(200),
  storage_type    VARCHAR(50),       -- 'klimatyzowany','suchy','tymczasowy'
  capacity_m2     INTEGER,           -- pojemność w m²
  climate_control BOOLEAN DEFAULT FALSE, -- kontrola temperatury/wilgotności
  security_level  VARCHAR(10),       -- 'wysoki','średni','podstawowy'
  city            VARCHAR(100),
  latitude        DOUBLE,
  longitude       DOUBLE,
  geo             GEOGRAPHY
);
```

### 1c. Nowa tabela: `raw_fire_stations`
```sql
CREATE TABLE IF NOT EXISTS raw_fire_stations (
  station_id      VARCHAR(50) PRIMARY KEY,
  name            VARCHAR(200),
  station_type    VARCHAR(10),       -- 'PSP' (zawodowa) / 'OSP' (ochotnicza)
  response_time_min INTEGER,         -- szacowany czas dojazdu (minuty)
  has_ladder_truck BOOLEAN DEFAULT FALSE,  -- drabina mechaniczna
  has_hazmat_unit BOOLEAN DEFAULT FALSE,   -- jednostka chem-eko
  personnel_count INTEGER,
  city            VARCHAR(100),
  latitude        DOUBLE,
  longitude       DOUBLE,
  geo             GEOGRAPHY
);
```

### 1d. Nowa tabela: `raw_museum_collections`
Detale kolekcji per muzeum (dla priorytetyzacji ewakuacji):
```sql
CREATE TABLE IF NOT EXISTS raw_museum_collections (
  collection_id   VARCHAR(50) PRIMARY KEY,
  museum_id       VARCHAR(50) REFERENCES raw_museums(museum_id),
  collection_name VARCHAR(200),
  category        VARCHAR(50),       -- 'malarstwo','rzeźba','rękopisy','archeologia','etnografia','fotografia'
  object_count    INTEGER,
  protection_priority INTEGER,       -- 1 (najwyższy) - 5 (najniższy)
  weight_class    VARCHAR(20),       -- 'lekkie' (<5kg), 'średnie' (5-50kg), 'ciężkie' (>50kg)
  climate_sensitive BOOLEAN DEFAULT FALSE, -- wymaga kontroli klimatu w transporcie
  estimated_evac_time_min INTEGER    -- szacowany czas ewakuacji kolekcji
);
```

### 1e. Seed data
**Nowy plik**: `snowflake/seed/seed-museum-fire-data.sql`

**Muzea woj. lubelskiego** (~15-20 obiektów, dane z OSM + NID):

| Muzeum | Miasto | Klasa | Obiekty | Typ |
|---|---|---|---|---|
| Muzeum Lubelskie (Zamek) | Lublin | A | 12000 | sztuka, historia |
| Muzeum Wsi Lubelskiej (skansen) | Lublin | B | 3500 | etnografia |
| Muzeum Narodowe w Lublinie | Lublin | A | 8000 | sztuka |
| Muzeum na Majdanku | Lublin | A | 25000 | martyrologia |
| Muzeum Nadwiślańskie | Kazimierz Dolny | A | 6000 | sztuka |
| Muzeum Zamoyskich | Kozłówka | A | 15000 | sztuka, rzemiosło |
| Muzeum Regionalne | Puławy | B | 2000 | historia |
| Muzeum Czartoryskich (Pałac) | Puławy | A | 4000 | sztuka |
| Muzeum Pojezierza Łęczyńsko-Włodawskiego | Włodawa | C | 800 | etnografia |
| Muzeum Zamojskie | Zamość | B | 5000 | historia, sztuka |
| Muzeum Diecezjalne | Zamość | B | 3000 | sztuka sakralna |
| Muzeum Regionalne | Biała Podlaska | C | 1200 | historia |
| Muzeum Południowego Podlasia | Biała Podlaska | C | 900 | etnografia |
| Muzeum Barwy i Oręża | Chełm | B | 2500 | historia militarna |
| Galeria Biała | Lublin | C | 500 | sztuka współczesna |

**Magazyny awaryjne** (~5 obiektów, syntetyczne):

| Nazwa | Miasto | Typ | Pojemność | Klimat |
|---|---|---|---|---|
| Magazyn Wojewódzki MKiDN | Lublin | klimatyzowany | 500 m² | tak |
| Piwnice Zamku Lubelskiego | Lublin | suchy | 200 m² | nie |
| Hala Targowa (rezerwowa) | Lublin | tymczasowy | 1000 m² | nie |
| Magazyn konserwatorski | Zamość | klimatyzowany | 300 m² | tak |
| Baza logistyczna WKZ | Puławy | suchy | 400 m² | nie |

**Jednostki PSP** (~8-10, dane z OSM):
- KP PSP Lublin (centrum), KP PSP Lublin (Bronowice)
- KP PSP Puławy, KP PSP Zamość, KP PSP Chełm
- KP PSP Kraśnik, KP PSP Biała Podlaska
- + kilka OSP w pobliżu kluczowych muzeów

---

## Krok 2: Nowe warstwy w layer-registry.json

**Plik**: `frontend/layer-registry.json` — dodać 4 warstwy w nowej grupie **"Dziedzictwo kulturowe"**:

### 2a. `poi-museums` — Muzea i zbiory chronione
```json
{
  "id": "poi-museums",
  "name": "Muzea i zbiory chronione",
  "group": "Dziedzictwo kulturowe",
  "defaultVisible": false,
  "modes": ["points"],
  "style": {
    "type": "circle",
    "paint": {
      "circle-radius": 7,
      "circle-color": "#a855f7",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff"
    }
  },
  "source": {
    "table": "raw_museums",
    "columns": ["museum_id", "name", "museum_type", "protection_class", "total_objects", "priority_objects", "has_sprinklers", "fire_resistance_minutes", "city"],
    "latColumn": "latitude",
    "lonColumn": "longitude",
    "geoColumn": "geo"
  },
  "legend": {
    "type": "categorical",
    "title": "Klasa ochrony",
    "items": [
      { "label": "Klasa A (najwyższa)", "color": "#dc2626" },
      { "label": "Klasa B", "color": "#f59e0b" },
      { "label": "Klasa C", "color": "#22c55e" }
    ]
  },
  "popup": {
    "title": "name",
    "fields": ["museum_type", "protection_class", "total_objects", "priority_objects", "city"]
  },
  "cacheTTL": 3600000
}
```

### 2b. `poi-fire-stations` — Jednostki PSP/OSP
```json
{
  "id": "poi-fire-stations",
  "name": "Jednostki straży pożarnej",
  "group": "Dziedzictwo kulturowe",
  "defaultVisible": false,
  "modes": ["points"],
  "style": {
    "type": "circle",
    "paint": {
      "circle-radius": 6,
      "circle-color": "#ef4444",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fbbf24"
    }
  },
  "source": {
    "table": "raw_fire_stations",
    "columns": ["station_id", "name", "station_type", "response_time_min", "has_ladder_truck", "personnel_count", "city"],
    "latColumn": "latitude",
    "lonColumn": "longitude",
    "geoColumn": "geo"
  },
  "popup": {
    "title": "name",
    "fields": ["station_type", "response_time_min", "has_ladder_truck", "personnel_count"]
  },
  "cacheTTL": 3600000
}
```

### 2c. `poi-emergency-storages` — Magazyny awaryjne
```json
{
  "id": "poi-emergency-storages",
  "name": "Magazyny awaryjne",
  "group": "Dziedzictwo kulturowe",
  "defaultVisible": false,
  "modes": ["points"],
  "style": {
    "type": "circle",
    "paint": {
      "circle-radius": 6,
      "circle-color": "#06b6d4",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff"
    }
  },
  "source": {
    "table": "raw_emergency_storages",
    "columns": ["storage_id", "name", "storage_type", "capacity_m2", "climate_control", "security_level", "city"],
    "latColumn": "latitude",
    "lonColumn": "longitude",
    "geoColumn": "geo"
  },
  "popup": {
    "title": "name",
    "fields": ["storage_type", "capacity_m2", "climate_control", "security_level"]
  },
  "cacheTTL": 3600000
}
```

### 2d. `h3-museum-density` — Gęstość dziedzictwa H3 (opcjonalnie)
```json
{
  "id": "h3-museum-density",
  "name": "Gęstość dziedzictwa kulturowego",
  "group": "Analityka H3",
  "defaultVisible": false,
  "modes": ["h3"],
  "style": {
    "type": "fill",
    "paint": {
      "fill-color": ["interpolate", ["linear"], ["get", "total_objects"],
        0, "#1e1b4b",
        1000, "#7c3aed",
        5000, "#c084fc",
        15000, "#fbbf24"
      ],
      "fill-opacity": 0.5
    }
  },
  "source": {
    "view": "v_h3_museum_density",
    "geoColumn": "hex_boundary",
    "h3": true
  },
  "cacheTTL": 3600000
}
```

---

## Krok 3: Model symulacji pożaru muzealnego

### 3a. Nowy plik: `frontend/src/lib/scenarios/museum-fire.ts`

Scenariusz pożaru w muzeum generuje strefy zagrożenia wokół wybranego budynku:

```typescript
export interface MuseumFireParams {
  museumId: string;
  museumCenter: [number, number]; // [lng, lat]
  fireIntensity: "low" | "medium" | "high" | "extreme";
  windSpeed: number;       // m/s
  windDirection: number;   // stopnie (0=N)
  hours: number;           // 0-4h (pożar rozwija się szybciej niż powódź)
  buildingArea: number;    // m² powierzchni muzeum
}

export function generateMuseumFireZones(params: MuseumFireParams): ScenarioZone[]
```

**3 strefy pożarowe:**

| Strefa | ID | Kolor | Opacity | Promień bazowy | Opis |
|---|---|---|---|---|---|
| Strefa ognia | `fire-core` | `#DC2626` (czerwony) | 0.5 | 50-150m | Bezpośrednie zagrożenie ogniem i zawaleniem |
| Strefa odcięcia | `fire-exclusion` | `#F97316` (pomarańczowy) | 0.3 | 150-400m | Zamknięta dla osób postronnych, dojazd służb |
| Strefa ewakuacji | `fire-evacuation` | `#FBBF24` (żółty) | 0.15 | 400-800m | Ewakuacja prewencyjna, punkt zbiórki |

**Logika kształtu strefy:**
- Strefa ognia: elipsa wydłużona w kierunku wiatru (1:1.5)
- Strefa odcięcia: buffer wokół strefy ognia z asymetrią wiatrową
- Strefa ewakuacji: zewnętrzny buffer
- Promienie skalowane przez: `fireIntensity`, `hours`, `windSpeed`

```typescript
const FIRE_INTENSITY_FACTOR = {
  low: 0.5,
  medium: 1.0,
  high: 1.5,
  extreme: 2.5
};

// Promienie rosną logarytmicznie z czasem (pożar ma fazę wzrostu → plateau)
const timeFactor = Math.min(1, Math.log2(1 + hours * 2));

// Wiatr wydłuża strefę w kierunku z wiatrem
const windElongation = 1 + windSpeed * 0.1;
```

### 3b. Wybór muzeum jako "cel" scenariusza

W odróżnieniu od toxic-cloud (stały punkt: Puławy) i flood (cała dolina Wisły), scenariusz B wymaga **wyboru konkretnego muzeum** z listy:

**Nowy komponent**: `MuseumSelector.tsx`
- Dropdown z listą muzeów (pobranych z warstwy `poi-museums`)
- Po wybraniu: mapa flyTo do lokalizacji muzeum
- Wyświetla kartę informacyjną: nazwa, klasa ochrony, liczba obiektów, czas odporności ogniowej

---

## Krok 4: Analiza wpływu — priorytetyzacja ewakuacji

### 4a. Rozszerzenie `/api/scenario/route.ts`

Dla `scenarioType: "museum-fire"`:

```typescript
// 1. Znajdź muzeum i jego kolekcje
const museum = await queryMuseum(museumId);
const collections = await queryCollections(museumId);

// 2. Oblicz priorytety ewakuacji kolekcji
const evacPlan = collections
  .sort((a, b) => {
    // Priorytet: klasa ochrony → waga (lekkie pierwsze) → wrażliwość klimatyczna
    return a.protection_priority - b.protection_priority
      || WEIGHT_ORDER[a.weight_class] - WEIGHT_ORDER[b.weight_class];
  })
  .map((col, idx) => ({
    ...col,
    evacuation_order: idx + 1,
    estimated_start_min: accumulatedTime,  // kiedy zacząć ewakuować
    destination: selectStorage(col),       // który magazyn awaryjny
  }));

// 3. Znajdź najbliższe jednostki PSP w strefie
const nearbyStations = await querySpatial(
  'raw_fire_stations',
  zoneGeoJson,
  'ST_DISTANCE'
);

// 4. Znajdź najbliższe magazyny awaryjne + odległości
const storages = await queryStoragesWithDistance(museumCenter);
```

### 4b. Nowy endpoint: `/api/museum-fire/route.ts`

Dedykowany endpoint dla logiki ewakuacji dzieł:

```typescript
// POST /api/museum-fire
// Body: { museumId, fireIntensity, hours }
// Response:
{
  museum: { name, totalObjects, protectionClass, fireResistance },
  evacuationPlan: [
    {
      collection: "Malarstwo XVII w.",
      priority: 1,
      objectCount: 120,
      weightClass: "lekkie",
      climateSensitive: true,
      estimatedEvacTime: 15,     // minut
      recommendedStorage: "Magazyn Wojewódzki MKiDN",
      storageDistance: 3.2,      // km
      evacuationOrder: 1
    },
    // ...
  ],
  nearestFireStations: [
    { name: "KP PSP Lublin", distance: 1.8, responseTime: 5, hasLadder: true },
    // ...
  ],
  nearestStorages: [
    { name: "Magazyn Wojewódzki MKiDN", distance: 3.2, climateControl: true, availableCapacity: 500 },
    // ...
  ],
  timeConstraints: {
    fireResistanceMinutes: 30,
    totalEvacTimeMinutes: 85,
    isEvacuationFeasible: false,  // czy można ewakuować wszystko w czasie odporności ogniowej
    priorityEvacObjects: 320      // ile obiektów zdążymy ewakuować
  }
}
```

---

## Krok 5: Nowe komponenty UI

### 5a. `MuseumFireControls.tsx`
**Nowy plik**: `frontend/src/components/scenario/MuseumFireControls.tsx`

Kontrolki scenariusza pożaru:
- **Wybór muzeum** — dropdown z filtrowaną listą (MuseumSelector)
- **Intensywność pożaru** — 4-stopniowy selektor (niska/średnia/wysoka/ekstremalna)
- **Kierunek i prędkość wiatru** — reuse istniejącego WindIndicator + sliderów
- **Timeline** — slider 0-4h (krok 15min)
- **Karta muzeum** — po wyborze: klasa ochrony, liczba obiektów, odporność ogniowa

### 5b. `EvacuationPlan.tsx`
**Nowy plik**: `frontend/src/components/scenario/EvacuationPlan.tsx`

Panel priorytetów ewakuacji (w ScenarioSidebar):
- **Progress bar**: czas odporności ogniowej vs szacowany czas ewakuacji
- **Lista kolekcji** posortowana wg priorytetu ewakuacji:
  - Kolor priorytetu (1=czerwony, 2=pomarańczowy, 3=żółty, 4=zielony, 5=szary)
  - Nazwa kolekcji, liczba obiektów, waga, wrażliwość klimatyczna
  - Przypisany magazyn awaryjny
  - Znacznik: "zdąży się ewakuować" / "zagrożone"
- **Podsumowanie**: ile obiektów można uratować / ile jest zagrożonych

### 5c. `NearestServices.tsx`
**Nowy plik**: `frontend/src/components/scenario/NearestServices.tsx`

Lista najbliższych zasobów:
- Jednostki PSP/OSP z odległością i czasem dojazdu
- Magazyny awaryjne z pojemnością i typem
- Ikony: drabina mechaniczna, kontrola klimatu, itp.

### 5d. Rozszerzenie ScenarioPanel.tsx — trzecia karta
**Plik**: `frontend/src/components/scenario/ScenarioPanel.tsx`
- Gdy `!active`: 3 karty scenariuszy:
  - "Pożar przemysłowy — Puławy" (istniejąca)
  - "Powódź — Dolina Wisły" (istniejąca)
  - **"Pożar w muzeum — Ewakuacja zbiorów"** (nowa, ikona 🏛️)
- Gdy aktywny `museum-fire`: `MuseumFireControls` + `EvacuationPlan` + `NearestServices`

---

## Krok 6: Rozszerzenie useScenario.ts

**Plik**: `frontend/src/hooks/useScenario.ts`

Nowe pola stanu:
```typescript
// Dodać do ScenarioState:
museumId: string | null;
fireIntensity: "low" | "medium" | "high" | "extreme";
selectedMuseum: MuseumInfo | null;  // cache danych muzeum po wyborze

// Dodać do akcji:
setMuseumId: (id: string) => void;
setFireIntensity: (i: FireIntensity) => void;
```

Nowy case w `generateZones`:
```typescript
case "museum-fire":
  if (state.museumId && state.selectedMuseum) {
    zones = generateMuseumFireZones({
      museumId: state.museumId,
      museumCenter: state.selectedMuseum.center,
      fireIntensity: state.fireIntensity,
      windSpeed: state.windSpeed,
      windDirection: state.windDirection,
      hours: state.hours,
      buildingArea: state.selectedMuseum.area,
    });
  }
  break;
```

Timeline: **0-4h** (krok 0.25h = 15 min) — pożar rozwija się szybciej niż powódź.

---

## Krok 7: Nowy hook — `useMuseumFireImpact.ts`

**Nowy plik**: `frontend/src/hooks/useMuseumFireImpact.ts`

```typescript
export function useMuseumFireImpact(
  museumId: string | null,
  fireIntensity: string | null,
  hours: number
) {
  // Fetch z /api/museum-fire po zmianie parametrów (debounce 500ms)
  // Zwraca: evacuationPlan, nearestStations, nearestStorages, timeConstraints
}
```

---

## Krok 8: Widoki Snowflake

**Plik**: `snowflake/sql/05-museum-fire-tables.sql` (kontynuacja)

### 8a. `v_museum_with_collections` — muzeum + agregat kolekcji
```sql
CREATE OR REPLACE VIEW v_museum_with_collections AS
SELECT
  m.museum_id,
  m.name,
  m.museum_type,
  m.protection_class,
  m.total_objects,
  m.priority_objects,
  m.fire_resistance_minutes,
  m.has_sprinklers,
  m.city,
  m.latitude,
  m.longitude,
  m.geo,
  COUNT(c.collection_id) AS collection_count,
  SUM(CASE WHEN c.protection_priority = 1 THEN c.object_count ELSE 0 END) AS priority1_objects,
  SUM(c.estimated_evac_time_min) AS total_evac_time_min
FROM raw_museums m
LEFT JOIN raw_museum_collections c ON m.museum_id = c.museum_id
GROUP BY m.museum_id, m.name, m.museum_type, m.protection_class,
         m.total_objects, m.priority_objects, m.fire_resistance_minutes,
         m.has_sprinklers, m.city, m.latitude, m.longitude, m.geo;
```

### 8b. `v_nearest_fire_stations` — stacje z odległością do muzeów
```sql
CREATE OR REPLACE VIEW v_nearest_fire_stations AS
SELECT
  m.museum_id,
  m.name AS museum_name,
  fs.station_id,
  fs.name AS station_name,
  fs.station_type,
  fs.has_ladder_truck,
  fs.personnel_count,
  ROUND(ST_DISTANCE(m.geo, fs.geo) / 1000, 1) AS distance_km,
  fs.response_time_min
FROM raw_museums m
CROSS JOIN raw_fire_stations fs
WHERE ST_DISTANCE(m.geo, fs.geo) < 50000  -- max 50km
ORDER BY m.museum_id, distance_km;
```

### 8c. `v_h3_museum_density` — gęstość dziedzictwa per hex
```sql
CREATE OR REPLACE VIEW v_h3_museum_density AS
SELECT
  h3_index,
  hex_boundary,
  COUNT(*) AS museum_count,
  SUM(total_objects) AS total_objects,
  MAX(CASE WHEN protection_class = 'A' THEN 1 ELSE 0 END) AS has_class_a
FROM raw_museums m,
  LATERAL H3_POINT_TO_CELL_STRING(m.geo, 7) AS h3_index
-- ...hex_boundary join...
GROUP BY h3_index, hex_boundary;
```

---

## Krok 9: Wizualizacja na mapie — rozszerzenia DashboardMap

### 9a. Strefy pożarowe
Renderowane jak istniejące scenariusze (ScenarioZone → Source+Layer).
Kolory: czerwony/pomarańczowy/żółty (ogień/odcięcie/ewakuacja).

### 9b. Linie tras ewakuacji (opcjonalnie)
Jeśli czas pozwala — narysować linie od muzeum do magazynów awaryjnych:
- Styl: dashed line, biały/cyjan
- Etykieta: odległość + szacowany czas transportu
- Implementacja: prosta linia Turf.js (nie routing, uproszczenie)

### 9c. Ikona muzeum w centrum strefy
Punkt źródłowy scenariusza oznaczony ikoną muzeum (zamiast fabryki jak w toxic-cloud).

### 9d. Auto-flyTo
Przy aktywacji scenariusza → `map.flyTo({ center: museumCenter, zoom: 14 })`.

---

## Krok 10: Rozszerzenie impact analysis w istniejącym `/api/scenario`

**Plik**: `frontend/src/app/api/scenario/route.ts`

Dla `scenarioType: "museum-fire"`:
- Szukaj obiektów POI w strefach pożarowych (szkoły, przedszkola, szpitale — ewakuacja ludzi)
- Dodaj `museum_collections` jako osobny typ obiektu w odpowiedzi
- Zwracaj `evacuation_priority` bazujący na `protection_priority` kolekcji

---

## Podsumowanie plików

| Plik | Akcja |
|---|---|
| `snowflake/sql/05-museum-fire-tables.sql` | **NOWY** — tabele + widoki |
| `snowflake/seed/seed-museum-fire-data.sql` | **NOWY** — dane muzeów, kolekcji, PSP, magazynów |
| `frontend/layer-registry.json` | EDIT — 4 nowe warstwy |
| `frontend/src/types/scenario.ts` | EDIT — dodać `"museum-fire"` do `ScenarioType` |
| `frontend/src/lib/scenarios/museum-fire.ts` | **NOWY** — model stref pożarowych |
| `frontend/src/hooks/useScenario.ts` | EDIT — parametry pożaru muzealnego |
| `frontend/src/hooks/useMuseumFireImpact.ts` | **NOWY** — fetch planu ewakuacji |
| `frontend/src/components/scenario/MuseumFireControls.tsx` | **NOWY** — kontrolki scenariusza |
| `frontend/src/components/scenario/EvacuationPlan.tsx` | **NOWY** — plan ewakuacji dzieł |
| `frontend/src/components/scenario/NearestServices.tsx` | **NOWY** — najbliższe służby i magazyny |
| `frontend/src/components/scenario/ScenarioPanel.tsx` | EDIT — trzecia karta scenariusza |
| `frontend/src/components/map/DashboardMap.tsx` | EDIT — auto-flyTo dla museum-fire |
| `frontend/src/app/page.tsx` | EDIT — nowe handlery z useScenario |
| `frontend/src/app/api/museum-fire/route.ts` | **NOWY** — endpoint ewakuacji |
| `frontend/src/app/api/scenario/route.ts` | EDIT — obsługa museum-fire |

---

## Kolejność implementacji (sugerowana)

1. **Dane** (Krok 1) — tabele Snowflake + seed, ~30 min
2. **Warstwy** (Krok 2) — layer-registry + sprawdzenie na mapie, ~15 min
3. **Model pożaru** (Krok 3a) — `museum-fire.ts` z generowaniem stref, ~30 min
4. **useScenario** (Krok 6) — rozszerzenie hooka o museum-fire, ~20 min
5. **UI scenariusza** (Krok 5a-d) — MuseumFireControls + karta w ScenarioPanel, ~30 min
6. **API ewakuacji** (Krok 4) — endpoint + logika priorytetyzacji, ~30 min
7. **EvacuationPlan UI** (Krok 5b-c) — wyświetlanie planu ewakuacji, ~30 min
8. **Integracja** (Krok 9-10) — DashboardMap + impact analysis, ~20 min
9. **Testy manualne** — weryfikacja w przeglądarce, ~15 min

**Szacowany łączny nakład**: ~3.5h

---

## Weryfikacja

1. **Regresja scenariuszy**: toxic-cloud i flood działają bez zmian
2. **Nowe warstwy**: muzea, PSP, magazyny widoczne na mapie z popupami
3. **Scenariusz museum-fire**:
   - Wybór muzeum z listy → flyTo na mapie
   - Strefy pożarowe (czerwony/pomarańczowy/żółty) wokół muzeum
   - Strefy rosną z czasem i intensywnością
   - Wiatr wydłuża strefę
4. **Plan ewakuacji**:
   - Kolekcje posortowane wg priorytetu
   - Progress bar: czas odporności vs czas ewakuacji
   - Przypisane magazyny awaryjne z odległością
   - Znacznik "zdąży się / zagrożone"
5. **Najbliższe służby**:
   - Lista PSP/OSP z odległością i czasem dojazdu
   - Informacja o drabinie mechanicznej
6. **Cross-layer**: włączenie warstwy szpitali + scenariusz pożaru → widać które POI są w strefie ewakuacji
7. **Dev server**: `cd frontend && npm run dev` — testować w przeglądarce
