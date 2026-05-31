# dtask - Distributed Task CLI Tool

A distributed task management CLI tool built with Go + Cobra, using Redis as the message broker.

## Features

- **Task Submission**: Submit Python scripts to task queues
- **Status Query**: Check task status (pending/running/done/failed)
- **Worker Pool**: Start worker processes to execute tasks
- **Plugin System**: Support for dynamic plugin loading (.so files)

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  dtask submit   │────▶│     Redis       │────▶│  dtask worker   │
│  (Client)       │     │  (Broker)       │     │  (Executor)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        Task Storage
                        (Status, Output)
```

## Requirements

- Go 1.21+
- Redis 6.0+
- Python 3.x (for task execution)

## Installation

```bash
# Clone and build
git clone <repo-url>
cd dtask

# Download dependencies
make deps

# Build binary
make build

# Install to /usr/local/bin
sudo make install
```

## Usage

### 1. Start Redis

```bash
redis-server
```

### 2. Start Worker

```bash
# Start worker listening to specific queues
dtask worker start --queues high,default,low

# Specify custom Redis address
dtask worker start --redis localhost:6379

# Custom plugin directory
dtask worker start --plugin-dir /path/to/plugins
```

### 3. Submit Task

```bash
# Submit a task to high priority queue
dtask submit --queue high --script ./examples/job.py

# Submit a task with dependencies (will wait for all dependencies to complete)
dtask submit --queue high --script ./examples/job.py --dep <task_id1> --dep <task_id2>

# Output:
# Task submitted successfully.
# Task ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**Note**: If cyclic dependencies are detected, the submission will fail with an error message showing the cycle path.

### 4. View Task Dependency Graph

```bash
# Display ASCII tree of task dependencies
dtask graph <task_id>

# Limit traversal depth
dtask graph <task_id> --depth 5
```

Example output:
```
Task Dependency Graph: task-c
└── task-c [pending]
    ├── task-a [done]
    └── task-b [running]
```

### 4. Check Task Status

```bash
dtask status <task_id>

# Output:
# Task ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# Status: done
# Queue: high
# Script: ./examples/job.py
# Created: 2024-01-01 12:00:00
# Updated: 2024-01-01 12:00:03
# Exit Code: 0
# Output:
# Starting job execution...
# ...
```

## Plugin System

### How Plugins Work

Workers can dynamically load `.so` plugins from `~/.dtask/plugins/` directory. Each plugin can define two hooks:

- `PreExecute`: Called before task execution
- `PostExecute`: Called after task execution

### Plugin Interface

A valid plugin must export these functions:

```go
func Name() string
func PreExecute(t *task.Task) error
func PostExecute(t *task.Task) error
```

### Building Plugins

```bash
# Build the example logger plugin
make test-plugin

# Install plugin to ~/.dtask/plugins/
make install-plugin
```

### Creating Custom Plugins

1. Create a new directory under `plugins/`
2. Implement the required functions
3. Build with `-buildmode=plugin`

```bash
go build -buildmode=plugin -o myplugin.so plugins/myplugin/main.go
```

## Reliability Mechanisms

### Task Execution Guarantees

1. **Processing Queue**: When a worker picks up a task, it's moved to a worker-specific processing sorted set (`dtask:processing:{worker_id}`) with a timestamp.

2. **Heartbeat Mechanism**: Each worker periodically refreshes the TTL on its processing set. If a worker crashes, the set will expire after `heartbeat-ttl`.

3. **Task Reclamation**: Workers periodically scan all processing sets for tasks that have exceeded the timeout and re-queue them.

4. **Graceful Shutdown**: On SIGINT/SIGTERM, the worker will:
   - Stop accepting new tasks
   - Re-queue all currently running tasks
   - Wait for in-flight tasks to complete
   - Close Redis connections properly

5. **Connection Pooling**: Redis client is configured with proper connection pool settings to prevent connection leaks under high concurrency.

### Worker Configuration Options

| Flag | Default | Description |
|------|---------|-------------|
| `--queues` | default,high,low | List of queues to listen to |
| `--concurrency` | 10 | Maximum concurrent tasks per worker |
| `--task-timeout` | 2h | Maximum execution time before task is considered failed |
| `--heartbeat-ttl` | 5m | TTL for worker's processing set |
| `--reclaim-interval` | 1m | How often to scan for expired tasks |
| `--redis` | localhost:6379 | Redis server address |
| `--plugin-dir` | ~/.dtask/plugins | Plugin directory |

## Redis Key Schema

- `dtask:queue:{queue_name}` - Task queue (LIST)
- `dtask:task:{task_id}` - Task metadata (STRING, JSON)
- `dtask:processing:{worker_id}` - Worker's processing tasks (ZSET, score = timestamp)

## Project Structure

```
dtask/
├── cmd/
│   ├── root.go          # Root command
│   ├── submit.go        # Submit command (with --dep support)
│   ├── status.go        # Status command
│   ├── graph.go         # Dependency graph command
│   ├── worker.go        # Worker parent command
│   └── worker_start.go  # Worker start command
├── internal/
│   ├── task/
│   │   └── task.go      # Task model (with dependencies)
│   ├── redis/
│   │   └── client.go    # Redis client
│   ├── dag/
│   │   └── dag.go       # DAG graph and cycle detection
│   └── plugin/
│       ├── plugin.go    # Plugin interface
│       └── manager.go   # Plugin manager
├── plugins/
│   └── logger/
│       └── main.go      # Example logger plugin
├── examples/
│   └── job.py           # Example Python script
├── main.go              # Entry point
├── go.mod
├── Makefile
└── README.md
```

## Common Commands

```bash
# Build
make build

# Clean
make clean

# Run worker
make run-worker

# Submit test task
make submit-test
```

## Notes

- **Windows Limitation**: Go plugins (.so files) are not supported on Windows. The plugin system will be disabled automatically on Windows.
- **Python Path**: Ensure `python3` (or `python` on Windows) is in your PATH.
- **Redis Connection**: Default Redis address is `localhost:6379`. Use `--redis` flag to customize.
