# Plan: Scenariusz A — Kryzys medyczny w warunkach powodzi

## Context

Aplikacja Sztab Kryzysowy to geospatial decision dashboard dla Marszałka Woj. Lubelskiego (hackathon civil42.pl). Obecnie zaimplementowany jest Zestaw D (pożar przemysłowy / chmura toksyczna z Puław). Kolejny scenariusz to **Zestaw A — Kryzys medyczny w warunkach powodzi**, który:

- Wykorzystuje istniejące warstwy POI (szpitale, szkoły, DPS)
- Dodaje nowe warstwy hydrologiczne (rzeki, wodowskazy, strefy zalewowe)
- Wprowadza symulację powodzi opartej na rzece (buffer wzdłuż Wisły) — wizualnie odmiennej od chmury toksycznej
- Dodaje analityczne zapytania do Snowflake (priorytetyzacja ewakuacji szpitali)

**Dlaczego Zestaw A**: Maksymalizuje reuse istniejących warstw (szpitale, DPS, admin boundaries), tworzy interesujące cross-layer analysis (szpitale w strefach zalewowych), korzysta z geografii regionu (Wisła, Wieprz).

---

## Krok 1: Nowy branch + refaktor multi-scenario

### 1a. Utworzenie brancha
```bash
git checkout -b feature/scenario-flood
```

### 1b. Nowy typ `ScenarioZone` (uogólnienie ToxicCloudZone)
**Nowy plik**: `frontend/src/types/scenario.ts`
- `ScenarioType = "toxic-cloud" | "flood"`
- `ScenarioZone` — wspólny typ z polami `zone`, `label`, `description`, `feature`, `color`, `opacity`
- Zastąpienie bezpośredniego importu `ToxicCloudZone` w komponentach mapy

### 1c. Refaktor `useScenario.ts`
**Plik**: `frontend/src/hooks/useScenario.ts`
- Dodać `scenarioType: ScenarioType | null`
- Dodać parametry powodzi: `waterLevel` (0-10m), `rainfallIntensity` (0-50 mm/h)
- `selectScenario(type)` — ustawia typ, resetuje parametry do domyślnych
- Timeline: 0-8h dla chmury, 0-72h dla powodzi (krok 1h zamiast 0.25h)
- Generowanie stref: dispatch do `generateToxicCloud()` lub `generateFloodZones()` w zależności od `scenarioType`

### 1d. Uogólnienie DashboardMap.tsx
**Plik**: `frontend/src/components/map/DashboardMap.tsx` (linie 140-177)
- Typ props: `scenarioZones?: ScenarioZone[]` (zamiast `ToxicCloudZone[]`)
- Renderowanie: użyć `zone.color` i `zone.opacity` zamiast hardcoded switch na red/orange/yellow

### 1e. Uogólnienie ThreatList.tsx
**Plik**: `frontend/src/components/scenario/ThreatList.tsx`
- Typ props: `ScenarioZone[]` zamiast `ToxicCloudZone[]`
- Dynamiczne kolory z `zone.color` zamiast hardcoded mapy

### 1f. Refaktor ScenarioPanel.tsx
**Plik**: `frontend/src/components/scenario/ScenarioPanel.tsx`
- Gdy `!active`: wyświetl 2 karty (pożar / powódź) jako selektor scenariusza
- Gdy aktywny pożar: dotychczasowe kontrolki wiatru
- Gdy aktywna powódź: nowe kontrolki (water level + rainfall) — patrz Krok 3

### 1g. Aktualizacja page.tsx
**Plik**: `frontend/src/app/page.tsx`
- Dodać nowe handlery z `useScenario`: `selectScenario`, `setWaterLevel`, `setRainfallIntensity`
- Przekazać do `Sidebar` + `DashboardMap`

---

## Krok 2: Symulacja powodzi (frontend, turf.js)

### 2a. Stała VISTULA_LUBELSKIE
**Plik**: `frontend/src/lib/geo-utils.ts`
- `Feature<LineString>` z ~15-20 punktami kontrolnymi Wisły przez Lubelskie
- Przebieg: Annopol → Kazimierz Dolny → Puławy → Dęblin

### 2b. Algorytm generowania stref zalewowych
**Nowy plik**: `frontend/src/lib/scenarios/flood.ts`

```typescript
interface FloodParams {
  riverLine: Feature<LineString>;
  waterLevel: number;       // 0-10m
  rainfallIntensity: number; // mm/h  
  hours: number;            // 0-72
}

function generateFloodZones(params): ScenarioZone[]
```

3 strefy buforowe wokół linii Wisły (turf.buffer):
- **Strefa głębokiego zalania** ("deep", `#1e40af`, opacity 0.4): `baseRadius = 0.5km`
- **Strefa zagrożenia** ("moderate", `#0891b2`, opacity 0.3): `baseRadius = 1.5km`  
- **Strefa ostrzegawcza** ("warning", `#38bdf8`, opacity 0.15): `baseRadius = 3km`

Promienie skalowane: `radius = baseRadius * waterLevelFactor * timeFactor * rainfallFactor`
- `waterLevelFactor = waterLevel / 5`
- `timeFactor = Math.min(1, hours / 24)`
- `rainfallFactor = Math.max(1, rainfallIntensity / 20)`

---

## Krok 3: Nowe komponenty UI

