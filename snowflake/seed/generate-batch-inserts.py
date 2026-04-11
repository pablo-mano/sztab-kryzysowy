"""
Load boundaries NDJSON into Snowflake tmp_boundaries_json table via SQL INSERT batches.
Outputs SQL statements to stdout, one per batch.
"""
import json
import sys
from pathlib import Path

SEED_DIR = Path(__file__).parent
INPUT = SEED_DIR / "boundaries-lubelskie.ndjson"

# Max ~3MB per batch to stay safe with SQL statement limits
MAX_BATCH_BYTES = 3_000_000

def escape_sql(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "''")

def main():
    batches = []
    current_batch = []
    current_size = 0

    with open(INPUT, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row_size = len(line)
            if current_size + row_size > MAX_BATCH_BYTES and current_batch:
                batches.append(current_batch)
                current_batch = []
                current_size = 0
            current_batch.append(line)
            current_size += row_size

    if current_batch:
        batches.append(current_batch)

    print(f"Total batches: {len(batches)}", file=sys.stderr)
    for i, batch in enumerate(batches):
        print(f"  Batch {i+1}: {len(batch)} rows, ~{sum(len(r) for r in batch)/1024:.0f} KB", file=sys.stderr)

    # Output SQL for each batch
    for i, batch in enumerate(batches):
        values = []
        for row_json in batch:
            escaped = escape_sql(row_json)
            values.append(f"SELECT PARSE_JSON('{escaped}')")
        sql = f"INSERT INTO SZTAB_DB.PUBLIC.tmp_boundaries_json (raw)\n" + "\nUNION ALL\n".join(values) + ";"
        # Write to separate file per batch
        output_path = SEED_DIR / f"batch-boundaries-{i+1}.sql"
        with open(output_path, "w", encoding="utf-8") as out:
            out.write(sql)
        print(f"Written {output_path}", file=sys.stderr)

if __name__ == "__main__":
    main()
