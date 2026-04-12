# Plan: Zestaw A — Kryzys medyczny w warunkach powodzi

## Kontekst

Aplikacja "Sztab Kryzysowy" to geospatial decision dashboard dla Marszałka Województwa Lubelskiego (hackathon civil42). Obecnie zaimplementowano scenariusz powodzi (ISOK Q10/Q100/Q500, rzeki, wodowskazy IMGW) oraz scenariusz chmury toksycznej. Szpitale istnieją jako warstwa POI z OSM, ale brakuje danych medycznych (łóżka, SOR, generatory) i systemu zgłoszeń 112. Celem jest pełna realizacja **Zestawu A** — identyfikacja szpitali operacyjnych, zagrożonych i do ewakuacji w warunkach powodzi.

---

## Faza 1: Snowflake — tabele i dane syntetyczne

### 1a. Nowy plik: `snowflake/sql/06-medical-crisis.sql`

**Tabela `raw_hospital_details`** (szczegóły szpitali):
- `hospital_osm_id BIGINT` (FK → `raw_osm_pois.osm_id`)
- `total_beds INT`, `icu_beds INT`, `available_beds INT`
- `has_sor BOOLEAN` (oddział ratunkowy)
- `staff_count INT`
- `has_generator BOOLEAN`, `generator_fuel_hours FLOAT`
- `status STRING` (operational / at_risk / evacuating / closed)

**Tabela `raw_emergency_calls`** (zgłoszenia 112 — syntetyczne):
- `call_id STRING`, `call_timestamp TIMESTAMP`
- `latitude FLOAT`, `longitude FLOAT`, `geo GEOGRAPHY`
- `call_type STRING` (medical / fire / police)
- `priority INT` (1=krytyczny, 2=pilny, 3=normalny)
- `status STRING`, `description STRING`

**Widok `v_hospital_status`** — JOIN `raw_osm_pois` + `raw_hospital_details`:
- Zwraca pełne dane szpitali: nazwa, lokalizacja, łóżka, SOR, generator, status

### 1b. Nowy plik: `snowflake/sql/07-seed-medical-data.sql`

Syntetyczne dane dla ~30 szpitali woj. lubelskiego:
- Duże (Lublin): 500-800 łóżek, 30-50 ICU, SOR, generator 48-72h
- Średnie (powiatowe): 150-300 łóżek, 10-20 ICU, część z SOR
- Małe: 50-100 łóżek, 2-5 ICU, brak SOR, część bez generatorów
- 3-5 szpitali celowo umieszczonych W strefach powodziowych (status at_risk)

Syntetyczne zgłoszenia 112 (~200 wpisów):
- 60% w strefach Q100, typ medical dominujący
- Okno czasowe: 24h kryzysu

---

## Faza 2: API Routes

### 2a. Nowy: `frontend/src/app/api/hospitals/route.ts`

GET endpoint → query `v_hospital_status` → GeoJSON FeatureCollection + summary:
```json
{
  "type": "FeatureCollection",
  "features": [...],
  "summary": {
    "total": 30, "operational": 22, "at_risk": 5, "evacuating": 2, "closed": 1,
    "total_beds": 8500, "available_beds": 2100,
    "icu_beds": 350, "icu_available": 85,
    "generators_active": 18, "avg_fuel_hours": 36.5
  }
}
```

### 2b. Nowy: `frontend/src/app/api/emergency-calls/route.ts`

GET endpoint z opcjonalnym `?since=<timestamp>` dla przyrostowego pollingu. Zwraca GeoJSON zgłoszeń 112.

### 2c. Nowy: `frontend/src/app/api/hospitals/evacuation/route.ts`

POST endpoint — dla danego `hospital_osm_id`:
1. Znajduje lokalizację szpitala
2. Odpytuje szpitale operacyjne POZA strefą powodziową (`ST_WITHIN` negacja)
3. Rankuje po: odległość, dostępne łóżka, SOR, ICU
4. Zwraca top 3-5 alternatyw z `distance_km` i wolną pojemnością

### 2d. Modyfikacja: `frontend/src/app/api/scenario/route.ts`

Rozszerzyć SQL dla flood o JOIN z `raw_hospital_details`:
- Zwracać `total_beds`, `icu_beds`, `has_sor`, `has_generator`, `generator_fuel_hours`
- Ulepszyć `evacuation_priority`: `(has_sor * 1000) + (icu_beds * 50) + (total_beds * 5) - distance_m/100`

---

## Faza 3: Warstwy mapowe

### 3a. Modyfikacja: `frontend/layer-registry.json`

Dodać 2 nowe warstwy:

**`poi-hospitals-status`** (grupa Infrastruktura) — zastępuje `poi-hospitals` podczas scenariusza powodziowego:
- Źródło: `v_hospital_status`
- Kolor data-driven po `status`: operational=#22c55e, at_risk=#f59e0b, evacuating=#ef4444, closed=#6b7280
- Promień koła skalowany po `total_beds`
- Pola popup: name, total_beds, icu_beds, has_sor, generator_fuel_hours, status

**`emergency-calls`** (grupa Zgłoszenia):
- Źródło: `raw_emergency_calls`
- Kolor po `call_type`: medical=#ef4444, fire=#f97316, police=#3b82f6
- Priority 1 = większy promień

### 3b. Modyfikacja: `frontend/src/components/map/DashboardMap.tsx`

Dodać Source+Layer dla linii ewakuacyjnych (great-circle arcs z Turf.js) — animowane linie przerywane od szpitala zagrożonego do alternatywnego.

---

## Faza 4: Panel kryzysu medycznego (kluczowy element UI)

### 4a. Nowy: `frontend/src/components/scenario/MedicalCrisisPanel.tsx`

