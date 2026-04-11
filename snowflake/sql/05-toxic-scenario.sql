-- ============================================================
-- SZTAB KRYZYSOWY — Krok 5: Toxic Scenario — Reference Data & UDFs
-- Model Gaussowski dyspersji (Gaussian Plume)
-- ============================================================

USE DATABASE SZTAB_DB;
USE SCHEMA PUBLIC;

-- 5.1 Substancje chemiczne z progami ERPG
CREATE TABLE IF NOT EXISTS ref_toxic_substances (
  substance_id STRING PRIMARY KEY,
  name_pl STRING NOT NULL,
  formula STRING NOT NULL,
  molecular_weight FLOAT NOT NULL,   -- g/mol
  boiling_point_c FLOAT,
  density_ratio FLOAT NOT NULL,      -- vs powietrze (< 1 = lżejszy)
  erpg1_ppm FLOAT NOT NULL,          -- dyskomfort, podrażnienie
  erpg2_ppm FLOAT NOT NULL,          -- poważne skutki zdrowotne
  erpg3_ppm FLOAT NOT NULL,          -- zagrożenie życia
  idlh_ppm FLOAT NOT NULL            -- Immediately Dangerous to Life or Health
);

MERGE INTO ref_toxic_substances t USING (
  SELECT * FROM VALUES
    ('ammonia',          'Amoniak',             'NH₃',    17.03, -33.34, 0.59,  25,  150, 750, 300),
    ('nitrogen_dioxide', 'Dwutlenek azotu',     'NO₂',    46.01,  21.15, 1.58,   1,   15,  30,  20),
    ('chlorine',         'Chlor',               'Cl₂',    70.90, -34.04, 2.49,   1,    3,  20,  10),
    ('nitric_acid',      'Kwas azotowy',        'HNO₃',   63.01,  83.00, 2.17,   1,    6,  78,  25)
  AS s(substance_id, name_pl, formula, molecular_weight, boiling_point_c,
       density_ratio, erpg1_ppm, erpg2_ppm, erpg3_ppm, idlh_ppm)
) s ON t.substance_id = s.substance_id
WHEN NOT MATCHED THEN INSERT VALUES (
  s.substance_id, s.name_pl, s.formula, s.molecular_weight, s.boiling_point_c,
  s.density_ratio, s.erpg1_ppm, s.erpg2_ppm, s.erpg3_ppm, s.idlh_ppm
);

-- 5.2 Scenariusze uwolnienia (4 × 4 = 16 kombinacji)
CREATE TABLE IF NOT EXISTS ref_release_scenarios (
  substance_id STRING NOT NULL,
  scenario_id STRING NOT NULL,
  name_pl STRING NOT NULL,
  rate_kg_s FLOAT NOT NULL,
  duration_s INT NOT NULL,
  PRIMARY KEY (substance_id, scenario_id)
);

MERGE INTO ref_release_scenarios t USING (
  SELECT * FROM VALUES
    -- Amoniak
    ('ammonia', 'small_leak',   'Mały wyciek',      0.5,  3600),
    ('ammonia', 'medium_leak',  'Średni wyciek',     5.0,  1800),
    ('ammonia', 'large_leak',   'Duży wyciek',      50.0,   600),
    ('ammonia', 'catastrophic', 'Katastroficzny',  500.0,   300),
    -- Dwutlenek azotu
    ('nitrogen_dioxide', 'small_leak',   'Mały wyciek',      0.1,  3600),
    ('nitrogen_dioxide', 'medium_leak',  'Średni wyciek',     1.0,  1800),
    ('nitrogen_dioxide', 'large_leak',   'Duży wyciek',      10.0,   600),
    ('nitrogen_dioxide', 'catastrophic', 'Katastroficzny',  100.0,   300),
    -- Chlor
    ('chlorine', 'small_leak',   'Mały wyciek',      0.2,  3600),
    ('chlorine', 'medium_leak',  'Średni wyciek',     2.0,  1800),
    ('chlorine', 'large_leak',   'Duży wyciek',      20.0,   600),
    ('chlorine', 'catastrophic', 'Katastroficzny',  200.0,   300),
    -- Kwas azotowy
    ('nitric_acid', 'small_leak',   'Mały wyciek',      0.1,  3600),
    ('nitric_acid', 'medium_leak',  'Średni wyciek',     1.0,  1800),
    ('nitric_acid', 'large_leak',   'Duży wyciek',      10.0,   600),
    ('nitric_acid', 'catastrophic', 'Katastroficzny',   50.0,   300)
  AS s(substance_id, scenario_id, name_pl, rate_kg_s, duration_s)
) s ON t.substance_id = s.substance_id AND t.scenario_id = s.scenario_id
WHEN NOT MATCHED THEN INSERT VALUES (
  s.substance_id, s.scenario_id, s.name_pl, s.rate_kg_s, s.duration_s
);

