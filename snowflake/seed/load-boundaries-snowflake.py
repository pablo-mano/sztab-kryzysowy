"""
Load boundaries NDJSON into Snowflake using snowflake-connector-python.
Uses PUT + COPY INTO for reliable bulk loading.
Authentication: RSA key pair (~/.snowflake/keys/rsa_key.p8)

Usage: python3 load-boundaries-snowflake.py
Requires: NDJSON file at snowflake/seed/boundaries-lubelskie.ndjson
"""
import os
import sys
from pathlib import Path

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
import snowflake.connector

SEED_DIR = Path(__file__).parent
NDJSON_FILE = SEED_DIR / "boundaries-lubelskie.ndjson"
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
    print(f"Connecting to Snowflake ({CONN_PARAMS['account']}) via key pair auth...", file=sys.stderr)
    conn = snowflake.connector.connect(**CONN_PARAMS)
    cur = conn.cursor()

    try:
        # Create ndjson file format
        cur.execute("""
            CREATE OR REPLACE FILE FORMAT ndjson_format
            TYPE = 'JSON'
            STRIP_OUTER_ARRAY = FALSE
        """)
        print("Created ndjson_format", file=sys.stderr)

        # PUT file to stage
        put_sql = f"PUT file://{NDJSON_FILE} @stg_geojson AUTO_COMPRESS=TRUE OVERWRITE=TRUE"
        print(f"PUT {NDJSON_FILE}...", file=sys.stderr)
        cur.execute(put_sql)
        for row in cur:
            print(f"  PUT result: {row}", file=sys.stderr)

        # List stage to verify
        cur.execute("LIST @stg_geojson")
        for row in cur:
            print(f"  Stage: {row}", file=sys.stderr)

        # COPY INTO raw_admin_boundaries
        copy_sql = """
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
            )
        """
        print("COPY INTO raw_admin_boundaries...", file=sys.stderr)
        cur.execute(copy_sql)
        for row in cur:
            print(f"  COPY result: {row}", file=sys.stderr)

        # Verify
        cur.execute("SELECT level, COUNT(*) as cnt FROM raw_admin_boundaries GROUP BY level ORDER BY level")
        print("\nLoaded data:", file=sys.stderr)
        for row in cur:
            print(f"  {row[0]}: {row[1]} rows", file=sys.stderr)

        cur.execute("SELECT COUNT(*) FROM raw_admin_boundaries")
        total = cur.fetchone()[0]
        print(f"\nTotal: {total} rows", file=sys.stderr)

    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
