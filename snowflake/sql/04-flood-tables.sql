-- ============================================================
-- SZTAB KRYZYSOWY — Krok 4: Flood Scenario Tables & Views
-- ============================================================

USE DATABASE SZTAB_DB;
USE SCHEMA PUBLIC;

-- 4.1 Rzeki (centerlines z OSM)
CREATE TABLE IF NOT EXISTS raw_rivers (
  osm_id BIGINT NOT NULL,
  name STRING,
  length_km FLOAT,
  geo GEOGRAPHY NOT NULL,           -- LineString
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- 4.2 Wodowskazy (stacje pomiarowe IMGW)
CREATE TABLE IF NOT EXISTS raw_water_gauges (
  station_id INT NOT NULL,
  station_name STRING,
  river_name STRING,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  geo GEOGRAPHY,                     -- ST_MAKEPOINT(longitude, latitude)
  alarm_level_cm INT,
  warning_level_cm INT,
  h3_res7 STRING,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- 4.3 Pomiary poziomu wody (serie czasowe)
CREATE TABLE IF NOT EXISTS raw_water_measurements (
  station_id INT NOT NULL,
  water_level_cm INT NOT NULL,
  flow_m3s FLOAT,
  measure_time TIMESTAMP NOT NULL,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- 4.4 Aktualny stan wodowskazów
CREATE OR REPLACE VIEW v_water_gauges_current AS
SELECT g.station_id, g.station_name, g.river_name,
       g.latitude, g.longitude, g.alarm_level_cm, g.warning_level_cm,
       m.water_level_cm, m.measure_time,
       CASE
         WHEN m.water_level_cm >= g.alarm_level_cm THEN 'alarmowy'
         WHEN m.water_level_cm >= g.warning_level_cm THEN 'ostrzegawczy'
         WHEN m.water_level_cm >= g.warning_level_cm * 0.7 THEN 'normalny'
         ELSE 'niski'
       END AS status
FROM raw_water_gauges g
JOIN raw_water_measurements m ON g.station_id = m.station_id
QUALIFY ROW_NUMBER() OVER (PARTITION BY g.station_id ORDER BY m.measure_time DESC) = 1;

-- 4.5 H3 Flood Risk — cross-analysis: odległość od rzeki × gęstość POI × populacja
CREATE OR REPLACE VIEW v_h3_flood_risk AS
WITH river_dist AS (
  SELECT d.h3_index,
         d.poi_count,
         d.total_population,
         d.amenity_types,
         MIN(ROUND(ST_DISTANCE(H3_CELL_TO_BOUNDARY(d.h3_index), r.geo) / 1000, 2)) AS distance_to_river_km
  FROM v_h3_poi_density d
  CROSS JOIN raw_rivers r
  GROUP BY d.h3_index, d.poi_count, d.total_population, d.amenity_types
)
SELECT h3_index, poi_count, total_population, amenity_types,
       distance_to_river_km,
       ROUND(total_population / GREATEST(distance_to_river_km, 0.1), 2) AS flood_risk,
       ST_ASGEOJSON(H3_CELL_TO_BOUNDARY(h3_index)) AS hex_boundary
FROM river_dist;
