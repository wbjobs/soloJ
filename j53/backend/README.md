# YjsCollab Backend

A collaborative text editor backend using Elixir Phoenix with Yjs CRDT support.

## Prerequisites

- Elixir 1.14+
- PostgreSQL 13+
- Erlang 25+

## Setup

1. Install dependencies:
   ```bash
   mix deps.get
   ```

2. Create and migrate the database:
   ```bash
   mix ecto.create
   mix ecto.migrate
   ```

3. Start the Phoenix server:
   ```bash
   mix phx.server
   ```

The server will be available at `http://localhost:4000`.

## WebSocket Protocol

The backend supports Yjs synchronization via Phoenix Channels:

- **Endpoint**: `ws://localhost:4000/socket/websocket`
- **Topic**: `yjs:{doc_id}`

### Message Types

- `0` - Sync Step 1 (client sends state vector)
- `1` - Sync Step 2 (server sends full document state)
- `2` - Update (incremental updates)

## REST API

- `GET /api/health` - Health check
- `GET /api/docs/:id/updates` - Get document update info
- `POST /api/docs/:id/updates` - Create a new update (base64 encoded)

## Database Schema

### yjs_updates
Stores individual Yjs update operations:
- `doc_id` - Document identifier
- `update` - Binary Yjs update data
- `version` - Monotonically increasing version number
- `client_id` - Optional client identifier

### yjs_doc_snapshots
Stores periodic document snapshots for faster loading:
- `doc_id` - Document identifier
- `snapshot` - Merged binary snapshot
- `version` - Snapshot version
