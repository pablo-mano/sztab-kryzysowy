"""
Fetch vulnerable POIs (hospitals, schools, kindergartens, nursing homes, clinics,
social facilities) from OSM Overpass API for woj. lubelskie.

Outputs NDJSON file ready for Snowflake PUT + COPY INTO.

Usage: python3 fetch-pois-osm.py
Output: snowflake/seed/pois-lubelskie.ndjson
"""
import json
import sys
import time
from pathlib import Path

import requests

SEED_DIR = Path(__file__).parent
OUTPUT_FILE = SEED_DIR / "pois-lubelskie.ndjson"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# woj. lubelskie relation id = 130919
# amenity types relevant for crisis management
AMENITY_TYPES = [
    "hospital",
    "school",
    "kindergarten",
    "nursing_home",      # DPS
    "clinic",
    "social_facility",
]

# Population estimates for risk scoring
POP_ESTIMATES = {
    "hospital": 500,
    "school": 300,
    "kindergarten": 80,
    "nursing_home": 100,
    "clinic": 50,
    "social_facility": 60,
}

def make_query(amenity):
    return f"""
[out:json][timeout:90];
area["name"="województwo lubelskie"]["admin_level"="4"]->.searchArea;
(
  node["amenity"="{amenity}"](area.searchArea);
  way["amenity"="{amenity}"](area.searchArea);
  relation["amenity"="{amenity}"](area.searchArea);
);
out center tags;
"""


def fetch_overpass_single(amenity):
    """Fetch one amenity type from Overpass API with retry."""
    query = make_query(amenity)
    for attempt in range(3):
        print(f"  [{amenity}] attempt {attempt + 1}/3...", file=sys.stderr)
        try:
            resp = requests.post(OVERPASS_URL, data={"data": query}, timeout=120)
        except requests.exceptions.Timeout:
            print(f"  [{amenity}] timeout, retrying...", file=sys.stderr)
            time.sleep(15)
            continue
        if resp.status_code == 200:
            data = resp.json()
            elements = data.get("elements", [])
            print(f"  [{amenity}] got {len(elements)} elements", file=sys.stderr)
            return elements
        elif resp.status_code == 429:
            wait = 30 * (attempt + 1)
            print(f"  [{amenity}] rate limited, waiting {wait}s...", file=sys.stderr)
            time.sleep(wait)
        else:
            print(f"  [{amenity}] HTTP {resp.status_code}, retrying...", file=sys.stderr)
            time.sleep(15)
    print(f"  [{amenity}] FAILED after 3 attempts, skipping", file=sys.stderr)
    return []


def fetch_all():
    """Fetch all amenity types one by one."""
    all_elements = []
    for i, amenity in enumerate(AMENITY_TYPES):
        if i > 0:
            time.sleep(5)  # pause between requests
        print(f"Fetching {amenity}...", file=sys.stderr)
        elements = fetch_overpass_single(amenity)
        all_elements.extend(elements)
    return all_elements


def extract_poi(element):
    """Convert OSM element to POI record for Snowflake."""
    tags = element.get("tags", {})
    amenity = tags.get("amenity")
    if amenity not in AMENITY_TYPES:
        return None

    # Get coordinates: node has lat/lon directly, way/relation use center
    if element["type"] == "node":
        lat = element.get("lat")
        lon = element.get("lon")
    else:
        center = element.get("center", {})
        lat = center.get("lat")
        lon = center.get("lon")

    if lat is None or lon is None:
        return None

    osm_id = element["id"]
    name = tags.get("name", tags.get("name:pl"))

    # Determine city from addr:city or addr:place
    city = tags.get("addr:city", tags.get("addr:place"))

    return {
        "osm_id": osm_id,
        "name": name,
        "amenity_type": amenity,
        "latitude": round(lat, 7),
        "longitude": round(lon, 7),
        "tags": tags,
        "estimated_population": POP_ESTIMATES.get(amenity, 50),
        "city": city,
    }


def main():
    elements = fetch_all()

    pois = []
    for el in elements:
        poi = extract_poi(el)
        if poi:
            pois.append(poi)

    print(f"Extracted {len(pois)} POIs:", file=sys.stderr)
    for amenity in AMENITY_TYPES:
        count = sum(1 for p in pois if p["amenity_type"] == amenity)
        if count:
            print(f"  {amenity}: {count}", file=sys.stderr)

    # Write NDJSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for poi in pois:
            f.write(json.dumps(poi, ensure_ascii=False) + "\n")

    print(f"\nWrote {len(pois)} records to {OUTPUT_FILE}", file=sys.stderr)
    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    print(f"File size: {file_size_mb:.2f} MB", file=sys.stderr)


if __name__ == "__main__":
    main()
