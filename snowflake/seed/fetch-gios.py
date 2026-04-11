"""
Fetch air quality data from GIOŚ (Główny Inspektorat Ochrony Środowiska) API v1
for woj. lubelskie stations.

API v1 docs: https://powietrze.gios.gov.pl/pjp/content/api
- /pjp-api/v1/rest/station/findAll         → all stations (JSON-LD)
- /pjp-api/v1/rest/station/sensors/{id}    → sensors for station
- /pjp-api/v1/rest/data/getData/{sensorId} → measurements for sensor

Response format: JSON-LD with Polish field names.

Outputs two NDJSON files:
  - gios-stations-lubelskie.ndjson
  - gios-measurements-lubelskie.ndjson

Usage: python3 fetch-gios.py
"""
import json
import sys
import time
from pathlib import Path

import requests

SEED_DIR = Path(__file__).parent
STATIONS_FILE = SEED_DIR / "gios-stations-lubelskie.ndjson"
MEASUREMENTS_FILE = SEED_DIR / "gios-measurements-lubelskie.ndjson"

GIOS_BASE = "https://api.gios.gov.pl/pjp-api/v1/rest"

PROVINCE_FILTER = "LUBELSKIE"

# Params relevant for crisis management
RELEVANT_PARAMS = {"PM10", "PM2.5", "SO2", "NO2", "CO", "O3", "C6H6"}


def api_get(path, retries=3):
    """GET request to GIOŚ API with retry."""
    url = f"{GIOS_BASE}{path}"
    for attempt in range(retries):
        try:
            resp = requests.get(url, timeout=30)
            if resp.status_code == 200:
                return resp.json()
            print(f"  HTTP {resp.status_code} for {path}", file=sys.stderr)
        except requests.exceptions.RequestException as e:
            print(f"  Error for {path}: {e}", file=sys.stderr)
        time.sleep(2 * (attempt + 1))
    return None


def fetch_stations():
    """Fetch all stations (paginated) and filter to Lubelskie province."""
    print("Fetching all GIOŚ stations...", file=sys.stderr)
    all_stations = []
    page = 0
    page_size = 100
    while True:
        data = api_get(f"/station/findAll?page={page}&size={page_size}")
        if not data:
            break
        batch = data.get("Lista stacji pomiarowych", [])
        if not batch:
            break
        all_stations.extend(batch)
        total_pages = data.get("totalPages", 1)
        print(f"  Page {page+1}/{total_pages}: {len(batch)} stations", file=sys.stderr)
        page += 1
        if page >= total_pages:
            break
        time.sleep(0.5)

    if not all_stations:
        print("Failed to fetch stations", file=sys.stderr)
        sys.exit(1)

    print(f"  Total stations in Poland: {len(all_stations)}", file=sys.stderr)

    lubelskie = []
    for s in all_stations:
        province = s.get("Województwo", "")
        if province.upper() != PROVINCE_FILTER:
            continue
        lubelskie.append({
            "station_id": s["Identyfikator stacji"],
            "station_name": s.get("Nazwa stacji"),
            "latitude": float(s["WGS84 φ N"]),
            "longitude": float(s["WGS84 λ E"]),
            "city": s.get("Nazwa miasta"),
            "commune": s.get("Gmina"),
            "province": province,
        })

    print(f"  Lubelskie stations: {len(lubelskie)}", file=sys.stderr)
    for st in lubelskie:
        print(f"    {st['station_name']} ({st['city']})", file=sys.stderr)
    return lubelskie


def fetch_measurements(stations):
    """Fetch sensors and latest measurements for each station."""
    all_measurements = []

    for i, station in enumerate(stations):
        sid = station["station_id"]
        sname = station["station_name"]
        print(f"  [{i+1}/{len(stations)}] {sname} (id={sid})...", file=sys.stderr)

        # Get sensors for this station
        data = api_get(f"/station/sensors/{sid}")
        if not data:
            print(f"    No sensors data", file=sys.stderr)
            continue

        sensors = data.get("Lista stanowisk pomiarowych dla podanej stacji", [])

        for sensor in sensors:
            sensor_id = sensor["Identyfikator stanowiska"]
            param_code = sensor.get("Wskaźnik - kod", "")

            if param_code not in RELEVANT_PARAMS:
                continue

            # Get measurement data
            mdata = api_get(f"/data/getData/{sensor_id}")
            if not mdata:
                continue

            values = mdata.get("Lista danych pomiarowych", [])

            for val in values:
                if val.get("Wartość") is not None:
                    all_measurements.append({
                        "station_id": sid,
                        "sensor_id": sensor_id,
                        "param_code": param_code,
                        "value": val["Wartość"],
                        "measure_date": val["Data"],
                    })

        time.sleep(0.5)  # rate limit politeness

    print(f"  Total measurements: {len(all_measurements)}", file=sys.stderr)
    return all_measurements


def main():
    stations = fetch_stations()
    if not stations:
        print("No stations found for Lubelskie", file=sys.stderr)
        sys.exit(1)

    # Write stations NDJSON
    with open(STATIONS_FILE, "w", encoding="utf-8") as f:
        for s in stations:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")
    print(f"Wrote {len(stations)} stations to {STATIONS_FILE.name}", file=sys.stderr)

    # Fetch measurements
    print("\nFetching measurements...", file=sys.stderr)
    measurements = fetch_measurements(stations)

    # Write measurements NDJSON
    with open(MEASUREMENTS_FILE, "w", encoding="utf-8") as f:
        for m in measurements:
            f.write(json.dumps(m, ensure_ascii=False) + "\n")
    print(f"Wrote {len(measurements)} measurements to {MEASUREMENTS_FILE.name}", file=sys.stderr)

    # Summary
    print(f"\nSummary:", file=sys.stderr)
    print(f"  Stations: {len(stations)}", file=sys.stderr)
    print(f"  Measurements: {len(measurements)}", file=sys.stderr)
    params = set(m["param_code"] for m in measurements)
    print(f"  Param codes: {sorted(params)}", file=sys.stderr)


if __name__ == "__main__":
    main()
