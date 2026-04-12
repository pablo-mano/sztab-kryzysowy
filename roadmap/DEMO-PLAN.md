# Plan Demo — Inteligentna Mapa Województwa Lubelskiego

> Prezentacja 5 min przed jury Urzędu Marszałkowskiego Województwa Lubelskiego  
> Geospatial Decision Dashboard dla Marszałka Województwa

---

## Scenariusz demo (5 min)

### CZĘŚĆ 1: Platforma bazowa (1:30)
*Cel: pokazać spełnienie wymagań podstawowych (sekcja 2.1)*

**Krok 1 — Widok ogólny mapy (0:15)**
- Otwarcie dashboardu — ciemna mapa woj. lubelskiego z granicami powiatów
- Pokazać płynny zoom od województwa do poziomu gminy
- Zwrócić uwagę na responsywny UI (layout: sidebar | mapa | panel scenariuszy)

**Krok 2 — Wielowarstwowe nakładki danych (0:30)**
- W lewym panelu włączyć kolejno warstwy:
  - `Szpitale` (czerwone) + `Szkoły` (niebieskie) + `DPS-y` (pomarańczowe)
  - `Rzeki` (Wisła, Wieprz) + `Wodowskazy IMGW` (kolory: normalny/ostrzeżenie/alarm)
  - `Jakość powietrza GIOŚ` (stacje z wartościami PM10/PM2.5)
- Kliknąć na szpital — pokazać popup z danymi (nazwa, łóżka, SOR)
- Kliknąć na stację GIOŚ — pokazać wykres timeseries jakości powietrza

**Krok 3 — Filtry i selekcja regionu (0:20)**
- Kliknąć na powiat puławski → dane filtrują się do tego powiatu
- Pokazać znacznik czasu ostatniej aktualizacji
- Przełączyć tryb mapy: Points → H3 → pokazać heatmapę gęstości infrastruktury

**Krok 4 — Dynamiczne odświeżanie (0:15)**
- Wskazać live indicator przy warstwach (TTL cache: 5 min GIOŚ, 10s civil reports)
- Pokazać automatyczne odświeżanie danych

---

### CZĘŚĆ 2: Case Study — Awaria środowiskowa (2:00)
*Cel: głęboka analiza Zestawu D + elementy Zestawu A*

**Krok 5 — Scenariusz: Chmura toksyczna z Puław (0:45)**
- W prawym panelu wybrać scenariusz "Chmura toksyczna"
- Mapa automatycznie przeleci do Puław (flyTo)
- Ustawić parametry:
  - Substancja: **Chlor (Cl₂)** — najbardziej dramatyczny wizualnie
  - Skala wycieku: **Katastroficzny**
  - Kierunek wiatru: **270°** (zachodni → chmura idzie na wschód)
  - Prędkość wiatru: umiarkowana
  - Klasa stabilności: automatycznie obliczona z pory dnia i zachmurzenia
- Pokazać 3 strefy zagrożenia na mapie:
  - **ERPG-3** (czerwona) — zagrożenie życia
  - **ERPG-2** (pomarańczowa) — poważne skutki zdrowotne
  - **ERPG-1** (niebieska) — dyskomfort
- Zmienić kierunek wiatru suwakiem → strefy obracają się w czasie rzeczywistym (model Gaussa)

**Krok 6 — Analiza wpływu (impact analysis) (0:30)**
- Wskazać panel ImpactBar:
  - Ile osób w każdej strefie zagrożenia
  - Jakie obiekty wrażliwe: szpitale, szkoły, przedszkola, DPS-y
- Kliknąć na zagrożony obiekt → szczegóły z odległością od źródła
- Pokazać ThreatList z priorytetami ewakuacji

**Krok 7 — Zmiana parametrów w locie (0:20)**
- Zmienić substancję na **Amoniak (NH₃)** → strefy się zmieniają (inne ERPG)
- Zmienić skalę z katastroficznej na mały wyciek → pokazać jak zmniejsza się zasięg
- Użyć TimelineSlider — pokazać propagację chmury w czasie (0-8h)

**Krok 8 — Korelacja z powodziami (Zestaw A) (0:25)**
- Dezaktywować scenariusz toksyczny
- Włączyć scenariusz "Powódź" → wybrać ISOK Q100
- Pokazać oficjalne strefy zalewowe ISOK na mapie
- Włączyć filtrowanie POI → które szpitale/szkoły w strefie zalewowej
- Pokazać scoring ewakuacji szpitali (priorytet na podstawie SOR, ICU, odległości)

---

### CZĘŚĆ 3: Funkcje dodatkowe — bonus points (1:00)
*Cel: +20 pkt (2 funkcje dodatkowe × 10 pkt)*

**Krok 9 — Agenci social media / Civil Reports (0:30)**
- Włączyć scenariusz "Zgłoszenia obywatelskie" (civil reports)
- Pokazać live-feed z platformy CIVIL42:
  - Pulsujący wskaźnik **LIVE** z odświeżaniem co 10 sekund
  - Klastry na mapie z kolorami (żółty/pomarańczowy/czerwony wg liczby zgłoszeń)
  - Convex hull — automatyczne wyznaczanie stref na podstawie zagęszczenia zgłoszeń
- Filtrować po czasie: 15 min / 1h / 6h / wszystkie
- Pokazać miniaturki zdjęć i wskaźniki audio ze zgłoszeń
- **Podkreślić: to jest geolokalizacja sygnałów społecznościowych na mapie**