-- 5.3 Współczynniki dyspersji Pasquilla-Gifforda (Turner 1970)
CREATE TABLE IF NOT EXISTS ref_dispersion_coefficients (
  stability_class CHAR(1) PRIMARY KEY,
  name_pl STRING NOT NULL,
  description STRING,
  sigma_y_a FLOAT NOT NULL,
  sigma_y_b FLOAT NOT NULL,
  sigma_z_a FLOAT NOT NULL,
  sigma_z_b FLOAT NOT NULL
);

MERGE INTO ref_dispersion_coefficients t USING (
  SELECT * FROM VALUES
    ('A', 'Bardzo niestabilna', 'Silne nasłonecznienie, słaby wiatr', 0.3658, 0.9031, 0.192,  1.2604),
    ('B', 'Niestabilna',        'Umiarkowane nasłonecznienie',        0.2751, 0.9031, 0.156,  1.0857),
    ('C', 'Lekko niestabilna',  'Słabe nasłonecznienie',              0.2090, 0.9031, 0.116,  0.9615),
    ('D', 'Neutralna',          'Zachmurzenie / silniejszy wiatr',    0.1471, 0.9031, 0.079,  0.8183),
    ('E', 'Lekko stabilna',     'Noc, umiarkowany wiatr',             0.1046, 0.9031, 0.063,  0.6853),
    ('F', 'Stabilna',           'Noc, słaby wiatr, czyste niebo',     0.0722, 0.9031, 0.053,  0.5527)
  AS s(stability_class, name_pl, description, sigma_y_a, sigma_y_b, sigma_z_a, sigma_z_b)
) s ON t.stability_class = s.stability_class
WHEN NOT MATCHED THEN INSERT VALUES (
  s.stability_class, s.name_pl, s.description,
  s.sigma_y_a, s.sigma_y_b, s.sigma_z_a, s.sigma_z_b
);

-- 5.4 JavaScript UDF: Zasięg strefy (bisection search)
-- Zwraca odległość w metrach na osi chmury, gdzie stężenie spada do threshold_ppm
CREATE OR REPLACE FUNCTION udf_gaussian_zone_distance(
  Q_KG_S FLOAT, WIND_SPEED FLOAT, STABILITY STRING,
  THRESHOLD_PPM FLOAT, MOL_WEIGHT FLOAT, DENSITY_RATIO FLOAT
)
RETURNS FLOAT
LANGUAGE JAVASCRIPT
AS $$
  var COEFFS = {
    A: {sy_a:0.3658, sy_b:0.9031, sz_a:0.192,  sz_b:1.2604},
    B: {sy_a:0.2751, sy_b:0.9031, sz_a:0.156,  sz_b:1.0857},
    C: {sy_a:0.2090, sy_b:0.9031, sz_a:0.116,  sz_b:0.9615},
    D: {sy_a:0.1471, sy_b:0.9031, sz_a:0.079,  sz_b:0.8183},
    E: {sy_a:0.1046, sy_b:0.9031, sz_a:0.063,  sz_b:0.6853},
    F: {sy_a:0.0722, sy_b:0.9031, sz_a:0.053,  sz_b:0.5527}
  };
  var c = COEFFS[STABILITY];
  if (!c) return 0;
  if (WIND_SPEED < 0.5) WIND_SPEED = 0.5;

  // Próg stężenia w kg/m³
  var threshold_kg_m3 = THRESHOLD_PPM * MOL_WEIGHT / 24.45e6;

  // Korektor gęstości: lżejszy od powietrza → unosi się → mniejsze stężenie przy gruncie
  if (DENSITY_RATIO < 1) threshold_kg_m3 /= 0.7;
  else if (DENSITY_RATIO > 1.5) threshold_kg_m3 /= 1.3;

  // Bisection search na [1m, 100km]
  var xmin = 1, xmax = 100000;
  for (var i = 0; i < 60; i++) {
    var x = (xmin + xmax) / 2;
    var sy = c.sy_a * Math.pow(x, c.sy_b);
    var sz = c.sz_a * Math.pow(x, c.sz_b);
    var conc = Q_KG_S / (Math.PI * WIND_SPEED * sy * sz);
    if (conc > threshold_kg_m3) xmin = x; else xmax = x;
  }
  return Math.round((xmin + xmax) / 2);
$$;

