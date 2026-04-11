# SZTAB KRYZYSOWY — Specyfikacja Snowflake (Cortex Code CLI)

> Ten dokument opisuje **wszystko co powstaje w Snowflake** — schemat, tabele, widoki, H3 analitykę, ingestion pipeline, scheduled tasks i external functions. Wykonywane przez **Cortex Code CLI**.

---

## 1. Środowisko

```
Account:    [free trial]
Warehouse:  SZTAB_WH (X-Small, auto-suspend 60s, auto-resume)
Database:   SZTAB_DB
Schema:     PUBLIC
```

```sql
CREATE WAREHOUSE IF NOT EXISTS SZTAB_WH 
  WAREHOUSE_SIZE = 'X-SMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE;
CREATE DATABASE IF NOT EXISTS SZTAB_DB;
USE DATABASE SZTAB_DB;
USE SCHEMA PUBLIC;
```

---

## 2. Raw Tables (ingestion)

### 2.1 Granice administracyjne

```sql
CREATE OR REPLACE TABLE raw_admin_boundaries (
  teryt STRING NOT NULL,
  name STRING NOT NULL,
  level STRING NOT NULL,            -- 'wojewodztwo', 'powiat', 'gmina'
  geo GEOGRAPHY NOT NULL,           -- polygon z GeoJSON
  population INT,
  area_km2 FLOAT,
  h3_res5 ARRAY,                    -- H3 cells pokrywające polygon (res 5)
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
```

**Źródło danych**: GeoJSON z github.com/ppatrzyk/polska-geojson, przefiltrowane do woj. lubelskiego (TERYT prefix "06").

**Seed**: Upload GeoJSON na internal stage → `COPY INTO` z transformacją:
```sql
CREATE OR REPLACE STAGE stg_geojson;
-- Po PUT pliku:
COPY INTO raw_admin_boundaries (teryt, name, level, geo, population, area_km2)
FROM (
  SELECT 
    $1:properties:TERYT::STRING,
    $1:properties:NAZWA::STRING,
    $1:properties:LEVEL::STRING,
    TO_GEOGRAPHY($1:geometry),
    $1:properties:POPULATION::INT,
    $1:properties:AREA_KM2::FLOAT
  FROM @stg_geojson/lubelskie-gminy.json (FILE_FORMAT => 'json_format')
);
```

### 2.2 POI — obiekty wrażliwe (szpitale, szkoły, DPS, kliniki, przedszkola)

```sql
CREATE OR REPLACE TABLE raw_osm_pois (
  osm_id BIGINT NOT NULL,
  name STRING,
  amenity_type STRING NOT NULL,      -- 'hospital','school','kindergarten','nursing_home','clinic','social_facility'
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  tags VARIANT,                      -- pełny JSON z OSM tags
  estimated_population INT,          -- szacunek: hospital=500, school=300, kindergarten=80, nursing_home=100, clinic=50
  geo GEOGRAPHY,                     -- obliczane: ST_MAKEPOINT(longitude, latitude)
  h3_res7 STRING,                    -- obliczane: H3_LATLNG_TO_CELL(latitude, longitude, 7)
  h3_res9 STRING,                    -- obliczane: H3_LATLNG_TO_CELL(latitude, longitude, 9)
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
```

**Źródło**: OpenStreetMap Overpass API, query:
```
[out:json][timeout:60];
area["name"="województwo lubelskie"]->.a;
(nwr["amenity"~"school|kindergarten|hospital|nursing_home|clinic|social_facility"](area.a););
out center;
```

**Seed**: Po uploadziel JSON na stage:
```sql
COPY INTO raw_osm_pois (osm_id, name, amenity_type, latitude, longitude, tags, estimated_population, geo, h3_res7, h3_res9)
FROM (
  SELECT 
    $1:id::BIGINT,
    $1:tags:name::STRING,
    $1:tags:amenity::STRING,
    $1:lat::FLOAT,
    $1:lon::FLOAT,
    $1:tags,
    CASE $1:tags:amenity::STRING
      WHEN 'hospital' THEN 500
      WHEN 'school' THEN 300
      WHEN 'kindergarten' THEN 80
      WHEN 'nursing_home' THEN 100
      WHEN 'clinic' THEN 50
      ELSE 30
    END,
    ST_MAKEPOINT($1:lon::FLOAT, $1:lat::FLOAT),
    H3_LATLNG_TO_CELL($1:lat::FLOAT, $1:lon::FLOAT, 7),
    H3_LATLNG_TO_CELL($1:lat::FLOAT, $1:lon::FLOAT, 9)
  FROM @stg_geojson/osm-pois.json (FILE_FORMAT => 'json_format')
);
```

