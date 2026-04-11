"""
Load POIs NDJSON into Snowflake raw_osm_pois using PUT + COPY INTO.
Computes geo, h3_res7, h3_res9 during load.
Authentication: RSA key pair (~/.snowflake/keys/rsa_key.p8)

Usage: python3 load-pois-snowflake.py
Requires: NDJSON file at snowflake/seed/pois-lubelskie.ndjson
"""
import sys
from pathlib import Path

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
import snowflake.connector

SEED_DIR = Path(__file__).parent
NDJSON_FILE = SEED_DIR / "pois-lubelskie.ndjson"
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
    if not NDJSON_FILE.exists():
        print(f"NDJSON file not found: {NDJSON_FILE}", file=sys.stderr)
        sys.exit(1)

    print(f"Connecting to Snowflake ({CONN_PARAMS['account']}) via key pair auth...", file=sys.stderr)
    conn = snowflake.connector.connect(**CONN_PARAMS)
    cur = conn.cursor()

    try:
        # Ensure ndjson format exists
        cur.execute("""
            CREATE OR REPLACE FILE FORMAT ndjson_format
            TYPE = 'JSON'
            STRIP_OUTER_ARRAY = FALSE
        """)

        # Truncate existing data
        cur.execute("TRUNCATE TABLE IF EXISTS raw_osm_pois")
        print("Truncated raw_osm_pois", file=sys.stderr)

        # PUT file to stage
        put_sql = f"PUT file://{NDJSON_FILE} @stg_geojson AUTO_COMPRESS=TRUE OVERWRITE=TRUE"
        print(f"PUT {NDJSON_FILE.name}...", file=sys.stderr)
        cur.execute(put_sql)
        for row in cur:
            print(f"  PUT result: {row}", file=sys.stderr)

        # COPY INTO with geo + H3 computation
        copy_sql = """
            COPY INTO raw_osm_pois (
                osm_id, name, amenity_type, latitude, longitude,
                tags, estimated_population, city,
                geo, h3_res7, h3_res9
            )
            FROM (
                SELECT
                    $1:osm_id::BIGINT,
                    $1:name::STRING,
                    $1:amenity_type::STRING,
                    $1:latitude::FLOAT,
                    $1:longitude::FLOAT,
                    $1:tags::VARIANT,
                    $1:estimated_population::INT,
                    $1:city::STRING,
                    ST_MAKEPOINT($1:longitude::FLOAT, $1:latitude::FLOAT),
                    H3_LATLNG_TO_CELL($1:latitude::FLOAT, $1:longitude::FLOAT, 7)::STRING,
                    H3_LATLNG_TO_CELL($1:latitude::FLOAT, $1:longitude::FLOAT, 9)::STRING
                FROM @stg_geojson/pois-lubelskie.ndjson.gz
                    (FILE_FORMAT => 'ndjson_format')
            )
        """
        print("COPY INTO raw_osm_pois...", file=sys.stderr)
        cur.execute(copy_sql)
        for row in cur:
            print(f"  COPY result: {row}", file=sys.stderr)

        # Verify
        cur.execute("""
            SELECT amenity_type, COUNT(*) as cnt
            FROM raw_osm_pois
            GROUP BY amenity_type
            ORDER BY cnt DESC
        """)
        print("\nLoaded data:", file=sys.stderr)
        total = 0
        for row in cur:
            print(f"  {row[0]}: {row[1]} rows", file=sys.stderr)
            total += row[1]
        print(f"\nTotal: {total} rows in raw_osm_pois", file=sys.stderr)

    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
