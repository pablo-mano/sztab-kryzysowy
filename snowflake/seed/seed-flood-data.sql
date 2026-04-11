-- ============================================================
-- SEED: Dane demonstracyjne dla scenariusza powodziowego
-- Rzeki, wodowskazy, pomiary poziomu wody
-- ============================================================

USE DATABASE SZTAB_DB;
USE SCHEMA PUBLIC;

-- ============================================================
-- 1. RZEKI — Wisła i Wieprz przez woj. lubelskie
-- ============================================================

INSERT INTO raw_rivers (osm_id, name, length_km, geo) VALUES
(1, 'Wisła', 85.0,
  ST_GEOGRAPHYFROMWKB(ST_ASWKB(TO_GEOGRAPHY('LINESTRING(
    21.86 50.81, 21.83 50.86, 21.80 50.92, 21.78 50.98,
    21.80 51.04, 21.82 51.10, 21.84 51.15, 21.85 51.19,
    21.87 51.24, 21.91 51.30, 21.94 51.35, 21.97 51.40,
    21.97 51.42, 21.95 51.46, 21.91 51.50, 21.87 51.53,
    21.84 51.56, 21.82 51.59, 21.80 51.62
  )')))
),
(2, 'Wieprz', 70.0,
  ST_GEOGRAPHYFROMWKB(ST_ASWKB(TO_GEOGRAPHY('LINESTRING(
    23.27 50.97, 23.10 50.99, 22.92 51.02, 22.77 51.05,
    22.57 51.10, 22.42 51.15, 22.30 51.19, 22.17 51.22,
    22.07 51.24, 21.97 51.27, 21.92 51.32, 21.90 51.37,
    21.94 51.40, 21.97 51.42
  )')))
);

-- ============================================================
-- 2. WODOWSKAZY — stacje pomiarowe wzdłuż Wisły
-- ============================================================

INSERT INTO raw_water_gauges (station_id, station_name, river_name, latitude, longitude, geo, alarm_level_cm, warning_level_cm) VALUES
(101, 'Zawichost',       'Wisła',  50.81, 21.86, ST_MAKEPOINT(21.86, 50.81), 700, 500),
(102, 'Annopol',         'Wisła',  50.92, 21.80, ST_MAKEPOINT(21.80, 50.92), 680, 480),
(103, 'Kazimierz Dolny', 'Wisła',  51.19, 21.85, ST_MAKEPOINT(21.85, 51.19), 720, 520),
(104, 'Puławy',          'Wisła',  51.42, 21.97, ST_MAKEPOINT(21.97, 51.42), 750, 530),
(105, 'Dęblin',          'Wisła',  51.59, 21.82, ST_MAKEPOINT(21.82, 51.59), 700, 500),
(106, 'Lublin (Wieprz)', 'Wieprz', 51.24, 22.57, ST_MAKEPOINT(22.57, 51.24), 400, 300),
(107, 'Kośmin',          'Wieprz', 51.15, 22.30, ST_MAKEPOINT(22.30, 51.15), 420, 310),
(108, 'Łęczna',          'Wieprz', 51.10, 22.92, ST_MAKEPOINT(22.92, 51.10), 380, 280);

-- ============================================================
-- 3. POMIARY — 72h serii czasowej (narastający przybór)
-- Generowane: baseline ~300cm, narastanie do poziomu alarmowego
-- ============================================================

-- Zawichost (101) — poziom alarmowy 700cm
INSERT INTO raw_water_measurements (station_id, water_level_cm, flow_m3s, measure_time)
SELECT 101,
       ROUND(300 + (ROW_NUMBER() OVER (ORDER BY seq4()) * 5.5) + UNIFORM(-10, 10, RANDOM())),
       ROUND(150 + (ROW_NUMBER() OVER (ORDER BY seq4()) * 3), 1),
       DATEADD(hour, -72 + ROW_NUMBER() OVER (ORDER BY seq4()), CURRENT_TIMESTAMP())
FROM TABLE(GENERATOR(ROWCOUNT => 72));

-- Annopol (102) — opóźnienie ~3h
INSERT INTO raw_water_measurements (station_id, water_level_cm, flow_m3s, measure_time)
SELECT 102,
       ROUND(290 + (GREATEST(0, ROW_NUMBER() OVER (ORDER BY seq4()) - 3) * 5.2) + UNIFORM(-10, 10, RANDOM())),
       ROUND(140 + (GREATEST(0, ROW_NUMBER() OVER (ORDER BY seq4()) - 3) * 2.8), 1),
       DATEADD(hour, -72 + ROW_NUMBER() OVER (ORDER BY seq4()), CURRENT_TIMESTAMP())
FROM TABLE(GENERATOR(ROWCOUNT => 72));

-- Kazimierz Dolny (103) — opóźnienie ~8h
INSERT INTO raw_water_measurements (station_id, water_level_cm, flow_m3s, measure_time)
SELECT 103,
       ROUND(310 + (GREATEST(0, ROW_NUMBER() OVER (ORDER BY seq4()) - 8) * 5.8) + UNIFORM(-10, 10, RANDOM())),
       ROUND(160 + (GREATEST(0, ROW_NUMBER() OVER (ORDER BY seq4()) - 8) * 3.2), 1),
       DATEADD(hour, -72 + ROW_NUMBER() OVER (ORDER BY seq4()), CURRENT_TIMESTAMP())
FROM TABLE(GENERATOR(ROWCOUNT => 72));

-- Puławy (104) — opóźnienie ~14h
INSERT INTO raw_water_measurements (station_id, water_level_cm, flow_m3s, measure_time)
SELECT 104,
       ROUND(320 + (GREATEST(0, ROW_NUMBER() OVER (ORDER BY seq4()) - 14) * 6.0) + UNIFORM(-10, 10, RANDOM())),
       ROUND(170 + (GREATEST(0, ROW_NUMBER() OVER (ORDER BY seq4()) - 14) * 3.5), 1),
       DATEADD(hour, -72 + ROW_NUMBER() OVER (ORDER BY seq4()), CURRENT_TIMESTAMP())
FROM TABLE(GENERATOR(ROWCOUNT => 72));

-- Dęblin (105) — opóźnienie ~20h
INSERT INTO raw_water_measurements (station_id, water_level_cm, flow_m3s, measure_time)
SELECT 105,
       ROUND(295 + (GREATEST(0, ROW_NUMBER() OVER (ORDER BY seq4()) - 20) * 5.5) + UNIFORM(-10, 10, RANDOM())),
       ROUND(145 + (GREATEST(0, ROW_NUMBER() OVER (ORDER BY seq4()) - 20) * 2.9), 1),
       DATEADD(hour, -72 + ROW_NUMBER() OVER (ORDER BY seq4()), CURRENT_TIMESTAMP())
FROM TABLE(GENERATOR(ROWCOUNT => 72));

-- Lublin/Wieprz (106) — stabilny, niski poziom
INSERT INTO raw_water_measurements (station_id, water_level_cm, flow_m3s, measure_time)
SELECT 106,
       ROUND(180 + UNIFORM(-15, 15, RANDOM())),
       ROUND(40 + UNIFORM(-5, 5, RANDOM()), 1),
       DATEADD(hour, -72 + ROW_NUMBER() OVER (ORDER BY seq4()), CURRENT_TIMESTAMP())
FROM TABLE(GENERATOR(ROWCOUNT => 72));

-- Kośmin/Wieprz (107) — lekki wzrost
INSERT INTO raw_water_measurements (station_id, water_level_cm, flow_m3s, measure_time)
SELECT 107,
       ROUND(200 + (ROW_NUMBER() OVER (ORDER BY seq4()) * 1.5) + UNIFORM(-10, 10, RANDOM())),
       ROUND(50 + (ROW_NUMBER() OVER (ORDER BY seq4()) * 0.8), 1),
       DATEADD(hour, -72 + ROW_NUMBER() OVER (ORDER BY seq4()), CURRENT_TIMESTAMP())
FROM TABLE(GENERATOR(ROWCOUNT => 72));

-- Łęczna/Wieprz (108) — stabilny
INSERT INTO raw_water_measurements (station_id, water_level_cm, flow_m3s, measure_time)
SELECT 108,
       ROUND(160 + UNIFORM(-10, 10, RANDOM())),
       ROUND(30 + UNIFORM(-3, 3, RANDOM()), 1),
       DATEADD(hour, -72 + ROW_NUMBER() OVER (ORDER BY seq4()), CURRENT_TIMESTAMP())
FROM TABLE(GENERATOR(ROWCOUNT => 72));

-- Dodaj indeks H3 do wodowskazów
UPDATE raw_water_gauges
SET h3_res7 = H3_LATLNG_TO_CELL(latitude, longitude, 7)::STRING
WHERE h3_res7 IS NULL;