### 3a. FloodControls.tsx
**Nowy plik**: `frontend/src/components/scenario/FloodControls.tsx`
- Slider: poziom wody (0-10m)
- Slider: intensywność opadów (0-50 mm/h)
- Wskaźnik: status wodowskazów (kolorowe kropki)

### 3b. ScenarioSelector (wbudowany w ScenarioPanel)
- 2 karty w panelu scenariusza gdy nieaktywny:
  - "Pożar przemysłowy — Puławy" (ikona ognia)
  - "Powódź — Dolina Wisły" (ikona wody)

---

## Krok 4: Nowe warstwy w layer-registry.json

**Plik**: `frontend/layer-registry.json` — dodać 3 warstwy:

1. **`hydro-rivers`** (Rzeki główne) — grupa "Hydrologia"
   - Styl: line, niebieski, width 3
   - Source: `raw_rivers` z `geoColumn: "geo"`
   
2. **`hydro-gauges`** (Wodowskazy IMGW) — grupa "Hydrologia"
   - Styl: circle, niebieski z białą ramką
   - Legenda: categorical (Niski/Normalny/Ostrzegawczy/Alarmowy)
   - Source: `v_water_gauges_current`

3. **`h3-flood-risk`** (Ryzyko powodziowe H3) — grupa "Analityka H3"
   - Styl: fill z interpolacją kolorów (granatowy → turkus → czerwony)
   - Source: `v_h3_flood_risk`, `h3: true`

---

## Krok 5: Tabele i widoki Snowflake

**Nowy plik**: `snowflake/sql/04-flood-tables.sql`

### Tabele:
```sql
raw_rivers (osm_id, name, length_km, geo GEOGRAPHY)
raw_water_gauges (station_id, station_name, river_name, lat, lon, geo, alarm_level_cm, warning_level_cm)
raw_water_measurements (station_id, water_level_cm, flow_m3s, measure_time)
```

### Widoki:
```sql
v_water_gauges_current — najnowszy pomiar per stacja + status (niski/normalny/ostrzegawczy/alarmowy)
v_h3_flood_risk — cross-analysis: odległość od rzeki × gęstość POI × populacja
```

---

## Krok 6: Dane demo (seed)

**Nowy plik**: `snowflake/seed/seed-flood-data.sql`

- **Rzeki**: Wisła (LineString ~20 pkt) + Wieprz (~15 pkt) wstawione do `raw_rivers`
- **Wodowskazy**: 8-10 syntetycznych stacji IMGW wzdłuż Wisły (Annopol, Kazimierz, Puławy, Dęblin...)
  - `alarm_level_cm`: 600-800, `warning_level_cm`: 400-600
- **Pomiary**: 72h serii czasowej per stacja — narastający poziom wody symulujący przybór

---

## Krok 7: Rozszerzenie API scenariusza

**Plik**: `frontend/src/app/api/scenario/route.ts`
- Rozszerzyć `ScenarioRequest` o `scenarioType` field
- Dla powodzi: dodać kolumnę `evacuation_priority` w odpowiedzi
  - Priorytet = `estimated_population * 3 - distance_m / 100` (szpitale wyżej)
- SQL zapytania `ST_WITHIN` działają identycznie dla polygonów powodziowych jak toksycznych

---

## Pliki do modyfikacji (summary)

| Plik | Akcja |
|------|-------|
| `frontend/src/types/scenario.ts` | **NOWY** — typy ScenarioType, ScenarioZone |
| `frontend/src/lib/scenarios/flood.ts` | **NOWY** — generateFloodZones() |
| `frontend/src/lib/geo-utils.ts` | EDIT — dodać VISTULA_LUBELSKIE |
| `frontend/src/hooks/useScenario.ts` | EDIT — multi-scenario + flood params |
| `frontend/src/components/scenario/ScenarioPanel.tsx` | EDIT — selektor + flood controls |
| `frontend/src/components/scenario/FloodControls.tsx` | **NOWY** — kontrolki powodzi |
| `frontend/src/components/scenario/ThreatList.tsx` | EDIT — generyczne kolory |
| `frontend/src/components/map/DashboardMap.tsx` | EDIT — ScenarioZone z color/opacity |
| `frontend/src/app/page.tsx` | EDIT — nowe handlery scenariusza |
| `frontend/src/app/api/scenario/route.ts` | EDIT — scenarioType + evacuation_priority |
| `frontend/layer-registry.json` | EDIT — 3 nowe warstwy hydrologiczne |
| `snowflake/sql/04-flood-tables.sql` | **NOWY** — tabele + widoki |
| `snowflake/seed/seed-flood-data.sql` | **NOWY** — dane demo |

---

## Weryfikacja

1. **Regresja toxic-cloud**: aktywować scenariusz pożaru, sprawdzić że chmura toksyczna działa identycznie
2. **Nowy scenariusz flood**: aktywować scenariusz powodzi, sprawdzić:
   - 3 strefy niebieskie wzdłuż Wisły
   - Timeline 0-72h z animacją
   - Slidery water level + rainfall
   - Strefy rosną z czasem i parametrami
3. **Nowe warstwy**: włączyć rzeki, wodowskazy, H3 flood risk na mapie
4. **Cross-layer**: aktywować scenariusz powodzi → sprawdzić które szpitale/DPS są w strefach zalewowych
5. **Dev server**: `cd frontend && npm run dev` — testować w przeglądarce