### 2.3 Stacje GIOŚ (pomiary jakości powietrza)

```sql
CREATE OR REPLACE TABLE raw_gios_stations (
  station_id INT NOT NULL,
  station_name STRING,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  city STRING,
  commune STRING,
  province STRING,
  geo GEOGRAPHY,                     -- ST_MAKEPOINT(longitude, latitude)
  h3_res7 STRING,                    -- H3_LATLNG_TO_CELL(latitude, longitude, 7)
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

CREATE OR REPLACE TABLE raw_gios_measurements (
  station_id INT NOT NULL,
  sensor_id INT NOT NULL,
  param_code STRING NOT NULL,        -- 'PM10','PM25','SO2','NO2','O3','CO','C6H6'
  value FLOAT,
  measure_date TIMESTAMP NOT NULL,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
```

**Źródło**: GIOŚ REST API v1
- `GET https://api.gios.gov.pl/pjp-api/v1/rest/station/findAll`
- `GET https://api.gios.gov.pl/pjp-api/v1/rest/station/sensors/{stationId}`
- `GET https://api.gios.gov.pl/pjp-api/v1/rest/data/getData/{sensorId}`
- `GET https://api.gios.gov.pl/pjp-api/v1/rest/aqindex/getIndex/{stationId}`

**Filtr**: tylko stacje z `province = "LUBELSKIE"` (~15 stacji)

### 2.4 Pogoda

```sql
CREATE OR REPLACE TABLE raw_weather (
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  temperature FLOAT,
  wind_speed FLOAT,                  -- km/h
  wind_direction FLOAT,              -- stopnie (0=N, 90=E, 180=S, 270=W)
  humidity FLOAT,
  precipitation FLOAT,
  measure_time TIMESTAMP NOT NULL,
  h3_res7 STRING,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);
```

**Źródło**: Open-Meteo API (darmowe, bez klucza)
- `GET https://api.open-meteo.com/v1/forecast?latitude=51.25&longitude=22.57&current=temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m,precipitation`

**Punkty pomiarowe**: Lublin (51.25, 22.57), Puławy (51.42, 21.97), Zamość (50.72, 23.25), Chełm (51.13, 23.47), Biała Podlaska (52.03, 23.12)

### 2.5 File format

```sql
CREATE OR REPLACE FILE FORMAT json_format
  TYPE = 'JSON'
  STRIP_OUTER_ARRAY = TRUE;

CREATE OR REPLACE FILE FORMAT csv_format
  TYPE = 'CSV'
  SKIP_HEADER = 1
  FIELD_OPTIONALLY_ENCLOSED_BY = '"';
```

---

## 3. Serving Views

### 3.1 Aktualna jakość powietrza (per stacja)

```sql
CREATE OR REPLACE VIEW v_air_quality_current AS
SELECT s.station_id, s.station_name, s.latitude, s.longitude, s.h3_res7,
       m.param_code, m.value, m.measure_date,
       CASE 
         WHEN m.param_code = 'PM10' AND m.value <= 50 THEN 'dobry'
         WHEN m.param_code = 'PM10' AND m.value <= 100 THEN 'umiarkowany'
         WHEN m.param_code = 'PM10' AND m.value <= 150 THEN 'niezdrowy'
         WHEN m.param_code = 'PM10' AND m.value > 150 THEN 'zły'
         ELSE 'brak danych'
       END AS aqi_label,
       CASE 
         WHEN m.param_code = 'PM10' AND m.value <= 50 THEN 1
         WHEN m.param_code = 'PM10' AND m.value <= 100 THEN 2
         WHEN m.param_code = 'PM10' AND m.value <= 150 THEN 3
         WHEN m.param_code = 'PM10' AND m.value > 150 THEN 4
         ELSE 0
       END AS aqi_level
FROM raw_gios_stations s
JOIN raw_gios_measurements m ON s.station_id = m.station_id
QUALIFY ROW_NUMBER() OVER (PARTITION BY s.station_id, m.param_code ORDER BY m.measure_date DESC) = 1;
```

