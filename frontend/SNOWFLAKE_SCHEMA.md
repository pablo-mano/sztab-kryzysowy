# Wymagany schemat danych Snowflake

Dashboard frontendowy odpytuje Snowflake przez API routes. Poniżej pełna specyfikacja tabel/widoków, kolumn i typów, które muszą istnieć w bazie.

---

## 1. Tabele bazowe

### `raw_osm_pois`

Punkty infrastruktury krytycznej (POI) z OpenStreetMap dla woj. lubelskiego.

| Kolumna                | Typ           | Opis                                      |
|------------------------|---------------|--------------------------------------------|
| `name`                 | VARCHAR       | Nazwa obiektu                              |
| `amenity_type`         | VARCHAR       | Typ: `hospital`, `school`, `kindergarten`, `nursing_home`, `social_facility` |
| `latitude`             | FLOAT         | Szerokość geograficzna                     |
| `longitude`            | FLOAT         | Długość geograficzna                       |
| `estimated_population` | INT           | Szacunkowa liczba osób (pacjenci/uczniowie/podopieczni) |
| `city`                 | VARCHAR       | Miasto/miejscowość                         |
| `geo`                  | GEOGRAPHY     | Punkt geograficzny (`ST_MAKEPOINT(longitude, latitude)`) |

**Używane przez warstwy:** `poi-hospitals`, `poi-schools`, `poi-kindergartens`, `poi-care-homes`
**Używane przez zapytania:** `radius_search`, `scenario`

---

### `raw_admin_boundaries`

Granice administracyjne województwa lubelskiego.

| Kolumna      | Typ           | Opis                                    |
|--------------|---------------|-----------------------------------------|
| `name`       | VARCHAR       | Nazwa jednostki (np. "Lublin", "lubelskie") |
| `level`      | VARCHAR       | Poziom: `wojewodztwo`, `powiat`, `gmina`|
| `teryt`      | VARCHAR       | Kod TERYT                               |
| `population` | INT           | Populacja                               |
| `area_km2`   | FLOAT         | Powierzchnia w km²                      |
| `geo`        | GEOGRAPHY     | Geometria granicy (Polygon/MultiPolygon)|

**Używane przez warstwy:** `admin-wojewodztwo`, `admin-powiaty`, `admin-gminy`

**Zapytanie frontendowe:**
```sql
SELECT *, ST_ASGEOJSON(geo) AS geo FROM raw_admin_boundaries WHERE level = 'powiat'
```

---

### `raw_gios_measurements`

Pomiary jakości powietrza z GIOŚ (historia).

| Kolumna        | Typ           | Opis                               |
|----------------|---------------|-------------------------------------|
| `station_id`   | INT           | ID stacji GIOŚ                     |
| `station_name` | VARCHAR       | Nazwa stacji                        |
| `param_code`   | VARCHAR       | Kod parametru: `PM10`, `PM2.5`, `SO2`, `NO2`, `O3` |
| `value`        | FLOAT         | Zmierzona wartość (μg/m³)          |
| `measure_date` | TIMESTAMP     | Data/czas pomiaru                   |

**Używane przez zapytanie:** `air_quality_history`

**Zapytanie frontendowe:**
```sql
SELECT measure_date, value, param_code
FROM raw_gios_measurements
WHERE station_id = :id AND param_code = 'PM10'
ORDER BY measure_date DESC LIMIT 48
```

---

## 2. Widoki (Views)

### `v_air_quality_current`

Aktualna jakość powietrza — najnowszy pomiar per stacja.

| Kolumna        | Typ       | Opis                             |
|----------------|-----------|----------------------------------|
| `station_id`   | INT       | ID stacji                        |
| `station_name` | VARCHAR   | Nazwa stacji                     |
| `param_code`   | VARCHAR   | Kod parametru                    |
| `value`        | FLOAT     | Ostatnia wartość                 |
| `aqi_label`    | VARCHAR   | Etykieta AQI: `dobry`, `umiarkowany`, `niezdrowy`, `zły` |
| `measure_date` | TIMESTAMP | Data pomiaru                     |
| `city`         | VARCHAR   | Miasto                           |
| `latitude`     | FLOAT     | Szerokość geograficzna           |
| `longitude`    | FLOAT     | Długość geograficzna             |

**Używane przez warstwę:** `env-air-quality`

---

### `v_poi_by_powiat`

Agregacja POI per powiat i typ.

| Kolumna            | Typ     | Opis                          |
|--------------------|---------|-------------------------------|
| `teryt`            | VARCHAR | Kod TERYT powiatu             |
| `powiat`           | VARCHAR | Nazwa powiatu                 |
| `amenity_type`     | VARCHAR | Typ obiektu                   |
| `count`            | INT     | Liczba obiektów               |
| `total_population` | INT     | Łączna szacowana populacja    |

