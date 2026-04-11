"""
Pobiera granice administracyjne woj. lubelskiego z oficjalnego WFS PRG (GUGiK).
Konwertuje z GML EPSG:2180 → GeoJSON EPSG:4326.
Generuje NDJSON gotowy do załadowania do Snowflake.

Warstwy:
  A01_Granice_wojewodztw  → level='wojewodztwo'
  A02_Granice_powiatow    → level='powiat'
  A03_Granice_gmin        → level='gmina'
"""

import json
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path
from pyproj import Transformer

WFS_BASE = (
    "https://mapy.geoportal.gov.pl/wss/service/PZGIK/PRG/WFS/AdministrativeBoundaries"
)

LAYERS = [
    ("A01_Granice_wojewodztw", "wojewodztwo"),
    ("A02_Granice_powiatow", "powiat"),
    ("A03_Granice_gmin", "gmina"),
]

TERYT_PREFIX = "06"  # woj. lubelskie

NS = {
    "wfs": "http://www.opengis.net/wfs",
    "gml": "http://www.opengis.net/gml",
    "ms": "http://mapserver.gis.umn.edu/mapserver",
}

transformer = Transformer.from_crs("EPSG:2180", "EPSG:4326", always_xy=True)

OUTPUT_DIR = Path(__file__).parent


