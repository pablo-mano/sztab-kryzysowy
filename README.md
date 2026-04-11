# Sztab Kryzysowy

Geospatial Decision Support Platform for crisis management in the Lubelskie Voivodeship, Poland.

Built for the **civil42.pl hackathon** — special task of the Marshal of the Lubelskie Voivodeship.

**Live demo:** [sztab-kryzysowy.vercel.app](https://sztab-kryzysowy.vercel.app)

---

## Overview

Interactive map dashboard for visualizing geospatial data layers, running crisis scenarios, and supporting decision-making during emergencies. The platform is designed as a universal geospatial tool — crisis simulation is one of multiple use cases.

### Key Features

- **Multi-layer map** with POI infrastructure (hospitals, schools, kindergartens, care homes), air quality stations (GIOS), civil reports, and administrative boundaries
- **H3 hexagonal analytics** — density heatmaps, air quality interpolation, risk scoring with zoom-dependent resolution
- **Crisis scenarios** — toxic cloud simulation (Pulawy chemical plant) with wind/time parameters, real-time population impact analysis per threat zone via Snowflake spatial intersection
- **Spatial filtering** — click admin boundaries to filter data within a region
- **Live data refresh** — civil reports update every 10 seconds
- **Dual map modes** — toggle between point-based and H3 analytical views

### Architecture

```
Data Sources (GIOS API, OSM, civil reports)
        |
   Snowflake (OLAP)
   - Raw tables + serving views
   - H3 spatial indexing
   - ST_WITHIN / ST_DISTANCE queries
        |
   Next.js API Routes (cache layer)
   - /api/layers/[id] — layer data
   - /api/scenario — crisis impact analysis
   - /api/aggregate — ad-hoc queries
        |
   React Frontend
   - MapLibre GL (vector tiles, dark theme)
   - Turf.js (cloud simulation geometry)
   - SWR (data fetching + refresh)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui |
| Map | MapLibre GL JS via @vis.gl/react-maplibre |
| Geo | @turf/turf (client-side), Snowflake GEOGRAPHY (server-side) |
| Data | Snowflake (key-pair JWT auth), H3 spatial indexing |
| Deploy | Vercel |

## Project Structure

```
sztab-kryzysowy/
├── frontend/          # Next.js application
│   ├── src/
│   │   ├── app/       # Pages + API routes
│   │   ├── components/# UI components (map, dashboard, scenario)
│   │   ├── hooks/     # Data fetching, scenario state
│   │   ├── lib/       # Utilities, Snowflake client, scenarios
│   │   └── types/     # TypeScript interfaces
│   └── layer-registry.json  # Layer configuration (declarative)
├── snowflake/
│   ├── sql/           # DDL: tables, views, H3 grid
│   └── seed/          # Data loading scripts (GIOS, OSM POIs)
├── PLAN.md            # Architecture & MVP plan
├── FRONTEND.md        # Frontend specification
└── SNOWFLAKE.md       # Snowflake specification
```

## Getting Started

### Prerequisites

- Node.js 20+
- Snowflake account with SZTAB_DB database populated (see `SNOWFLAKE.md`)

### Setup

```bash
cd frontend
npm install
cp .env.example .env.local  # Configure Snowflake credentials
npm run dev
```

### Environment Variables

```
SNOWFLAKE_ACCOUNT=...
SNOWFLAKE_USER=...
SNOWFLAKE_PRIVATE_KEY=...    # Base64-encoded RSA key
SNOWFLAKE_DATABASE=SZTAB_DB
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_WAREHOUSE=SZTAB_WH
```

## License

MIT
