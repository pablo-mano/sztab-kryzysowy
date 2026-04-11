"""
Generuje SQL INSERT'y z NDJSON do załadowania granic admin do Snowflake.
Grupuje po ~5 wierszy (ze względu na rozmiar geometrii).
Output: load-boundaries-inserts.sql
"""
import json
from pathlib import Path

SEED_DIR = Path(__file__).parent
INPUT = SEED_DIR / "boundaries-lubelskie.ndjson"
OUTPUT = SEED_DIR / "load-boundaries-inserts.sql"

BATCH_SIZE = 5  # rows per INSERT (geometry is large)

def escape_sql(s: str) -> str:
    """Escape single quotes for SQL string literal."""
    if s is None:
        return "NULL"
    return "'" + s.replace("'", "''") + "'"

def main():
    rows = []
    with open(INPUT, encoding="utf-8") as f:
        for line in f:
            d = json.loads(line)
            geom_json = json.dumps(d["geometry"], ensure_ascii=False)
            rows.append({
                "teryt": d["teryt"],
                "name": d["name"],
                "level": d["level"],
                "geom_json": geom_json,
                "population": d.get("population"),
                "area_km2": d.get("area_km2"),
            })

    with open(OUTPUT, "w", encoding="utf-8") as out:
        out.write("USE DATABASE SZTAB_DB;\nUSE SCHEMA PUBLIC;\nUSE WAREHOUSE SZTAB_WH;\n\n")

        for i, row in enumerate(rows):
            pop = "NULL" if row["population"] is None else str(row["population"])
            area = "NULL" if row["area_km2"] is None else str(row["area_km2"])
            sql = (
                f"INSERT INTO raw_admin_boundaries (teryt, name, level, geo, population, area_km2) "
                f"SELECT {escape_sql(row['teryt'])}, {escape_sql(row['name'])}, "
                f"{escape_sql(row['level'])}, "
                f"TO_GEOGRAPHY({escape_sql(row['geom_json'])}), "
                f"{pop}, {area};\n"
            )
            out.write(sql)

    print(f"Generated {len(rows)} INSERT statements -> {OUTPUT}")

if __name__ == "__main__":
    main()