-- 5.5 JavaScript UDF: Polygon strefy jako GeoJSON
-- Generuje sektor Gaussowski z szerokością zależną od σ_y
CREATE OR REPLACE FUNCTION udf_gaussian_zone_polygon(
  ORIGIN_LNG FLOAT, ORIGIN_LAT FLOAT,
  WIND_DIRECTION FLOAT, DOWNWIND_DISTANCE_M FLOAT,
  STABILITY STRING
)
RETURNS VARCHAR
LANGUAGE JAVASCRIPT
AS $$
  var COEFFS = {
    A: {sy_a:0.3658, sy_b:0.9031},
    B: {sy_a:0.2751, sy_b:0.9031},
    C: {sy_a:0.2090, sy_b:0.9031},
    D: {sy_a:0.1471, sy_b:0.9031},
    E: {sy_a:0.1046, sy_b:0.9031},
    F: {sy_a:0.0722, sy_b:0.9031}
  };
  var c = COEFFS[STABILITY];
  if (!c || DOWNWIND_DISTANCE_M <= 0) {
    return JSON.stringify({type:"Polygon",coordinates:[[[ORIGIN_LNG,ORIGIN_LAT]]]});
  }

  var cloudDir = (WIND_DIRECTION + 180) % 360;
  var toRad = Math.PI / 180;
  var earthR = 6371000;

  function destPoint(lng, lat, bearing, dist) {
    var lat1 = lat * toRad, lng1 = lng * toRad, brng = bearing * toRad;
    var d = dist / earthR;
    var lat2 = Math.asin(Math.sin(lat1)*Math.cos(d) + Math.cos(lat1)*Math.sin(d)*Math.cos(brng));
    var lng2 = lng1 + Math.atan2(Math.sin(brng)*Math.sin(d)*Math.cos(lat1), Math.cos(d)-Math.sin(lat1)*Math.sin(lat2));
    return [lng2 / toRad, lat2 / toRad];
  }

  var steps = 30;
  // Build right side (going downwind), then arc at tip, then left side (coming back)
  var rightSide = [];
  var leftSide = [];

  for (var i = 1; i <= steps; i++) {
    var x = (i / steps) * DOWNWIND_DISTANCE_M;
    var halfW = 2.0 * c.sy_a * Math.pow(Math.max(x, 10), c.sy_b);
    var axisPoint = destPoint(ORIGIN_LNG, ORIGIN_LAT, cloudDir, x);
    rightSide.push(destPoint(axisPoint[0], axisPoint[1], (cloudDir + 90) % 360, halfW));
    leftSide.unshift(destPoint(axisPoint[0], axisPoint[1], (cloudDir + 270) % 360, halfW));
  }

  // Assemble: origin → right side → left side (reversed) → close
  var coords = [[ORIGIN_LNG, ORIGIN_LAT]];
  coords = coords.concat(rightSide);
  coords = coords.concat(leftSide);
  coords.push([ORIGIN_LNG, ORIGIN_LAT]);

  return JSON.stringify({type:"Polygon", coordinates:[coords]});
$$;

-- 5.6 Widok: pełna analiza scenariusza toksycznego
-- Wywoływany z parametrami przez API: substance_id, scenario_id, wind_speed, wind_direction, stability
-- Użycie: SELECT * FROM TABLE(tf_toxic_scenario_analysis('ammonia','large_leak',3.0,270,'D',21.9667,51.4167))
-- Uwaga: Snowflake SQL UDTF nie wspiera parametryzowanego CTE z odwołaniem
-- do tabel w jednym RETURNS TABLE. Zamiast tego, API endpoint wykona
-- poniższe zapytanie z bind parametrami (:1, :2, ...).
-- Przykład użycia w Node.js API (parametry: substance, scenario, wind_speed, wind_dir, stability, lng, lat):

-- ZAPYTANIE 1: Oblicz zasięgi stref
-- SELECT
--   z.lvl, z.label, z.color, z.opacity,
--   udf_gaussian_zone_distance(r.rate_kg_s, :3, :5, z.threshold, s.molecular_weight, s.density_ratio) AS distance_m,
--   udf_gaussian_zone_polygon(:6, :7, :4, distance_m, :5) AS zone_geojson
-- FROM (
--   SELECT 'erpg3' AS lvl, ... UNION ALL ...
-- ) z
-- CROSS JOIN ref_toxic_substances s
-- CROSS JOIN ref_release_scenarios r
-- WHERE s.substance_id = :1 AND r.substance_id = :1 AND r.scenario_id = :2

-- ZAPYTANIE 2: Znajdź POI w strefie (per strefa)
-- SELECT p.name, p.amenity_type, p.estimated_population,
--   ROUND(ST_DISTANCE(p.geo, ST_MAKEPOINT(:6, :7))) AS poi_distance_m,
--   b.name AS gmina
-- FROM raw_osm_pois p
-- LEFT JOIN raw_admin_boundaries b ON ST_WITHIN(p.geo, b.geo) AND b.level = 'gmina'
-- WHERE ST_WITHIN(p.geo, TO_GEOGRAPHY(:zone_geojson))
