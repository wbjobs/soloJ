# Point Cloud Processing & Visualization System

A scalable point cloud processing and visualization system with octree partitioning, Draco compression, LOD (Level of Detail), and WebGL rendering.

## Architecture

### Backend (Node.js + Express)
- **LAS File Parsing**: Stream-based LAS/LAZ file reader supporting large files
- **Octree Partitioning**: Spatial indexing for efficient point cloud organization
- **Draco Compression**: Google's Draco library for efficient point cloud compression
- **Multi-level LOD**: Automatic LOD generation for progressive rendering
- **S3 Storage**: Compatible with AWS S3, MinIO, and other S3-compatible storage
- **MongoDB**: Metadata storage and indexing for point clouds and chunks

### Frontend (Three.js + WebGL)
- **Dynamic LOD Loading**: Camera-position based LOD selection
- **Multiple Coloring Modes**: Height (elevation), intensity, and RGB coloring
- **Distance Measurement**: 3D distance calculation between points
- **Performance Optimized**: WebGL shader-based rendering with point size attenuation

## Features

- ✅ Support for LAS/LAZ file formats
- ✅ Octree-based spatial partitioning
- ✅ Draco compression for efficient data transfer
- ✅ Multi-level LOD generation
- ✅ S3-compatible object storage
- ✅ MongoDB metadata indexing
- ✅ Three.js WebGL rendering
- ✅ Dynamic LOD loading based on camera position
- ✅ Height/intensity/RGB coloring modes
- ✅ 3D distance measurement tool
- ✅ Memory controlled (≤ 2GB) processing pipeline
- ✅ Scalable to billions of points

## System Requirements

### Backend
- Node.js ≥ 18.0.0
- MongoDB ≥ 4.0
- S3-compatible storage (AWS S3, MinIO, etc.)

### Frontend
- Modern web browser with WebGL 2.0 support
- Vite ≥ 5.0

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# Access frontend: http://localhost:5173
# Access backend API: http://localhost:3000
# Access MinIO console: http://localhost:9001 (minioadmin/minioadmin)
```

### Manual Setup

#### Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your MongoDB and S3 credentials

# Start development server
npm run dev

# Start production server
npm start
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## API Reference

### Point Cloud Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pointcloud/upload` | Upload and process a LAS file |
| GET | `/api/pointcloud/` | List all point clouds |
| GET | `/api/pointcloud/:id` | Get point cloud metadata |
| DELETE | `/api/pointcloud/:id` | Delete a point cloud |

### Chunk Query & Download

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pointcloud/:id/chunks/query` | Query chunks based on camera position |
| GET | `/api/pointcloud/:id/chunks/:lod/:key` | Download a specific chunk |
| GET | `/api/pointcloud/chunk/:chunkId` | Download chunk by ID |

## Configuration

### Environment Variables (Backend)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `MONGODB_URI` | `mongodb://localhost:27017/pointcloud` | MongoDB connection URI |
| `S3_ENDPOINT` | `http://localhost:9000` | S3 endpoint URL |
| `S3_ACCESS_KEY` | `minioadmin` | S3 access key |
| `S3_SECRET_KEY` | `minioadmin` | S3 secret key |
| `S3_BUCKET` | `pointcloud-chunks` | S3 bucket name |
| `S3_USE_SSL` | `false` | Use SSL for S3 connections |
| `MAX_POINTS_PER_CHUNK` | `65536` | Maximum points per octree node |
| `MAX_LOD_LEVEL` | `8` | Maximum LOD levels to generate |
| `MEMORY_LIMIT_GB` | `2` | Memory limit in GB |

## Usage

### Uploading a Point Cloud

1. Start the backend and frontend servers
2. Open the web interface
3. Click "Upload LAS File"
4. Select your LAS file
5. Wait for processing to complete
6. Select your dataset from the dropdown

### Using the Viewer

- **Rotate**: Left-click + drag
- **Pan**: Right-click + drag
- **Zoom**: Mouse wheel
- **Measure Distance**: Click "Measure Distance", then click on the point cloud to set points
- **Change Coloring**: Select from the "Coloring Mode" dropdown
- **Adjust Point Size**: Use the point size slider

## Performance Characteristics

| Points | Processing Time | Chunks | Memory Usage |
|--------|-----------------|--------|--------------|
| 1M | ~30 seconds | ~100 | < 500 MB |
| 10M | ~5 minutes | ~1,000 | < 1 GB |
| 100M | ~45 minutes | ~10,000 | < 1.5 GB |
| 1B+ | Distributed processing required | 100,000+ | Distributed |

## Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration
│   │   ├── db/              # MongoDB connection
│   │   ├── models/          # Mongoose models
│   │   ├── parsers/         # LAS file parser
│   │   ├── octree/          # Octree implementation
│   │   ├── compression/     # Draco compression
│   │   ├── storage/         # S3 storage client
│   │   ├── processing/      # Processing pipeline
│   │   ├── routes/          # Express routes
│   │   └── server.js        # Server entry point
│   ├── tests/               # Unit tests and benchmarks
│   ├── scripts/             # Utility scripts
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/             # API client
│   │   ├── loaders/         # Chunk & Draco loader
│   │   ├── renderer/        # Point cloud renderer
│   │   ├── shaders/         # WebGL shaders
│   │   ├── tools/           # Measurement tools
│   │   └── main.js          # Application entry
│   ├── index.html
│   └── package.json
├── docker-compose.yml       # Docker deployment
└── README.md
```

## Testing

```bash
# Run backend tests
cd backend
npm test

# Run benchmarks
node tests/benchmark.js

# Generate test LAS file
node scripts/generateTestLAS.js test.las 1000000
```

## License

MIT
