-- ============================================================
-- SZTAB KRYZYSOWY — Krok 3: Serving Views
-- ============================================================

USE DATABASE SZTAB_DB;
USE SCHEMA PUBLIC;

-- 3.1 Aktualna jakosc powietrza (per stacja, najnowszy pomiar per parametr)
CREATE OR REPLACE VIEW v_air_quality_current AS
SELECT s.station_id, s.station_name, s.latitude, s.longitude, s.h3_res7,
       m.param_code, m.value, m.measure_date,
       CASE 
         WHEN m.param_code = 'PM10' AND m.value <= 50 THEN 'dobry'
         WHEN m.param_code = 'PM10' AND m.value <= 100 THEN 'umiarkowany'
         WHEN m.param_code = 'PM10' AND m.value <= 150 THEN 'niezdrowy'
         WHEN m.param_code = 'PM10' AND m.value > 150 THEN 'zly'
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

-- 3.2 Statystyki per powiat
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

-- 3.3 POI z agregacja per powiat (per typ)
CREATE OR REPLACE VIEW v_poi_by_powiat AS
SELECT b.teryt, b.name AS powiat, p.amenity_type,
       COUNT(*) AS count,
       SUM(p.estimated_population) AS total_population
FROM raw_osm_pois p
JOIN raw_admin_boundaries b ON ST_WITHIN(p.geo, b.geo) AND b.level = 'powiat'
GROUP BY b.teryt, b.name, p.amenity_type;

-- 3.4 Aktualna pogoda
CREATE OR REPLACE VIEW v_weather_current AS
SELECT latitude, longitude, temperature, wind_speed, wind_direction,
       humidity, precipitation, measure_time, h3_res7
FROM raw_weather
QUALIFY ROW_NUMBER() OVER (PARTITION BY latitude, longitude ORDER BY measure_time DESC) = 1;

-- 3.5 Gestosc infrastruktury H3 (POI density heatmap)
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

-- 3.6 Jakosc powietrza interpolowana (H3 heatmap, 3-ring ~15km radius)
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

-- 3.7 Wskaznik ryzyka (cross-analysis: AQI x populacja)
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