def fetch_wfs_gml(type_name: str, max_features: int = 3000) -> str:
    """Fetch GML from WFS PRG. Downloads all features then filters client-side."""
    url = (
        f"{WFS_BASE}?service=WFS&version=1.1.0&request=GetFeature"
        f"&typeName={type_name}"
        f"&maxFeatures={max_features}"
        f"&outputFormat=text/xml;%20subtype=gml/3.1.1"
    )
    print(f"  Fetching {type_name} (max {max_features})...", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": "SztabKryzysowy/1.0"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = resp.read()
        print(f"  Downloaded {len(data)} bytes", file=sys.stderr)
        return data.decode("utf-8")


def parse_coords(pos_text: str) -> list[tuple[float, float]]:
    """Parse GML posList (space-separated pairs) to list of (lon, lat) in WGS84.
    GML EPSG:2180 posList has order: northing(Y), easting(X) per pair."""
    values = pos_text.strip().split()
    coords = []
    for i in range(0, len(values) - 1, 2):
        # GML order: Y (northing), X (easting) — swap for pyproj always_xy
        y, x = float(values[i]), float(values[i + 1])
        lon, lat = transformer.transform(x, y)
        coords.append((round(lon, 6), round(lat, 6)))
    return coords


def extract_polygon_coords(geom_elem) -> list[list[list[tuple[float, float]]]]:
    """Extract polygon coordinates from GML geometry element."""
    polygons = []

    # Handle MultiSurface / MultiPolygon
    multi_surfaces = geom_elem.findall(".//gml:MultiSurface", NS)
    if multi_surfaces:
        for ms_elem in multi_surfaces:
            for surf_member in ms_elem.findall(".//gml:surfaceMember", NS):
                poly = surf_member.find(".//gml:Polygon", NS)
                if poly is not None:
                    rings = extract_rings(poly)
                    if rings:
                        polygons.append(rings)
        return polygons

    # Handle simple Polygon
    for poly in geom_elem.findall(".//gml:Polygon", NS):
        rings = extract_rings(poly)
        if rings:
            polygons.append(rings)

    return polygons


def extract_rings(poly_elem) -> list[list[tuple[float, float]]]:
    """Extract exterior and interior rings from a GML Polygon."""
    rings = []
    exterior = poly_elem.find(".//gml:exterior/gml:LinearRing", NS)
    if exterior is None:
        exterior = poly_elem.find(".//gml:outerBoundaryIs/gml:LinearRing", NS)
    if exterior is not None:
        pos_list = exterior.find("gml:posList", NS)
        if pos_list is not None and pos_list.text:
            rings.append(parse_coords(pos_list.text))
        else:
            # Try individual gml:pos or gml:coordinates
            coords_elem = exterior.find("gml:coordinates", NS)
            if coords_elem is not None and coords_elem.text:
                rings.append(parse_coords_legacy(coords_elem.text))

    for interior in poly_elem.findall(".//gml:interior/gml:LinearRing", NS):
        pos_list = interior.find("gml:posList", NS)
        if pos_list is not None and pos_list.text:
            rings.append(parse_coords(pos_list.text))

    return rings


def parse_coords_legacy(coords_text: str) -> list[tuple[float, float]]:
    """Parse legacy gml:coordinates format (y,x y,x ...) — note GML axis order."""
    coords = []
    for pair in coords_text.strip().split():
        parts = pair.split(",")
        if len(parts) >= 2:
            y, x = float(parts[0]), float(parts[1])
            lon, lat = transformer.transform(x, y)
            coords.append((round(lon, 6), round(lat, 6)))
    return coords


def gml_to_features(gml_text: str, level: str) -> list[dict]:
    """Parse GML response and extract features with TERYT prefix filter."""
    root = ET.fromstring(gml_text)
    features = []

    for member in root.findall(".//gml:featureMember", NS):
        for child in member:
            teryt = ""
            name = ""
            area_ha = 0

            teryt_elem = child.find("ms:JPT_KOD_JE", NS)
            if teryt_elem is not None and teryt_elem.text:
                teryt = teryt_elem.text.strip()

            # Filter: only woj. lubelskie
            if not teryt.startswith(TERYT_PREFIX):
                continue

            name_elem = child.find("ms:JPT_NAZWA_", NS)
            if name_elem is not None and name_elem.text:
                name = name_elem.text.strip()

            area_elem = child.find("ms:JPT_POWIER", NS)
            if area_elem is not None and area_elem.text:
                try:
                    area_ha = float(area_elem.text.strip())
                except ValueError:
                    area_ha = 0

            # Extract geometry
            geom_elem = child.find("ms:msGeometry", NS)
            if geom_elem is None:
                continue

            polygons = extract_polygon_coords(geom_elem)
            if not polygons:
                continue

            if len(polygons) == 1:
                geojson_geom = {
                    "type": "Polygon",
                    "coordinates": polygons[0],
                }
            else:
                geojson_geom = {
                    "type": "MultiPolygon",
                    "coordinates": polygons,
                }

            area_km2 = round(area_ha / 100, 2) if area_ha else None

            features.append({
                "teryt": teryt,
                "name": name,
                "level": level,
                "geometry": geojson_geom,
                "population": None,  # PRG does not include population
                "area_km2": area_km2,
            })

    return features


def main():
    all_features = []

    for type_name, level in LAYERS:
        gml_text = fetch_wfs_gml(type_name)
        features = gml_to_features(gml_text, level)
        print(f"  {type_name}: {len(features)} features for TERYT prefix '{TERYT_PREFIX}'", file=sys.stderr)
        all_features.extend(features)

    # Write NDJSON (one JSON object per line)
    output_path = OUTPUT_DIR / "boundaries-lubelskie.ndjson"
    with open(output_path, "w", encoding="utf-8") as f:
        for feat in all_features:
            f.write(json.dumps(feat, ensure_ascii=False) + "\n")

    print(f"\nTotal: {len(all_features)} features written to {output_path}", file=sys.stderr)

    # Also write GeoJSON FeatureCollection for debugging / frontend fallback
    geojson_fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {k: v for k, v in feat.items() if k != "geometry"},
                "geometry": feat["geometry"],
            }
            for feat in all_features
        ],
    }
    geojson_path = OUTPUT_DIR / "boundaries-lubelskie.geojson"
    with open(geojson_path, "w", encoding="utf-8") as f:
        json.dump(geojson_fc, f, ensure_ascii=False)

    print(f"GeoJSON fallback: {geojson_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
