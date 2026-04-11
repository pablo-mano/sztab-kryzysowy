-- ============================================================
-- SZTAB KRYZYSOWY — Krok 1: Infrastruktura bazowa
-- ============================================================

CREATE WAREHOUSE IF NOT EXISTS SZTAB_WH
  WAREHOUSE_SIZE = 'X-SMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE;

CREATE DATABASE IF NOT EXISTS SZTAB_DB;

CREATE SCHEMA IF NOT EXISTS SZTAB_DB.PUBLIC;

USE DATABASE SZTAB_DB;
USE SCHEMA PUBLIC;

-- File formats
CREATE OR REPLACE FILE FORMAT json_format
  TYPE = 'JSON'
  STRIP_OUTER_ARRAY = TRUE;

CREATE OR REPLACE FILE FORMAT csv_format
  TYPE = 'CSV'
  SKIP_HEADER = 1
  FIELD_OPTIONALLY_ENCLOSED_BY = '"';

-- Internal stage for seed data uploads
CREATE OR REPLACE STAGE stg_geojson;