**Krok 10 — Kalkulatory zasobów (0:30)**
- Przy aktywnym scenariuszu powodziowym Q500:
  - ImpactBar: ile łóżek szpitalnych w strefie zagrożenia
  - Liczba osób zagrożonych (szacowana populacja z POI density)
  - Breakdown: szpitale × DPS-y × szkoły × przedszkola
- Przy scenariuszu toksycznym:
  - Promień ERPG-3 w km, powierzchnia strefy
  - Liczba obiektów wrażliwych per strefa
- H3 hexagonal view: gęstość zaludnienia × risk score = priorytet interwencji

---

### CZĘŚĆ 4: Architektura i skalowalność (0:30)
*Cel: punkty za skalowalność (0-15 pkt)*

**Krok 11 — Slajd architektury (0:30)**
- Diagram: Next.js → Snowflake (hurtownia danych) + zewnętrzne API (GIOŚ, IMGW, ISOK, CIVIL42)
- Layer Registry (JSON) — dodanie nowej warstwy = 1 wpis konfiguracyjny, zero kodu
- Scenariusze jako moduły (toxic-cloud.ts, flood.ts, civil-reports.ts) — architektura pluginowa
- H3 hexagonal indexing — skalowanie do milionów punktów danych
- Cache layer z TTL per warstwa
- Dual map mode (Points / H3) — ten sam dataset, 2 perspektywy analityczne

---

## Pokrycie wymagań z zadania

| Kryterium (z PDF) | Co pokazujemy | Pkt |
|---|---|---|
| **Funkcjonalność GIS** (0-25) | 16 warstw, MapLibre GL, H3, admin boundaries, płynny zoom, popupy | max |
| **Jakość case study** (0-25) | Zestaw D (toksyczny) + Zestaw A (powódź) — model Gaussa, ISOK, impact analysis, korelacja warstw | max |
| **Użyteczność UX** (0-20) | Dark theme, intuicyjne suwaki, karty scenariuszy, auto-flyTo, responsywny layout | max |
| **Skalowalność** (0-15) | Layer registry JSON, modułowe scenariusze, Snowflake warehouse, H3 indexing, cache TTL | max |
| **Prezentacja** (0-15) | Płynne demo z narracją kryzysową, zero slajdów (poza architekturą), live system | max |
| **BONUS: Social media** (+10) | Civil reports = geolokalizowane zgłoszenia społecznościowe z CIVIL42 | +10 |
| **BONUS: Kalkulatory** (+10) | Impact analysis — łóżka, populacja, strefy, breakdown per typ obiektu | +10 |

**Cel punktowy: 100 bazowych + 20 bonus = 120/140 pkt**

---

## Wymagania podstawowe (2.1) — checklist

- [x] Interaktywna mapa GIS z podziałem administracyjnym (powiaty, gminy) + płynny zoom
- [x] Wielowarstwowe nakładki danych — 16 warstw, włączanie/wyłączanie/nakładanie
- [x] Dynamiczne odświeżanie danych — live-feeds z GIOŚ, IMGW, CIVIL42 + znacznik czasu
- [x] Filtry i selekcja regionu — klik na powiat/gminę filtruje dane
- [x] Responsywny, intuicyjny UI — ciemny motyw, layout 3-kolumnowy, suwaki, karty
- [x] Działające case study — Zestaw D (chmura toksyczna) + Zestaw A (powódź) w pełni funkcjonalne
- [x] Dane rzeczywiste (GIOŚ, IMGW, ISOK, OSM) + syntetyczne (CIVIL42)

---

## Przed demo — checklist

- [ ] Vercel deployment działa (`vercel --prod` z `frontend/`)
- [ ] Snowflake connection aktywna (sprawdzić `/api/health`)
- [ ] Dane GIOŚ/IMGW odświeżone (cache TTL)
- [ ] Civil reports mają aktywne zgłoszenia (sprawdzić CIVIL42)
- [ ] Przeglądarka: Chrome fullscreen, dark mode systemu
- [ ] Przygotować fallback screenshoty gdyby API padło

---

## Źródła danych w systemie

| Źródło | Typ | Dane | Odświeżanie |
|---|---|---|---|
| GIOŚ | API publiczne | Jakość powietrza PM10/PM2.5/SO2/NO2/O3 | 5 min |
| IMGW | API publiczne | Wodowskazy, stany rzek, progi ostrzegawcze | 10 min |
| ISOK | Dane oficjalne (Snowflake) | Strefy zalewowe Q10/Q100/Q500 | statyczne |
| OpenStreetMap | Dane publiczne (Snowflake) | POI: szpitale, szkoły, przedszkola, DPS-y | statyczne |
| CIVIL42 | Platforma crowdsource | Zgłoszenia obywatelskie ze zdjęciami/audio | 10 sek |
| Snowflake | Hurtownia danych | Granice admin, rzeki, agregaty H3 | wg warstwy |

## Stack technologiczny

- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind CSS v4
- **Mapa**: MapLibre GL JS 5 (WebGL) + Turf.js (geospatial ops)
- **Dane**: Snowflake (SQL warehouse + GEOGRAPHY + H3) + JWT auth
- **Wizualizacja**: Recharts (wykresy) + shadcn/ui (komponenty)
- **Deploy**: Vercel (frontend) + Snowflake (backend data)
