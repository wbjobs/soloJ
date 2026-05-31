# DNA Sequence Alignment

A full-stack DNA/protein sequence alignment system: **Vue 3 + D3.js** frontend, **Flask + Redis** backend, featuring the **Smith-Waterman** local alignment algorithm with block-wise computation, substitution scoring matrices (DNA, BLOSUM62, PAM250), a **Dot Plot** with zoom/pan/click-to-inspect, an **alignment heatmap**, and a Web-Worker-based client-side fallback.

## Features

- Upload FASTA (≤ 2 sequences, ≤ 100 000 bases each).
- Local alignment with Smith-Waterman, affine gap penalties, and block-wise DP for memory efficiency on long sequences.
- Scoring matrices: `DNA`, `BLOSUM62`, `PAM250` (selectable at runtime).
- Dot Plot (k-mer matching) rendered with D3: scroll to zoom, drag to pan, click to inspect a k-mer pair.
- Alignment Heatmap (downsampled SW score matrix) with color legend and zoom/pan.
- Heatmap "diff regions" API returning high-scoring areas as JSON.
- Redis caching keyed on (seq1, seq2, matrix, gap penalties).
- Web Worker running Smith-Waterman in the browser (UI never blocks).

## Layout

```
backend/        Flask app + Smith-Waterman + matrices + Redis cache
frontend/       Vue 3 + Vite + D3.js + Web Worker
docker-compose  Redis service
sample.fasta    Example input
```

## Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
pip install -r requirements.txt
cd ..
python backend/wsgi.py            # listens on :5001
```

Redis is optional but recommended. Start it via Docker:

```bash
docker-compose up -d
```

Environment variables: `PORT` (default `5001`), `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`.

### API

| Method | Path                  | Description                                                                 |
|-------:|-----------------------|-----------------------------------------------------------------------------|
|    GET | `/api/health`         | Service status + Redis connectivity                                         |
|    GET | `/api/matrices`       | List supported scoring matrices                                             |
|   POST | `/api/parse-fasta`    | Parse FASTA string → list of (header, sequence, length)                     |
|   POST | `/api/align`          | Run Smith-Waterman; returns alignment + heatmap (200×200 by default)        |
|   POST | `/api/heatmap/diff`   | Given a heatmap + threshold, return JSON list of high-scoring row segments  |

## Frontend setup

```bash
cd frontend
npm install
npm run dev          # Vite dev server on :5173, proxies /api → :5001
```

Build for production:

```bash
npm run build
npm run preview
```

## Try it

1. Start Redis (optional), start backend, start frontend.
2. Open http://localhost:5173.
3. Upload `sample.fasta` or paste two sequences.
4. Pick a matrix (e.g. `DNA`), adjust gap penalties, click **Align (backend)**.
5. Switch tabs between Dot Plot, Heatmap, Alignment, Diff Regions.