**Używane przez zapytanie:** `poi_by_powiat`

---

### `v_powiat_stats`

Statystyki zbiorcze per powiat.

| Kolumna      | Typ     | Opis                         |
|--------------|---------|------------------------------|
| `teryt`      | VARCHAR | Kod TERYT                    |
| `name`       | VARCHAR | Nazwa powiatu                |
| `population` | INT     | Populacja                    |
| `area_km2`   | FLOAT   | Powierzchnia                 |
| `hospitals`  | INT     | Liczba szpitali              |
| `schools`    | INT     | Liczba szkół                 |
| `care_homes` | INT     | Liczba domów opieki          |

**Używane przez zapytanie:** `powiat_stats`

---

### `v_h3_poi_density`

Gęstość infrastruktury w siatce H3 (resolution 7).

| Kolumna            | Typ         | Opis                              |
|--------------------|-------------|-----------------------------------|
| `h3_index`         | VARCHAR     | Indeks heksa H3                   |
| `hex_boundary`     | GEOGRAPHY   | Geometria heksagonu (Polygon)     |
| `poi_count`        | INT         | Liczba POI w heksie               |
| `total_population` | INT         | Łączna populacja w heksie         |
| `amenity_types`    | VARCHAR     | Lista typów (np. `hospital,school`) |

**Używane przez warstwę:** `h3-poi-density`

**Zapytanie frontendowe:**
```sql
SELECT *, ST_ASGEOJSON(hex_boundary) AS hex_boundary FROM v_h3_poi_density
```

---

### `v_h3_air_quality`

Jakość powietrza interpolowana na siatkę H3.

| Kolumna        | Typ         | Opis                         |
|----------------|-------------|------------------------------|
| `h3_index`     | VARCHAR     | Indeks heksa H3              |
| `hex_boundary` | GEOGRAPHY   | Geometria heksagonu          |
| `avg_value`    | FLOAT       | Średnia wartość pomiaru      |
| `param_code`   | VARCHAR     | Kod parametru (np. `PM10`)   |

**Używane przez warstwę:** `h3-air-quality`

---

### `v_h3_risk_score`

Wskaźnik ryzyka kryzysowego per heks H3. Łączy gęstość populacji, infrastrukturę i jakość powietrza.

| Kolumna            | Typ         | Opis                                |
|--------------------|-------------|--------------------------------------|
| `h3_index`         | VARCHAR     | Indeks heksa H3                     |
| `hex_boundary`     | GEOGRAPHY   | Geometria heksagonu                 |
| `total_population` | INT         | Populacja w zasięgu heksa           |
| `avg_pm10`         | FLOAT       | Średnie PM10                        |
| `risk_score`       | FLOAT       | Obliczony wskaźnik ryzyka (0–300+)  |

**Używane przez warstwę:** `h3-risk-score`

---

## 3. Wymagania geospatialne

- Snowflake musi mieć włączone **GEOGRAPHY** type
- Kolumny `geo` / `hex_boundary` to typ `GEOGRAPHY`
- Frontend odpytuje przez `ST_ASGEOJSON()` do konwersji na GeoJSON
- Zapytania scenariuszowe używają: `ST_WITHIN()`, `ST_DISTANCE()`, `ST_DWITHIN()`, `ST_MAKEPOINT()`, `TO_GEOGRAPHY()`

## 4. Zmienne środowiskowe (połączenie)

Frontend potrzebuje w `.env.local`:

```
SNOWFLAKE_ACCOUNT=<account>
SNOWFLAKE_USERNAME=<user>
SNOWFLAKE_PASSWORD=<pass>
SNOWFLAKE_DATABASE=<db>
SNOWFLAKE_SCHEMA=<schema>
SNOWFLAKE_WAREHOUSE=<warehouse>
```

## 5. Fallback (bez Snowflake)

Jeśli Snowflake nie jest skonfigurowany, API serwuje statyczne pliki GeoJSON z `public/data/fallback/`. Aktualnie dostępne:

| Plik                       | Warstwa            | Rekordów |
|----------------------------|--------------------|----------|
| `poi-hospitals.geojson`    | poi-hospitals      | 18       |
| `poi-schools.geojson`      | poi-schools        | 25       |
| `poi-kindergartens.geojson`| poi-kindergartens  | 15       |
| `poi-care-homes.geojson`   | poi-care-homes     | 10       |
| `env-air-quality.geojson`  | env-air-quality    | 9        |

Warstwy admin i H3 **nie mają fallbacku** — wymagają Snowflake.
