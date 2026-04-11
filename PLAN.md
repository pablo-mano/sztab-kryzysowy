# SZTAB KRYZYSOWY — Plan MVP (Hackathon ~24h)

## Context
Hackathon civil42.pl — zadanie specjalne Marszałka Woj. Lubelskiego (nagroda 10 000 PLN). Cel: prototyp **Geospatial Decision Dashboard** do zarządzania kryzysowego regionem. Proof-of-concept z interaktywną mapą GIS, dynamicznymi danymi i scenariuszem kryzysowym.

---

## Rekomendacja: Zestaw D — Awaria środowiskowa (smog/pożar przemysłowy)

**Scenariusz**: Pożar w Zakładach Azotowych Puławy → chmura toksyczna → monitoring powietrza → ewakuacja obiektów wrażliwych.

**Dlaczego D?**
- Prawdziwe dane real-time z API GIOŚ (jedyne darmowe REST API z danymi PM10/PM2.5 w Polsce)
- Dane pogodowe z OpenMeteo (darmowe, bez klucza)
- Obiekty wrażliwe (szkoły, szpitale, DPS) z OpenStreetMap Overpass API
- Naturalnie wielowarstwowy (5+ warstw)
- Łatwy do rozbudowy o bonusy

---

## Tech Stack

```
Frontend:  Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
Mapy:      MapLibre GL JS via react-maplibre (WebGL, wydajny, darmowy)
Wykresy:   Recharts
Backend:   Next.js API Routes (zero osobnego backendu)
Dane:      GeoJSON statyczne + API GIOŚ + OpenMeteo (dynamiczne)
Baza:      BRAK (pliki + in-memory cache)
Deploy:    Vercel (darmowy tier)
```

---

## Architektura

```
sztab-kryzysowy/
├── public/data/
│   ├── lubelskie-wojewodztwo.geojson
│   ├── lubelskie-powiaty.geojson
│   ├── lubelskie-gminy.geojson
│   ├── sensitive-buildings.geojson
│   └── scenario/ (fire-zone, toxic-cloud, evacuation-routes)
├── src/
│   ├── app/
│   │   ├── page.tsx (główna strona dashboardu)
│   │   └── api/ (air-quality, weather, scenario — Route Handlers)
│   ├── components/
│   │   ├── map/ (CrisisMap, MapLayers, LayerToggle, RegionSelector, MapPopup)
│   │   ├── dashboard/ (Sidebar, KpiCard, TimelineSlider, DataTimestamp, FilterPanel)
│   │   └── charts/ (AirQualityChart, WindRose)
│   ├── hooks/ (useAirQuality, useWeather, useScenario)
│   ├── lib/ (gios-client, openmeteo-client, geo-utils, scenario-engine)
│   └── types/
└── scripts/ (fetch-boundaries, fetch-osm-sensitive, generate-scenario)
```

---

## Etapy implementacji

### Etap 0: Scaffold (1h) — cały zespół
- `pnpm create next-app` + zależności + shadcn/ui + dark theme
- Deploy na Vercel (link od początku)
- Pobranie danych GeoJSON (granice lubelskiego)

### Etap 1: Mapa bazowa + granice (3h) — Dev A
- MapLibre z OpenFreeMap tiles
- Granice województwa/powiatów/gmin z GeoJSON
- Kliknięcie → highlight + zoom + popup
- RegionSelector (dropdown → zoom do regionu)

### Etap 2: Dashboard UI + KPI (2h) — Dev B (równolegle z E1)
- Layout: mapa 70% + sidebar 30% (collapsible)
- Karty KPI (AQI, osoby zagrożone, wiatr, temperatura)
- DataTimestamp (znacznik ostatniej aktualizacji)
- Responsywność (tablet: sheet, monitor: stały sidebar)
- Dark theme

### Etap 3: Dane dynamiczne — GIOŚ + pogoda (3h) — Dev C (równolegle z E1+E2)
- Route Handler `/api/air-quality` → proxy GIOŚ API + cache 5min
- Route Handler `/api/weather` → OpenMeteo
- SWR hooks z auto-refresh
- Markery stacji na mapie (kolor wg AQI)
- Wykres jakości powietrza
- Skrypt Overpass API → sensitive-buildings.geojson

### Etap 4: Scenariusz kryzysowy — pożar Puławy (4h) — 2 osoby
- **Logika**: scenario-engine.ts → symulacja chmury (turf.js sector + buffer, oparty na realnym wietrze)
- **Strefy**: czerwona/pomarańczowa/żółta
- **Analiza**: turf.pointsWithinPolygon → zagrożone obiekty + szacowana populacja
- **UI**: TimelineSlider (0-8h, play/pause), animowany marker pożaru, lista zagrożonych obiektów

### Etap 5: Warstwy + filtry (2h)
- LayerToggle: przełączniki 7 warstw (stackowalne)
- FilterPanel: typ obiektu, strefa zagrożenia, powiat
- Legenda mapy

### Etap 6: Polish + demo mode (2h) — cały zespół
- Automatyczny demo mode z narracją (flyTo, zoom, pitch)
- Animacje, loading states
- Responsywność tablet
- README + meta tagi

---

## Bonusy (jeśli zostanie czas, w kolejności priorytetów)

1. **Kalkulator zasobów** (+10pkt, ~2h) — suwak promienia + turf.buffer → tabela obiektów
2. **Scraping danych publicznych** (+10pkt, ~2h) — WIOŚ/GUS dane via Cheerio/pdf-parse
3. **Agent social media** (+10pkt, ~3h) — syntetyczne geolocated piny na mapie
4. **Asystent głosowy** (+10pkt, ~3h) — Web Speech API, komendy: "pokaż Puławy", "włącz AQI"

---

## Źródła danych

| Dane | Źródło | URL |
|------|--------|-----|
| Granice admin. | ppatrzyk/polska-geojson | github.com/ppatrzyk/polska-geojson |
| Jakość powietrza | GIOŚ API v1 | api.gios.gov.pl/pjp-api/v1/rest/ |
| Pogoda | Open-Meteo | api.open-meteo.com/v1/forecast |
| Obiekty wrażliwe | OSM Overpass | overpass-api.de |
| Szpitale | dane.gov.pl | dane.gov.pl/pl/dataset/1184 |
| Tło mapy | OpenFreeMap | tiles.openfreemap.org |

---

## Strategia punktowa

| Kategoria | Max | Strategia | Oczekiwane |
|-----------|-----|-----------|------------|
| GIS | 25 | MapLibre + granice + zoom + warstwy | 22-25 |
| Case study | 25 | GIOŚ real-time + symulacja chmury + obiekty wrażliwe | 20-25 |
| UX | 20 | shadcn/ui + dark theme + responsywność + demo mode | 16-20 |
| Skalowalność | 15 | Next.js modular + opisane w README | 12-15 |
| Prezentacja | 15 | Demo mode z narracją | 12-15 |
| **Bazowe** | **100** | | **82-100** |
| Bonusy | +40 | Kalkulator + scraping + social + głos | +24-38 |

---

## Weryfikacja

1. `pnpm dev` → mapa ładuje się z granicami lubelskiego
2. Kliknięcie gminy → zoom + popup z danymi
3. Toggle warstw → stacje GIOŚ pojawiają się/znikają z prawdziwymi danymi
4. Timeline slider → chmura toksyczna rośnie/maleje
5. KPI aktualizują się przy zmianie czasu scenariusza
6. Responsywność: tablet (sheet sidebar) + duży monitor (stały sidebar)
7. Demo mode: przycisk → automatyczna animacja scenariusza
8. Vercel deploy → link działa publicznie
