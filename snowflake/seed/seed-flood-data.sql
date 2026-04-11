-- ============================================================
-- SEED: Dane dla scenariusza powodziowego
-- Rzeki, wodowskazy z prawdziwymi lokalizacjami IMGW
-- Źródło: https://danepubliczne.imgw.pl/api/data/hydro/
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
-- 2. WODOWSKAZY — prawdziwe stacje IMGW (współrzędne z API)
-- Stany alarmowe i ostrzegawcze ze źródeł IMGW / Wody Polskie
-- ============================================================

DELETE FROM raw_water_measurements;
DELETE FROM raw_water_gauges;

-- Wisła (od południa na północ)
INSERT INTO raw_water_gauges (station_id, station_name, river_name, latitude, longitude, geo, alarm_level_cm, warning_level_cm)
  SELECT 150210150, 'Koło',        'Wisła',  50.5047, 21.5111, ST_MAKEPOINT(21.5111, 50.5047), 500, 400;
INSERT INTO raw_water_gauges (station_id, station_name, river_name, latitude, longitude, geo, alarm_level_cm, warning_level_cm)
  SELECT 150210170, 'Sandomierz',  'Wisła',  50.6725, 21.7461, ST_MAKEPOINT(21.7461, 50.6725), 600, 450;
INSERT INTO raw_water_gauges (station_id, station_name, river_name, latitude, longitude, geo, alarm_level_cm, warning_level_cm)
  SELECT 150210190, 'Zawichost',   'Wisła',  50.8058, 21.8631, ST_MAKEPOINT(21.8631, 50.8058), 620, 520;
INSERT INTO raw_water_gauges (station_id, station_name, river_name, latitude, longitude, geo, alarm_level_cm, warning_level_cm)
  SELECT 150210180, 'Annopol',     'Wisła',  50.8992, 21.8322, ST_MAKEPOINT(21.8322, 50.8992), 550, 500;
INSERT INTO raw_water_gauges (station_id, station_name, river_name, latitude, longitude, geo, alarm_level_cm, warning_level_cm)
  SELECT 151210190, 'Puławy',      'Wisła',  51.4453, 21.9456, ST_MAKEPOINT(21.9456, 51.4453), 550, 450;
INSERT INTO raw_water_gauges (station_id, station_name, river_name, latitude, longitude, geo, alarm_level_cm, warning_level_cm)
  SELECT 151210120, 'Dęblin',      'Wisła',  51.5628, 21.8264, ST_MAKEPOINT(21.8264, 51.5628), 500, 400;

-- Wieprz (od źródła do ujścia)
INSERT INTO raw_water_gauges (station_id, station_name, river_name, latitude, longitude, geo, alarm_level_cm, warning_level_cm)
  SELECT 150230080, 'Michałów',    'Wieprz', 50.7342, 23.0206, ST_MAKEPOINT(23.0206, 50.7342), 200, 150;
INSERT INTO raw_water_gauges (station_id, station_name, river_name, latitude, longitude, geo, alarm_level_cm, warning_level_cm)
  SELECT 150230010, 'Nielisz',     'Wieprz', 50.8086, 23.0411, ST_MAKEPOINT(23.0411, 50.8086), 250, 180;
INSERT INTO raw_water_gauges (station_id, station_name, river_name, latitude, longitude, geo, alarm_level_cm, warning_level_cm)
  SELECT 150230040, 'Krasnystaw',  'Wieprz', 50.9853, 23.1767, ST_MAKEPOINT(23.1767, 50.9853), 450, 350;
INSERT INTO raw_water_gauges (station_id, station_name, river_name, latitude, longitude, geo, alarm_level_cm, warning_level_cm)
  SELECT 151230010, 'Trawniki',    'Wieprz', 51.1386, 23.0011, ST_MAKEPOINT(23.0011, 51.1386), 480, 380;
INSERT INTO raw_water_gauges (station_id, station_name, river_name, latitude, longitude, geo, alarm_level_cm, warning_level_cm)
  SELECT 151220090, 'Lubartów',    'Wieprz', 51.4981, 22.6436, ST_MAKEPOINT(22.6436, 51.4981), 350, 280;
INSERT INTO raw_water_gauges (station_id, station_name, river_name, latitude, longitude, geo, alarm_level_cm, warning_level_cm)
  SELECT 151220010, 'Kośmin',      'Wieprz', 51.5731, 22.0014, ST_MAKEPOINT(22.0014, 51.5731), 380, 300;

-- ============================================================
-- 3. POMIARY — inicjalne dane (nadpisywane przez sync z IMGW API)
-- Wstawia jeden pomiar na stację z aktualnym timestampem
-- Prawdziwe wartości przyjdą z /api/imgw-sync
-- ============================================================

INSERT INTO raw_water_measurements (station_id, water_level_cm, flow_m3s, measure_time) VALUES
(150210150, 185, 227,  CURRENT_TIMESTAMP()),
(150210170, 188, 248,  CURRENT_TIMESTAMP()),
(150210190, 282, 374,  CURRENT_TIMESTAMP()),
(150210180, 243, 420,  CURRENT_TIMESTAMP()),
(151210190, 197, 527,  CURRENT_TIMESTAMP()),
(151210120, 204, 644,  CURRENT_TIMESTAMP()),
(150230080,  43,   2,  CURRENT_TIMESTAMP()),
(150230010,  14,   5,  CURRENT_TIMESTAMP()),
(150230040, 276,  11,  CURRENT_TIMESTAMP()),
(151230010, 304,  16,  CURRENT_TIMESTAMP()),
(151220090, 193,  16,  CURRENT_TIMESTAMP()),
(151220010, 175,  25,  CURRENT_TIMESTAMP());

-- Dodaj indeks H3 do wodowskazów
UPDATE raw_water_gauges
SET h3_res7 = H3_LATLNG_TO_CELL(latitude, longitude, 7)::STRING
WHERE h3_res7 IS NULL;
