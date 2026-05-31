# Ray Tracing Render Farm

A distributed ray tracing render farm system with gRPC task distribution, parallel rendering, and real-time monitoring.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web Browser                             │
│  (React Dashboard + WebSocket for real-time updates)            │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP / WebSocket
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Master Server                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ HTTP Server │  │ gRPC Server │  │ Task Manager            │ │
│  │ (Port 3000) │  │ (Port 50051)│  │ - Block scheduling      │ │
│  └─────────────┘  └─────────────┘  │ - Heartbeat monitoring  │ │
│                                     │ - Fault recovery (30s)  │ │
│                                     │ - PNG merging           │ │
│                                     └─────────────────────────┘ │
└───────────┬───────────────────┬───────────────────┬─────────────┘
            │ gRPC              │ gRPC              │ gRPC
            ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   Worker Node 1  │ │   Worker Node 2  │ │   Worker Node N  │
│  - Ray tracer    │ │  - Ray tracer    │ │  - Ray tracer    │
│  - Heartbeat     │ │  - Heartbeat     │ │  - Heartbeat     │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

## Features

- **Distributed Rendering**: Image split into 16x16 pixel blocks, distributed to workers
- **gRPC Communication**: Efficient task distribution and heartbeat detection
- **Fault Recovery**: Tasks timeout after 30 seconds and are automatically reassigned
- **Real-time Dashboard**: React + WebSocket dashboard showing task progress and worker status
- **Statistics Export**: Export per-pixel samples and worker rendering times
- **PNG Output**: Final rendered image merged and saved as PNG

## Scene Description Format (JSON)

```json
{
  "width": 512,
  "height": 512,
  "samplesPerPixel": 4,
  "camera": {
    "position": { "x": 0, "y": 2, "z": 5 },
    "lookAt": { "x": 0, "y": 0, "z": 0 },
    "fov": 60
  },
  "spheres": [
    {
      "center": { "x": 0, "y": 0, "z": -1 },
      "radius": 0.5,
      "color": { "x": 0.9, "y": 0.3, "z": 0.3 },
      "reflection": 0.3
    }
  ],
  "cubes": [
    {
      "min": { "x": 0.5, "y": -0.5, "z": 0 },
      "max": { "x": 1.5, "y": 0.5, "z": -1 },
      "color": { "x": 0.8, "y": 0.8, "z": 0.3 },
      "reflection": 0.2
    }
  ],
  "lights": [
    {
      "position": { "x": 5, "y": 5, "z": 5 },
      "color": { "x": 1, "y": 1, "z": 1 },
      "intensity": 1
    }
  ]
}
```

## Installation & Setup

### Prerequisites
- Node.js v18+
- npm

### Backend Setup
```bash
# Install dependencies
npm install

# Build frontend (optional, for production)
npm run build:frontend
```

### Frontend Setup
```bash
cd frontend
npm install
npm run build
```

## Running the System

### 1. Start the Master Server
```bash
npm run master
```
- HTTP server: http://localhost:3000
- gRPC server: localhost:50051

### 2. Start Worker Nodes (in separate terminals)
```bash
# Start a single worker
npm run worker

# Or start multiple workers
node src/worker/index.js worker-1
node src/worker/index.js worker-2
node src/worker/index.js worker-3
```

### 3. Open the Dashboard
Navigate to http://localhost:3000 in your browser.

## Usage

### Submitting a Render Task
1. Open the web dashboard
2. Click "Load Sample Scene" or paste your own scene JSON
3. Click "Submit Render Task"
4. Watch the progress in real-time
5. Download the PNG and export statistics when complete

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tasks` | Submit new render task |
| GET | `/api/tasks` | List all tasks |
| GET | `/api/tasks/:id` | Get task status |
| GET | `/api/tasks/:id/stats` | Get detailed statistics |
| GET | `/api/tasks/:id/download` | Download rendered PNG |
| GET | `/api/tasks/:id/export-stats` | Export statistics as JSON |
| GET | `/api/workers` | List all workers |

## Project Structure

```
.
├── proto/
│   └── renderfarm.proto          # gRPC protocol definitions
├── src/
│   ├── master/
│   │   ├── index.js              # Master server entry point
│   │   ├── taskManager.js        # Task scheduling & management
│   │   ├── grpcServer.js         # gRPC server implementation
│   │   ├── httpServer.js         # HTTP + WebSocket server
│   │   └── imageGenerator.js     # PNG generation & stats export
│   ├── worker/
│   │   └── index.js              # Worker node implementation
│   ├── raytracer/
│   │   ├── vec3.js               # Vector math library
│   │   └── raytracer.js          # Core ray tracing engine
│   └── common/
│       └── utils.js              # Shared utilities
├── frontend/
│   ├── public/
│   └── src/
│       ├── App.js                # Main dashboard component
│       ├── index.js              # React entry point
│       └── styles.css            # Dashboard styles
└── output/                       # Rendered images & stats
```

## Testing

```bash
# Test the ray tracer core
node test_render.js
```

## Configuration

### Environment Variables
- `MASTER_ADDRESS`: Master server gRPC address (default: `localhost:50051`)
- `PORT`: HTTP server port (default: `3000`)

### Key Constants
- `BLOCK_SIZE`: 16 pixels (render block size)
- `TASK_TIMEOUT_MS`: 30,000 ms (fault recovery timeout)
- `HEARTBEAT_INTERVAL`: 5,000 ms (worker heartbeat frequency)

## Technologies

- **Backend**: Node.js, gRPC, Express, WebSocket
- **Frontend**: React 18, WebSocket
- **Image Processing**: pngjs
- **Serialization**: Protocol Buffers