Renderowany w ScenarioPanel gdy scenariusz flood jest aktywny. 3 sekcje:

**Sekcja A — Podsumowanie statusu szpitali:**
- Kolorowe badge: X operacyjnych (zielony), Y zagrożonych (pomarańczowy), Z ewakuowanych (czerwony)
- Progress bar: łóżka ogółem / dostępne
- Progress bar: ICU
- Status generatorów: ile z <12h paliwa (ostrzeżenie)

**Sekcja B — Karty szpitali (scrollowalna lista):**
- Każda karta: nazwa, łóżka (ogółem/dostępne), badge SOR, ikona generatora + godziny paliwa, badge statusu
- Karty at_risk/evacuating rozwinięte z "Najbliższe alternatywy" + przycisk "Ewakuuj" (rysuje trasę na mapie)

**Sekcja C — Feed zgłoszeń 112:**
- Lista ostatnich zgłoszeń w strefie powodzi, grupowana po typie
- Priority 1 wyróżnione na górze

### 4b. Nowy: `frontend/src/hooks/useHospitalStatus.ts`

SWR hook pollujący `/api/hospitals` co 30s. Zwraca features + summary.

### 4c. Nowy: `frontend/src/hooks/useEmergencyCalls.ts`

SWR hook pollujący `/api/emergency-calls` co 10s z param `since` (przyrostowy).

---

## Faza 5: Integracja z istniejącym systemem scenariuszy

### 5a. Modyfikacja: `frontend/src/hooks/useScenario.ts`

Bez zmian w typie `ScenarioState` — panel medyczny aktywuje się warunkowo gdy `scenarioType === "flood"`.

### 5b. Modyfikacja: `frontend/src/components/scenario/ScenarioPanel.tsx`

Po bloku `FloodControls`, warunkowo renderować `<MedicalCrisisPanel>` gdy flood aktywny. ThreatList pozostaje dla toxic-cloud.

### 5c. Modyfikacja: `frontend/src/app/page.tsx`

Podpiąć nowe hooki (`useHospitalStatus`, `useEmergencyCalls`), przekazać dane do ScenarioSidebar i DashboardMap.

---

## Faza 6: Logika ewakuacji i wizualizacja tras

### 6a. Nowy: `frontend/src/lib/scenarios/evacuation.ts`

Logika client-side z Turf.js (już w zależnościach):
- `calculateEvacuationRoutes(atRiskHospitals, operationalHospitals)` → GeoJSON LineStrings
- `turf.greatCircle` dla łuków (efektowne wizualnie na demo)
- Pacjenci SOR → najbliższy szpital z SOR, ICU → szpital z ICU, ogólni → szpital z wolnymi łóżkami

---

## Kolejność implementacji (priorytet hackathonowy)

| # | Co | Czas | Wpływ |
|---|-----|------|-------|
| 1 | Snowflake DDL + seed data (Faza 1) | ~30 min | fundament |
| 2 | Warstwa `poi-hospitals-status` w registry (Faza 3a) | ~15 min | natychmiastowy efekt wizualny |
| 3 | API `/api/hospitals` (Faza 2a) | ~30 min | zasilenie panelu |
| 4 | MedicalCrisisPanel + hooki (Faza 4) | ~60 min | główna wartość dla jury |
| 5 | Integracja z ScenarioPanel (Faza 5) | ~30 min | spójność UX |
| 6 | API zgłoszeń 112 + warstwa (Faza 2b, 3a) | ~20 min | dodatkowa warstwa danych |
| 7 | API ewakuacji + wizualizacja tras (Faza 2c, 6) | ~30 min | efekt wow na demo |
| 8 | Rozszerzenie `/api/scenario` (Faza 2d) | ~15 min | głębsza analiza |

---

## Kluczowe pliki do modyfikacji/utworzenia

**Nowe pliki:**
- `snowflake/sql/06-medical-crisis.sql`
- `snowflake/sql/07-seed-medical-data.sql`
- `frontend/src/app/api/hospitals/route.ts`
- `frontend/src/app/api/hospitals/evacuation/route.ts`
- `frontend/src/app/api/emergency-calls/route.ts`
- `frontend/src/components/scenario/MedicalCrisisPanel.tsx`
- `frontend/src/hooks/useHospitalStatus.ts`
- `frontend/src/hooks/useEmergencyCalls.ts`
- `frontend/src/lib/scenarios/evacuation.ts`

**Modyfikowane pliki:**
- `frontend/layer-registry.json` — 2 nowe warstwy
- `frontend/src/app/api/scenario/route.ts` — JOIN hospital_details
- `frontend/src/components/scenario/ScenarioPanel.tsx` — dodać MedicalCrisisPanel
- `frontend/src/components/map/DashboardMap.tsx` — linie ewakuacyjne
- `frontend/src/app/page.tsx` — podpiąć nowe hooki

---

## Weryfikacja

1. Uruchomić DDL + seed na Snowflake (`snowsql -f 06-medical-crisis.sql && snowsql -f 07-seed-medical-data.sql`)
2. `cd frontend && npm run dev`
3. Aktywować scenariusz powodzi (Q100)
4. Sprawdzić czy warstwa `poi-hospitals-status` pokazuje kolorowe kropki (zielone/pomarańczowe/czerwone)
5. Sprawdzić MedicalCrisisPanel w sidebarze — podsumowanie łóżek, karty szpitali, feed 112
6. Kliknąć "Ewakuuj" na szpitalu at_risk → linia ewakuacyjna na mapie
7. Sprawdzić popup szpitala — pełne dane (łóżka, SOR, generator)
8. Playwright MCP: zrobić screenshot kluczowych widoków do prezentacji