### 3.2 Statystyki per powiat

```sql
CREATE OR REPLACE VIEW v_powiat_stats AS
SELECT b.teryt, b.name, b.population, b.area_km2,
       COUNT(DISTINCT CASE WHEN p.amenity_type = 'hospital' THEN p.osm_id END) AS hospitals,
       COUNT(DISTINCT CASE WHEN p.amenity_type = 'school' THEN p.osm_id END) AS schools,
       COUNT(DISTINCT CASE WHEN p.amenity_type = 'kindergarten' THEN p.osm_id END) AS kindergartens,
       COUNT(DISTINCT CASE WHEN p.amenity_type = 'nursing_home' THEN p.osm_id END) AS care_homes,
       COUNT(DISTINCT CASE WHEN p.amenity_type = 'clinic' THEN p.osm_id END) AS clinics,
       SUM(p.estimated_population) AS total_poi_population
FROM raw_admin_boundaries b
LEFT JOIN raw_osm_pois p ON ST_WITHIN(p.geo, b.geo)
WHERE b.level = 'powiat'
GROUP BY b.teryt, b.name, b.population, b.area_km2;
```

### 3.3 POI z agregacją per powiat (per typ)

```sql
CREATE OR REPLACE VIEW v_poi_by_powiat AS
SELECT b.teryt, b.name AS powiat, p.amenity_type,
       COUNT(*) AS count,
       SUM(p.estimated_population) AS total_population
FROM raw_osm_pois p
JOIN raw_admin_boundaries b ON ST_WITHIN(p.geo, b.geo) AND b.level = 'powiat'
GROUP BY b.teryt, b.name, p.amenity_type;
```

### 3.4 Aktualna pogoda

```sql
CREATE OR REPLACE VIEW v_weather_current AS
SELECT latitude, longitude, temperature, wind_speed, wind_direction,
       humidity, precipitation, measure_time, h3_res7
FROM raw_weather
QUALIFY ROW_NUMBER() OVER (PARTITION BY latitude, longitude ORDER BY measure_time DESC) = 1;
```

---

## 4. H3 Hexagonal Analytics

### 4.1 Gęstość infrastruktury (POI density heatmap)

```sql
CREATE OR REPLACE VIEW v_h3_poi_density AS
SELECT h3_res7 AS h3_index,
       COUNT(*) AS poi_count,
       SUM(estimated_population) AS total_population,
       ARRAY_AGG(DISTINCT amenity_type) AS amenity_types,
       COUNT(DISTINCT CASE WHEN amenity_type = 'hospital' THEN osm_id END) AS hospital_count,
       COUNT(DISTINCT CASE WHEN amenity_type = 'school' THEN osm_id END) AS school_count,
       H3_CELL_TO_BOUNDARY(h3_res7) AS hex_boundary
FROM raw_osm_pois
WHERE h3_res7 IS NOT NULL
GROUP BY h3_res7;
```

### 4.2 Jakość powietrza interpolowana (H3 heatmap)

Rozszerza punktowe odczyty stacji GIOŚ na sąsiednie heksagony (3-ring ≈ 15km radius):

```sql
CREATE OR REPLACE VIEW v_h3_air_quality AS
SELECT n.value::STRING AS h3_index,
       AVG(aq.value) AS avg_value,
       MAX(aq.value) AS max_value,
       aq.param_code,
       H3_CELL_TO_BOUNDARY(n.value::STRING) AS hex_boundary
FROM v_air_quality_current aq,
     LATERAL FLATTEN(input => H3_GRID_DISK(aq.h3_res7, 3)) n
WHERE aq.param_code = 'PM10'
  AND aq.value IS NOT NULL
GROUP BY n.value::STRING, aq.param_code;
```

### 4.3 Wskaźnik ryzyka (cross-analysis: AQI x populacja)

