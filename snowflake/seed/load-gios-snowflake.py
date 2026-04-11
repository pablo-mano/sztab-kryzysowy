"""
Load GIOŚ stations and measurements NDJSON into Snowflake using PUT + COPY INTO.
Computes geo, h3_res7 for stations during load.
Authentication: RSA key pair (~/.snowflake/keys/rsa_key.p8)

Usage: python3 load-gios-snowflake.py
Requires:
  - gios-stations-lubelskie.ndjson
  - gios-measurements-lubelskie.ndjson
"""
import sys
from pathlib import Path

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
import snowflake.connector

SEED_DIR = Path(__file__).parent
STATIONS_FILE = SEED_DIR / "gios-stations-lubelskie.ndjson"
MEASUREMENTS_FILE = SEED_DIR / "gios-measurements-lubelskie.ndjson"
PRIVATE_KEY_PATH = Path.home() / ".snowflake" / "keys" / "rsa_key.p8"


def load_private_key():
    with open(PRIVATE_KEY_PATH, "rb") as f:
        p_key = serialization.load_pem_private_key(
            f.read(), password=None, backend=default_backend()
        )
    return p_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )


CONN_PARAMS = {
    "account": "KWGWPRT-OT51051",
    "user": "PABLOMANO",
    "private_key": load_private_key(),
    "database": "SZTAB_DB",
    "schema": "PUBLIC",
    "warehouse": "SZTAB_WH",
    "role": "ACCOUNTADMIN",
}


def main():
    for f in [STATIONS_FILE, MEASUREMENTS_FILE]:
        if not f.exists():
            print(f"Missing file: {f}", file=sys.stderr)
            sys.exit(1)

    print(f"Connecting to Snowflake ({CONN_PARAMS['account']})...", file=sys.stderr)
    conn = snowflake.connector.connect(**CONN_PARAMS)
    cur = conn.cursor()

    try:
        # Ensure ndjson format exists
        cur.execute("""
            CREATE OR REPLACE FILE FORMAT ndjson_format
            TYPE = 'JSON' STRIP_OUTER_ARRAY = FALSE
        """)

        # --- STATIONS ---
        cur.execute("TRUNCATE TABLE IF EXISTS raw_gios_stations")
        print("Truncated raw_gios_stations", file=sys.stderr)

        put_sql = f"PUT file://{STATIONS_FILE} @stg_geojson AUTO_COMPRESS=TRUE OVERWRITE=TRUE"
        print(f"PUT {STATIONS_FILE.name}...", file=sys.stderr)
        cur.execute(put_sql)
        for row in cur:
            print(f"  PUT: {row}", file=sys.stderr)

        copy_stations = """
            COPY INTO raw_gios_stations (
                station_id, station_name, latitude, longitude,
                city, commune, province,
                geo, h3_res7
            )
            FROM (
                SELECT
                    $1:station_id::INT,
                    $1:station_name::STRING,
                    $1:latitude::FLOAT,
                    $1:longitude::FLOAT,
                    $1:city::STRING,
                    $1:commune::STRING,
                    $1:province::STRING,
                    ST_MAKEPOINT($1:longitude::FLOAT, $1:latitude::FLOAT),
                    H3_LATLNG_TO_CELL($1:latitude::FLOAT, $1:longitude::FLOAT, 7)::STRING
                FROM @stg_geojson/gios-stations-lubelskie.ndjson.gz
                    (FILE_FORMAT => 'ndjson_format')
            )
        """
        print("COPY INTO raw_gios_stations...", file=sys.stderr)
        cur.execute(copy_stations)
        for row in cur:
            print(f"  COPY: {row}", file=sys.stderr)

        cur.execute("SELECT COUNT(*) FROM raw_gios_stations")
        print(f"  Stations loaded: {cur.fetchone()[0]}", file=sys.stderr)

        # --- MEASUREMENTS ---
        cur.execute("TRUNCATE TABLE IF EXISTS raw_gios_measurements")
        print("\nTruncated raw_gios_measurements", file=sys.stderr)

        put_sql = f"PUT file://{MEASUREMENTS_FILE} @stg_geojson AUTO_COMPRESS=TRUE OVERWRITE=TRUE"
        print(f"PUT {MEASUREMENTS_FILE.name}...", file=sys.stderr)
        cur.execute(put_sql)
        for row in cur:
            print(f"  PUT: {row}", file=sys.stderr)

        copy_measurements = """
            COPY INTO raw_gios_measurements (
                station_id, sensor_id, param_code, value, measure_date
            )
            FROM (
                SELECT
                    $1:station_id::INT,
                    $1:sensor_id::INT,
                    $1:param_code::STRING,
                    $1:value::FLOAT,
                    $1:measure_date::TIMESTAMP
                FROM @stg_geojson/gios-measurements-lubelskie.ndjson.gz
                    (FILE_FORMAT => 'ndjson_format')
            )
        """
        print("COPY INTO raw_gios_measurements...", file=sys.stderr)
        cur.execute(copy_measurements)
        for row in cur:
            print(f"  COPY: {row}", file=sys.stderr)

        # Verify
        cur.execute("""
            SELECT param_code, COUNT(*) as cnt
            FROM raw_gios_measurements
            GROUP BY param_code
            ORDER BY cnt DESC
        """)
        print("\nMeasurements by param:", file=sys.stderr)
        total = 0
        for row in cur:
            print(f"  {row[0]}: {row[1]}", file=sys.stderr)
            total += row[1]
        print(f"\nTotal: {total} measurements", file=sys.stderr)

    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
