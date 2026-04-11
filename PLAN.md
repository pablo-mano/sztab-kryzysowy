# SZTAB KRYZYSOWY — Plan MVP: Scenariusz D (Pożar przemysłowy / chmura toksyczna)

## Context
Hackathon civil42.pl — zadanie specjalne Marszałka Woj. Lubelskiego (10 000 PLN). Budujemy **Geospatial Decision Dashboard** — prototyp systemu kryzysowego dla władz regionalnych. Scenariusz: **pożar w Zakładach Azotowych Puławy → chmura toksyczna → monitoring powietrza → ewakuacja obiektów wrażliwych**.

---

## 1. Scenariusz narracyjny

> **Godzina 0**: Eksplozja w Zakładach Azotowych Puławy (51.4167°N, 21.9667°E). Wyciek amoniaku i tlenków azotu.
>
> **Godzina 1-2**: Chmura toksyczna rozprzestrzenia się zgodnie z kierunkiem wiatru. Stacje GIOŚ w regionie odnotowują wzrost PM10, SO2, NO2.
>
> **Godzina 2-4**: System identyfikuje obiekty wrażliwe w strefie zagrożenia — szkoły, przedszkola, szpitale, DPS-y. Oblicza szacowaną liczbę zagrożonych osób.
>
> **Godzina 4-8**: Marszałek widzi na dashboardzie: strefy ewakuacji, listę priorytetowych obiektów, aktualne odczyty jakości powietrza, prognozę rozwoju sytuacji.

---

## 2. Tech Stack

```
Frontend:     Next.js 15 (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui
Mapy:         MapLibre GL JS via react-maplibre (WebGL, vector tiles)
Geo-analiza:  @turf/turf (bufory, sektory, points-within-polygon)
Wykresy:      Recharts
Dane live:    API GIOŚ (jakość powietrza) + Open-Meteo (pogoda/wiatr)
Dane statyczne: GeoJSON (granice admin., obiekty wrażliwe z OSM)
Deploy:       Vercel (darmowy tier, zero konfiguracji)
```

Brak osobnego backendu, brak bazy danych — API Routes Next.js + pliki + cache in-memory.

---

## 3. Struktura projektu