```sql
CREATE OR REPLACE VIEW v_h3_risk_score AS
SELECT d.h3_index,
       d.poi_count,
       d.total_population,
       d.amenity_types,
       COALESCE(a.avg_value, 0) AS avg_pm10,
       ROUND(d.total_population * COALESCE(a.avg_value, 0) / 100, 2) AS risk_score,
       d.hex_boundary
FROM v_h3_poi_density d
LEFT JOIN v_h3_air_quality a ON d.h3_index = a.h3_index AND a.param_code = 'PM10';
```

### 4.4 Query ad-hoc: obiekty w promieniu (wywoływane z API)

```sql
-- Parametry: :lon, :lat, :radius_m
SELECT osm_id, name, amenity_type, latitude, longitude, estimated_population,
       ST_DISTANCE(geo, ST_MAKEPOINT(:lon, :lat)) AS distance_m,
       h3_res7
FROM raw_osm_pois
WHERE ST_DWITHIN(geo, ST_MAKEPOINT(:lon, :lat), :radius_m)
ORDER BY distance_m;
```

### 4.5 Query ad-hoc: obiekty w strefie zagrożenia (scenariusz)

```sql
-- Parametr: :cloud_geojson (GeoJSON polygon jako string)
SELECT osm_id, name, amenity_type, latitude, longitude, estimated_population,
       h3_res7,
       ST_DISTANCE(geo, ST_MAKEPOINT(:origin_lon, :origin_lat)) AS distance_from_source
FROM raw_osm_pois
WHERE ST_WITHIN(geo, TO_GEOGRAPHY(:cloud_geojson))
ORDER BY distance_from_source;

-- Agregacja H3 strefy zagrożenia
SELECT h3_res7 AS h3_index,
       COUNT(*) AS affected_pois,
       SUM(estimated_population) AS affected_population,
       ARRAY_AGG(DISTINCT amenity_type) AS affected_types,
       H3_CELL_TO_BOUNDARY(h3_res7) AS hex_boundary
FROM raw_osm_pois
WHERE ST_WITHIN(geo, TO_GEOGRAPHY(:cloud_geojson))
GROUP BY h3_res7;
```

---

## 5. Ingestion Pipeline (Scheduled Tasks)

### 5.1 External Functions (fetch z API)

Snowflake external functions wymagają API Integration (AWS API Gateway / Azure Function). Alternatywnie: **Snowflake Cortex** lub **Snowpark Python UDFs**.

**Opcja A: Snowpark Python UDF** (prostsze na hackathonie):

```sql
CREATE OR REPLACE FUNCTION fetch_gios_stations()
RETURNS TABLE (station_id INT, station_name STRING, latitude FLOAT, longitude FLOAT, city STRING, commune STRING, province STRING)
LANGUAGE PYTHON
RUNTIME_VERSION = '3.11'
PACKAGES = ('requests')
HANDLER = 'GiosHandler'
AS $$
import requests

class GiosHandler:
    def process(self):
        resp = requests.get('https://api.gios.gov.pl/pjp-api/v1/rest/station/findAll')
        stations = resp.json()
        for s in stations:
            if s.get('city', {}).get('commune', {}).get('provinceName') == 'LUBELSKIE':
                yield (
                    s['id'], s['stationName'],
                    float(s['gegrLat']), float(s['gegrLon']),
                    s.get('city', {}).get('name', ''),
                    s.get('city', {}).get('commune', {}).get('communeName', ''),
                    'LUBELSKIE'
                )
$$;

CREATE OR REPLACE FUNCTION fetch_gios_measurements(station_id INT)
RETURNS TABLE (sensor_id INT, param_code STRING, value FLOAT, measure_date TIMESTAMP)
LANGUAGE PYTHON
RUNTIME_VERSION = '3.11'
PACKAGES = ('requests')
HANDLER = 'MeasurementHandler'
AS $$
import requests
from datetime import datetime

class MeasurementHandler:
    def process(self, station_id):
        sensors = requests.get(f'https://api.gios.gov.pl/pjp-api/v1/rest/station/sensors/{station_id}').json()
        for sensor in sensors:
            data = requests.get(f'https://api.gios.gov.pl/pjp-api/v1/rest/data/getData/{sensor["id"]}').json()
            param = data.get('key', '')
            for val in (data.get('values') or []):
                if val.get('value') is not None:
                    yield (sensor['id'], param, float(val['value']), datetime.fromisoformat(val['date']))
$$;

CREATE OR REPLACE FUNCTION fetch_weather(lat FLOAT, lon FLOAT)
RETURNS TABLE (temperature FLOAT, wind_speed FLOAT, wind_direction FLOAT, humidity FLOAT, precipitation FLOAT, measure_time TIMESTAMP)
LANGUAGE PYTHON
RUNTIME_VERSION = '3.11'
PACKAGES = ('requests')
HANDLER = 'WeatherHandler'
AS $$
import requests
from datetime import datetime

class WeatherHandler:
    def process(self, lat, lon):
        url = f'https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,wind_speed_10m,wind_direction_10m,relative_humidity_2m,precipitation'
        data = requests.get(url).json().get('current', {})
        yield (
            data.get('temperature_2m'), data.get('wind_speed_10m'),
            data.get('wind_direction_10m'), data.get('relative_humidity_2m'),
            data.get('precipitation'), datetime.fromisoformat(data.get('time', ''))
        )
$$;
```

