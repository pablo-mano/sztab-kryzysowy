-- ============================================================
-- SZTAB KRYZYSOWY — Seed: Granice administracyjne z PRG (GUGiK)
-- ============================================================
-- Wymaga: PUT file boundaries-lubelskie.ndjson na @stg_geojson
-- Uruchom z katalogu snowflake/seed:
--   snowsql -a <account> -u <user> -d SZTAB_DB -s PUBLIC -w SZTAB_WH \
--     -q "PUT file://boundaries-lubelskie.ndjson @SZTAB_DB.PUBLIC.stg_geojson AUTO_COMPRESS=TRUE"
--   snowsql -a <account> -u <user> -d SZTAB_DB -s PUBLIC -w SZTAB_WH -f load-boundaries.sql

USE DATABASE SZTAB_DB;
USE SCHEMA PUBLIC;
USE WAREHOUSE SZTAB_WH;

-- File format for NDJSON (one JSON object per line, no outer array)
CREATE OR REPLACE FILE FORMAT ndjson_format
  TYPE = 'JSON'
  STRIP_OUTER_ARRAY = FALSE;

-- Load boundaries from stage
COPY INTO raw_admin_boundaries (teryt, name, level, geo, population, area_km2)
FROM (
  SELECT
    $1:teryt::STRING,
    $1:name::STRING,
    $1:level::STRING,
    TO_GEOGRAPHY($1:geometry),
    $1:population::INT,
    $1:area_km2::FLOAT
  FROM @stg_geojson/boundaries-lubelskie.ndjson.gz
    (FILE_FORMAT => 'ndjson_format')
);
