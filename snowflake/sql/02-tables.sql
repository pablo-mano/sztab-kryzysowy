-- ============================================================
-- SZTAB KRYZYSOWY — Krok 2: Raw Tables
-- ============================================================

USE DATABASE SZTAB_DB;
USE SCHEMA PUBLIC;

-- 2.1 Granice administracyjne (woj, powiaty, gminy)
CREATE OR REPLACE TABLE raw_admin_boundaries (
  teryt STRING NOT NULL,
  name STRING NOT NULL,
  level STRING NOT NULL,            -- 'wojewodztwo', 'powiat', 'gmina'
  geo GEOGRAPHY NOT NULL,           -- polygon z GeoJSON
  population INT,
  area_km2 FLOAT,
  h3_res5 ARRAY,                    -- H3 cells pokrywajace polygon (res 5)
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- 2.2 POI — obiekty wrazliwe (szpitale, szkoly, DPS, kliniki, przedszkola)
CREATE OR REPLACE TABLE raw_osm_pois (
  osm_id BIGINT NOT NULL,
  name STRING,
  amenity_type STRING NOT NULL,      -- 'hospital','school','kindergarten','nursing_home','clinic','social_facility'
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  tags VARIANT,                      -- pelny JSON z OSM tags
  estimated_population INT,          -- szacunek: hospital=500, school=300, kindergarten=80, nursing_home=100, clinic=50
  city STRING,                       -- miasto/miejscowosc
  geo GEOGRAPHY,                     -- ST_MAKEPOINT(longitude, latitude)
  h3_res7 STRING,                    -- H3_LATLNG_TO_CELL(latitude, longitude, 7)
  h3_res9 STRING,                    -- H3_LATLNG_TO_CELL(latitude, longitude, 9)
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- 2.3 Stacje GIOS (pomiary jakosci powietrza)
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

-- 2.4 Pogoda
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