### 5.2 Stored Procedures (refresh logic)

```sql
CREATE OR REPLACE PROCEDURE refresh_gios_data()
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
  -- Refresh stacji (rzadko się zmieniają, ale na wszelki wypadek)
  MERGE INTO raw_gios_stations tgt
  USING (SELECT * FROM TABLE(fetch_gios_stations())) src
  ON tgt.station_id = src.station_id
  WHEN MATCHED THEN UPDATE SET station_name = src.station_name, latitude = src.latitude, longitude = src.longitude
  WHEN NOT MATCHED THEN INSERT (station_id, station_name, latitude, longitude, city, commune, province, geo, h3_res7)
    VALUES (src.station_id, src.station_name, src.latitude, src.longitude, src.city, src.commune, src.province,
            ST_MAKEPOINT(src.longitude, src.latitude), H3_LATLNG_TO_CELL(src.latitude, src.longitude, 7));

  -- Refresh pomiarów (dla każdej stacji)
  INSERT INTO raw_gios_measurements (station_id, sensor_id, param_code, value, measure_date)
  SELECT s.station_id, m.sensor_id, m.param_code, m.value, m.measure_date
  FROM raw_gios_stations s,
       TABLE(fetch_gios_measurements(s.station_id)) m
  WHERE NOT EXISTS (
    SELECT 1 FROM raw_gios_measurements e 
    WHERE e.sensor_id = m.sensor_id AND e.measure_date = m.measure_date
  );

  RETURN 'GIOS refresh complete';
END;
$$;

CREATE OR REPLACE PROCEDURE refresh_weather_data()
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
  -- 5 punktów pomiarowych w woj. lubelskim
  INSERT INTO raw_weather (latitude, longitude, temperature, wind_speed, wind_direction, humidity, precipitation, measure_time, h3_res7)
  SELECT 51.25, 22.57, w.* , H3_LATLNG_TO_CELL(51.25, 22.57, 7) FROM TABLE(fetch_weather(51.25, 22.57)) w
  UNION ALL
  SELECT 51.42, 21.97, w.*, H3_LATLNG_TO_CELL(51.42, 21.97, 7) FROM TABLE(fetch_weather(51.42, 21.97)) w
  UNION ALL
  SELECT 50.72, 23.25, w.*, H3_LATLNG_TO_CELL(50.72, 23.25, 7) FROM TABLE(fetch_weather(50.72, 23.25)) w
  UNION ALL
  SELECT 51.13, 23.47, w.*, H3_LATLNG_TO_CELL(51.13, 23.47, 7) FROM TABLE(fetch_weather(51.13, 23.47)) w
  UNION ALL
  SELECT 52.03, 23.12, w.*, H3_LATLNG_TO_CELL(52.03, 23.12, 7) FROM TABLE(fetch_weather(52.03, 23.12)) w;

  RETURN 'Weather refresh complete';
END;
$$;
```

### 5.3 Scheduled Tasks