```
sztab-kryzysowy/
├── public/
│   └── data/
│       ├── lubelskie-wojewodztwo.geojson     # granica woj.
│       ├── lubelskie-powiaty.geojson          # 24 powiaty
│       ├── lubelskie-gminy.geojson            # ~213 gmin
│       └── sensitive-buildings.geojson        # szkoły, szpitale, DPS z OSM
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                           # dashboard (mapa + sidebar)
│   │   ├── globals.css
│   │   └── api/
│   │       ├── air-quality/route.ts           # proxy GIOŚ + cache
│   │       └── weather/route.ts               # proxy OpenMeteo + cache
│   ├── components/
│   │   ├── map/
│   │   │   ├── CrisisMap.tsx                  # główny komponent MapLibre
│   │   │   ├── LayerToggle.tsx                # panel przełączania warstw
│   │   │   ├── RegionSelector.tsx             # dropdown powiat/gmina → zoom
│   │   │   ├── MapLegend.tsx                  # legenda kolorów/symboli
│   │   │   └── MapPopup.tsx                   # popup z danymi obiektu
│   │   ├── dashboard/
│   │   │   ├── Sidebar.tsx                    # panel boczny (collapsible)
│   │   │   ├── KpiCard.tsx                    # karta KPI
│   │   │   ├── KpiGrid.tsx                    # siatka 4 kart KPI
│   │   │   ├── TimelineSlider.tsx             # oś czasu 0-8h (play/pause)
│   │   │   ├── DataTimestamp.tsx              # "Ostatnia aktualizacja: ..."
│   │   │   ├── FilterPanel.tsx                # filtry: typ obiektu, strefa, powiat
│   │   │   └── ThreatList.tsx                 # lista zagrożonych obiektów
│   │   ├── charts/
│   │   │   ├── AirQualityChart.tsx            # trend PM10/PM2.5 24h
│   │   │   └── WindIndicator.tsx              # kierunek + prędkość wiatru
│   │   ├── demo/
│   │   │   └── DemoMode.tsx                   # automatyczna animacja scenariusza
│   │   └── ui/                                # shadcn/ui (generowane)
│   ├── hooks/
│   │   ├── useAirQuality.ts                   # SWR → /api/air-quality
│   │   ├── useWeather.ts                      # SWR → /api/weather
│   │   └── useScenario.ts                     # stan scenariusza (czas, strefy, obiekty)
│   ├── lib/
│   │   ├── gios-client.ts                     # fetchStations, fetchSensors, fetchData
│   │   ├── openmeteo-client.ts                # fetchCurrentWeather
│   │   ├── scenario-engine.ts                 # generateToxicCloud, getAffectedBuildings
│   │   └── geo-utils.ts                       # bbox, fitBounds helpers
│   └── types/
│       ├── air-quality.ts                     # Station, Sensor, AirQualityData
│       ├── weather.ts                         # WeatherData
│       ├── scenario.ts                        # ScenarioState, ThreatZone
│       └── geo.ts                             # SensitiveBuilding, AdminRegion
├── scripts/
│   ├── fetch-boundaries.ts                    # pobiera GeoJSON z GitHub, filtruje lubelskie
│   └── fetch-osm-sensitive.ts                 # Overpass API → sensitive-buildings.geojson
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 4. Etapy implementacji

### Etap 0: Scaffold + dane (1-1.5h)
**Cel**: Działający pusty projekt z danymi, deployowany na Vercel.

- [ ] `pnpm create next-app@latest sztab-kryzysowy --typescript --tailwind --app --src-dir`
- [ ] Zależności: `maplibre-gl react-maplibre @turf/turf swr recharts`
- [ ] `pnpm dlx shadcn@latest init` + komponenty: `button card badge sheet sidebar slider switch toggle tooltip`
- [ ] Dark theme w globals.css (ciemne tło, kontrastowe kolory)
- [ ] Skrypt `scripts/fetch-boundaries.ts`:
  - Pobiera GeoJSON z github.com/ppatrzyk/polska-geojson
  - Filtruje do woj. lubelskiego (TERYT "06")
  - Zapisuje: wojewodztwo, powiaty, gminy
- [ ] Skrypt `scripts/fetch-osm-sensitive.ts`:
  - Overpass query: `amenity~"school|kindergarten|hospital|nursing_home|clinic|social_facility"` w lubelskim
  - Zapisuje: sensitive-buildings.geojson z properties (name, type, estimated_population)
- [ ] Deploy na Vercel
- [ ] Pierwszy commit + push

### Etap 1: Mapa bazowa + granice administracyjne (2-3h)
**Cel**: Interaktywna mapa lubelskiego z podziałem na powiaty/gminy.

- [ ] `CrisisMap.tsx` — MapLibre z OpenFreeMap vector tiles
  - Centrum: Lublin (51.25°N, 22.57°E), zoom: 8
  - Warstwy: granica województwa (outline), powiaty (fill + stroke), gminy (fill na hover)
  - Kliknięcie powiat/gmina → highlight + fitBounds + popup z nazwą
- [ ] `RegionSelector.tsx` — dropdown z listą powiatów
  - Wybór → mapa robi flyTo z smooth animacją
  - Opcja "Całe województwo" resetuje widok
- [ ] `MapLegend.tsx` — legenda z kolorami stref i symboli
- [ ] `MapPopup.tsx` — popup z danymi regionu/obiektu

**Pokrywa**: Wymaganie 1 (mapa GIS), 4 (selekcja regionu) → do 25 pkt GIS

### Etap 2: Dashboard layout + KPI (2h, równolegle z Etapem 1)
**Cel**: Responsywny układ dashboardu z panelem bocznym.

- [ ] `page.tsx` — layout: mapa ~70% + sidebar ~30%
- [ ] `Sidebar.tsx` — collapsible panel boczny
  - Desktop: stały po prawej
  - Tablet: sheet (wysuwa się z prawej, shadcn Sheet)
- [ ] `KpiGrid.tsx` + `KpiCard.tsx` — 4 karty KPI:
  - AQI (indeks jakości powietrza) z ikoną + kolorem
  - Osoby w strefie zagrożenia (liczba)
  - Wiatr (kierunek + prędkość)
  - Temperatura
- [ ] `DataTimestamp.tsx` — "Dane z: 11.04.2026 14:32" z pulsującą kropką
- [ ] Dark theme: tło #0a0a0f, karty z border-subtle, akcenty czerwone/pomarańczowe/żółte (strefy zagrożenia)

**Pokrywa**: Wymaganie 5 (responsywny UI) → do 20 pkt UX

### Etap 3: Dane real-time — GIOŚ + pogoda (2-3h, równolegle z E1+E2)
**Cel**: Prawdziwe dane jakości powietrza i pogody na mapie.

- [ ] `gios-client.ts`:
  - `fetchStations()` → GET `/pjp-api/v1/rest/station/findAll` → filtr woj. lubelskie
  - `fetchSensors(stationId)` → GET `/pjp-api/v1/rest/station/sensors/{id}`
  - `fetchSensorData(sensorId)` → GET `/pjp-api/v1/rest/data/getData/{id}`
  - `fetchAQI(stationId)` → GET `/pjp-api/v1/rest/aqindex/getIndex/{id}`
- [ ] `openmeteo-client.ts`:
  - `fetchWeather(lat, lon)` → Open-Meteo z `current=temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m`
- [ ] Route Handler `/api/air-quality/route.ts`:
  - Agreguje dane ze wszystkich stacji lubelskich
  - Zwraca GeoJSON FeatureCollection
  - Cache: `revalidate: 300` (5 min)
  - Fallback: snapshot JSON gdy API niedostępne
- [ ] Route Handler `/api/weather/route.ts`:
  - Pogoda dla centrum Puław (punkt scenariusza)
  - Cache: `revalidate: 600` (10 min)
- [ ] `useAirQuality.ts` — SWR hook, refreshInterval: 5 min
- [ ] `useWeather.ts` — SWR hook, refreshInterval: 10 min
- [ ] Warstwa na mapie: markery stacji GIOŚ z kolorem wg AQI:
  - Zielony (dobry) → Żółty (umiarkowany) → Pomarańczowy (niezdrowy) → Czerwony (zły) → Fioletowy (bardzo zły)
- [ ] `AirQualityChart.tsx` — trend PM10/PM2.5 z ostatnich 24h (kliknięcie stacji → wykres)
- [ ] `WindIndicator.tsx` — strzałka kierunku + prędkość w km/h

**Pokrywa**: Wymaganie 3 (dynamiczne odświeżanie) + dane do case study

### Etap 4: Scenariusz kryzysowy — serce projektu (3-4h)
**Cel**: Symulacja chmury toksycznej z analizą zagrożonych obiektów.

#### 4a: Silnik scenariusza (Dev A)
- [ ] `scenario-engine.ts`:
  - `generateToxicCloud(origin, windDirection, windSpeed, hoursElapsed)`:
    - Oblicza sektor kołowy w kierunku wiatru (turf.sector)
    - 3 strefy: czerwona (0-5km), pomarańczowa (5-15km), żółta (15-30km)
    - Rozmiar rośnie z czasem: radius = baseRadius * (1 + hoursElapsed * 0.3)
    - Kształt rozciągany w kierunku wiatru (elipsa, nie koło)
  - `getAffectedBuildings(toxicCloud, sensitiveBuildings)`:
    - turf.pointsWithinPolygon dla każdej strefy
    - Zwraca: lista obiektów z { name, type, zone, distance, estimatedPopulation }
  - `calculateStats(affected)`:
    - Suma populacji per strefa
    - Liczba obiektów per typ (szkoły, szpitale, DPS)
    - Najbliższy szpital poza strefą zagrożenia

- [ ] Estymacje populacji (w sensitive-buildings.geojson):
  - Szkoła: ~300 osób
  - Przedszkole: ~80 osób
  - Szpital: ~500 osób
  - DPS: ~100 osób
  - Klinika: ~50 osób

#### 4b: UI scenariusza (Dev B)
- [ ] `useScenario.ts` — state:
  - `timeHours: number` (0-8)
  - `isPlaying: boolean`
  - `toxicCloudGeoJSON: FeatureCollection` (przeliczany przy zmianie czasu/wiatru)
  - `affectedBuildings: AffectedBuilding[]`
  - `stats: ScenarioStats`
- [ ] `TimelineSlider.tsx`:
  - Suwak 0h → 8h z krokiem 0.5h
  - Przycisk Play/Pause — auto-advance co 2 sekundy
  - Label: "T + 2:00h od wybuchu"
- [ ] Warstwy mapy scenariusza:
  - Punkt pożaru: pulsujący czerwony marker z ikoną ognia
  - Chmura toksyczna: 3 polygony (fill-opacity: czerwona 0.4, pomarańczowa 0.25, żółta 0.15)
  - Obiekty wrażliwe: ikony (🏫 szkoła, 🏥 szpital, 🏠 DPS) z kolorem strefy
  - Obiekty zagrożone migają (CSS animation pulse)
- [ ] `ThreatList.tsx` — w sidebar:
  - Tabela: Nazwa | Typ | Strefa | Odległość | Populacja
  - Sortowanie po strefie (czerwona first)
  - Kliknięcie → zoom do obiektu na mapie
- [ ] KPI dynamiczne (aktualizowane ze scenario state):
  - "Obiekty w strefie czerwonej: 5"
  - "Szacowana populacja zagrożona: 2,400"
  - "Najbliższy bezpieczny szpital: Lublin, 45 km"

**Pokrywa**: Wymaganie 6 (case study) → do 25 pkt

### Etap 5: Warstwy + filtry (1.5-2h)
**Cel**: Wielowarstwowe nakładki z przełącznikami i filtrami.

- [ ] `LayerToggle.tsx` — przełączniki (shadcn Switch):
  - [x] Granice powiatów
  - [x] Granice gmin
  - [ ] Stacje GIOŚ
  - [x] Obiekty wrażliwe
  - [x] Chmura toksyczna
  - [ ] Kierunek wiatru
  - [ ] Drogi ewakuacji (statyczny GeoJSON z głównymi drogami)
- [ ] `FilterPanel.tsx`:
  - Typ obiektu: checkboxy (szkoły / szpitale / DPS / przedszkola)
  - Strefa zagrożenia: checkboxy (czerwona / pomarańczowa / żółta)
  - Region: dropdown powiatów
- [ ] Warstwy stackowalne — użytkownik włącza dowolną kombinację

**Pokrywa**: Wymaganie 2 (wielowarstwowe nakładki) + 4 (filtry)

### Etap 6: Demo mode + polish (2h)
**Cel**: Automatyczna prezentacja scenariusza + dopracowanie UX.

- [ ] `DemoMode.tsx` — przycisk "▶ Uruchom prezentację":
  1. Kamera leci nad woj. lubelskim (flyTo, pitch 45°)
  2. Zoom do Puław, pojawia się marker pożaru
  3. Timeline auto-play: chmura rośnie, obiekty się podświetlają
  4. Sidebar pokazuje narastające statystyki
  5. Zoom na najbardziej zagrożony obiekt
  6. Powrót do widoku ogólnego z pełnymi statystykami
  - Czas trwania: ~90 sekund (idealnie na prezentację 5 min z komentarzem)
- [ ] Animacje: smooth flyTo, fade-in warstw, pulse zagrożonych obiektów
- [ ] Loading states: skeleton cards w sidebar
- [ ] Error boundaries + fallback gdy API niedostępne
- [ ] Favicon (🚨), meta tagi, OG image
- [ ] README.md z opisem, architekturą, instrukcją uruchomienia, screenami

**Pokrywa**: Wymaganie 5 (UX) + scoring prezentacja (15 pkt)

---

## 5. Bonusy (w kolejności priorytetów)

### Bonus 1: Kalkulator zasobów (+10 pkt, ~2h) — PRIORYTET
- Suwak promienia (5-50 km) od punktu na mapie
- turf.buffer → okrąg na mapie
- turf.pointsWithinPolygon → tabela: obiekty w promieniu, typ, populacja
- Dodatkowy widok: "Ile łóżek szpitalnych w promieniu 30 km?"
- Kliknięcie na mapę = nowy punkt centrum analizy

### Bonus 2: Scraping danych publicznych (+10 pkt, ~2h)
- Route Handler `/api/scrape/wios` → parsuje HTML z WIOŚ Lublin (raporty jakości powietrza)
- Lub: parsowanie CSV z BDL GUS (łóżka szpitalne per powiat)
- Biblioteka: Cheerio (HTML) lub csv-parse
- Wynik wyświetlany jako dodatkowa warstwa/tabela

### Bonus 3: Agent social media (+10 pkt, ~2h)
- Warstwa "Sygnały społecznościowe" — syntetyczne piny na mapie
- Generator: realistyczne posty ("dym widoczny z autostrady", "czuć dziwny zapach w Kazimierzu")
- Ikona 💬 z tekstem w popup
- Geolokalizacja w obrębie scenariusza

### Bonus 4: Asystent głosowy (+10 pkt, ~3h)
- Web Speech API (SpeechRecognition + SpeechSynthesis)
- Komendy: "pokaż Puławy", "włącz jakość powietrza", "ile osób zagrożonych", "uruchom demo"
- Parsowanie intencji → dispatch akcji (zoom, toggle layer, read KPI)
- Mikrofon w górnym pasku z wskaźnikiem nasłuchiwania

---

## 6. Źródła danych

| Dane | Źródło | Format | Dostęp |
|------|--------|--------|--------|
| Granice admin. | ppatrzyk/polska-geojson | GeoJSON | Statyczne, prefetch |
| Jakość powietrza | GIOŚ API v1 | REST JSON | Live, cache 5min |
| Pogoda + wiatr | Open-Meteo | REST JSON | Live, cache 10min |
| Obiekty wrażliwe | OSM Overpass API | GeoJSON | Statyczne, prefetch |
| Szpitale/łóżka | dane.gov.pl | CSV/JSON | Statyczne |
| Tło mapy | OpenFreeMap | Vector tiles | Live |

### API Endpoints GIOŚ:
- `GET /pjp-api/v1/rest/station/findAll` — lista stacji
- `GET /pjp-api/v1/rest/station/sensors/{stationId}` — sensory stacji
- `GET /pjp-api/v1/rest/data/getData/{sensorId}` — dane pomiarowe
- `GET /pjp-api/v1/rest/aqindex/getIndex/{stationId}` — indeks jakości

### Overpass Query (obiekty wrażliwe):
```
[out:json][timeout:60];
area["name"="województwo lubelskie"]->.a;
(
  nwr["amenity"~"school|kindergarten|hospital|nursing_home|clinic|social_facility"](area.a);
);
out center;
```

---

## 7. Kluczowe decyzje

1. **MapLibre > Leaflet** — WebGL, vector tiles, smooth zoom, 3D pitch. Widoczna różnica jakości.
2. **Dark theme** — standard dashboardów kryzysowych (wojskowe/ratunkowe centra). Profesjonalnie na projektorze.
3. **Brak DB** — zero overhead. Dane statyczne w plikach, dynamiczne z API + cache.
4. **Demo mode** — krytyczny dla prezentacji. Jury widzi pełne możliwości bez ręcznego klikania.
5. **Prawdziwe dane GIOŚ** — wyróżnik vs. zespoły z 100% syntetycznymi danymi.

---

## 8. Weryfikacja (end-to-end)

1. `pnpm dev` → mapa ładuje się z granicami lubelskiego w ciemnym motywie
2. Kliknięcie gminy → zoom + popup z nazwą i danymi
3. Toggle warstwy "Stacje GIOŚ" → markery z prawdziwymi danymi AQI
4. Kliknięcie stacji → popup z wartościami + wykres 24h
5. Timeline slider 0→8h → chmura toksyczna rośnie, obiekty się podświetlają
6. ThreatList w sidebar aktualizuje się dynamicznie
7. KPI (osoby zagrożone, AQI) zmieniają się z czasem scenariusza
8. RegionSelector → zmiana powiatu → mapa robi flyTo
9. Responsywność: zmniejsz okno → sidebar zamienia się w sheet
10. Przycisk "Demo" → automatyczna animacja ~90s
11. `vercel deploy` → link publiczny działa