```sql
-- Odświeżanie GIOŚ co 5 minut
CREATE OR REPLACE TASK task_refresh_gios
  WAREHOUSE = SZTAB_WH
  SCHEDULE = '5 MINUTE'
AS
  CALL refresh_gios_data();

-- Odświeżanie pogody co 10 minut
CREATE OR REPLACE TASK task_refresh_weather
  WAREHOUSE = SZTAB_WH
  SCHEDULE = '10 MINUTE'
AS
  CALL refresh_weather_data();

-- Uruchomienie tasków
ALTER TASK task_refresh_gios RESUME;
ALTER TASK task_refresh_weather RESUME;
```

---

## 6. Kontrakt API (co frontend oczekuje od Snowflake)

Frontend (Next.js API Routes) wykonuje SQL queries i oczekuje danych w formacie gotowym do konwersji na GeoJSON.

### Query per warstwa (wywoływane z `/api/layers/[layerId]`):

| Warstwa | View/Query | Kolumny geo | Cache TTL |
|---------|-----------|-------------|-----------|
| admin-powiaty | `SELECT teryt, name, population, area_km2, geo FROM raw_admin_boundaries WHERE level='powiat'` | `geo` (GEOGRAPHY polygon) | 1h |
| admin-gminy | `SELECT teryt, name, population, geo FROM raw_admin_boundaries WHERE level='gmina'` | `geo` | 1h |
| poi-hospitals | `SELECT osm_id, name, latitude, longitude, estimated_population, tags FROM raw_osm_pois WHERE amenity_type='hospital'` | `latitude, longitude` | 1h |
| poi-schools | `SELECT ... WHERE amenity_type='school'` | `latitude, longitude` | 1h |
| env-air-quality | `SELECT * FROM v_air_quality_current` | `latitude, longitude` | 5 min |
| weather | `SELECT * FROM v_weather_current` | `latitude, longitude` | 10 min |
| h3-poi-density | `SELECT * FROM v_h3_poi_density` | `hex_boundary` (GEOGRAPHY) | 1h |
| h3-air-quality | `SELECT * FROM v_h3_air_quality` | `hex_boundary` | 5 min |
| h3-risk-score | `SELECT * FROM v_h3_risk_score` | `hex_boundary` | 5 min |

### Konwersja GEOGRAPHY → GeoJSON:

Snowflake zwraca GEOGRAPHY jako GeoJSON string. Frontend parsuje:
```
ST_ASGEOJSON(geo) → '{"type":"Polygon","coordinates":[...]}'
```

Albo używa `TO_VARCHAR(geo)` który domyślnie zwraca GeoJSON.

---

## 7. Weryfikacja (checklist Cortex Code)

- [ ] Warehouse `SZTAB_WH` utworzony i działa
- [ ] Wszystkie 5 tabel (`raw_admin_boundaries`, `raw_osm_pois`, `raw_gios_stations`, `raw_gios_measurements`, `raw_weather`) utworzone
- [ ] Dane seed: granice admin załadowane (~213 gmin + 24 powiaty + 1 woj.)
- [ ] Dane seed: POI załadowane (szpitale, szkoły, DPS z OSM)
- [ ] Dane seed: stacje GIOŚ załadowane (~15 stacji lubelskich)
- [ ] H3 indeksy obliczone (h3_res7, h3_res9) w raw_osm_pois
- [ ] View `v_air_quality_current` zwraca dane
- [ ] View `v_powiat_stats` zwraca statystyki per powiat
- [ ] View `v_h3_poi_density` zwraca heksagony z poi_count
- [ ] View `v_h3_air_quality` zwraca interpolowane PM10 na hexach
- [ ] View `v_h3_risk_score` zwraca risk_score per hex
- [ ] Stored procedure `refresh_gios_data()` wykonuje się bez błędów
- [ ] Stored procedure `refresh_weather_data()` wykonuje się bez błędów
- [ ] Tasks `task_refresh_gios` i `task_refresh_weather` uruchomione (RESUME)
- [ ] Query ad-hoc "obiekty w promieniu 30km od Puław" zwraca wyniki
- [ ] Query ad-hoc z GeoJSON polygon (ST_WITHIN) zwraca obiekty w strefie
