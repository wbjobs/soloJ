# eBPF HTTP/HTTPS Tracer

A command-line tool that uses eBPF technology to trace HTTP and HTTPS request lifecycle in kernel space. It monitors `tcp_sendmsg`/`tcp_recvmsg` kernel functions and `SSL_write`/`SSL_read` for HTTPS, with decryption support via SSLKEYLOGFILE.

## Features

- 🔍 **Kernel-level tracing**: Monitor TCP traffic using eBPF kprobes
- 🔐 **HTTPS decryption**: Decrypt TLS 1.2/1.3 traffic using SSLKEYLOGFILE
- 📊 **HTTP metrics extraction**: Parse method, path, status code, response time, and sizes
- 🎯 **PID filtering**: Filter traces by specific process ID
- ⚠️ **Response time alerts**: Get alerted when response time exceeds threshold
- 💾 **JSON export**: Export trace data to JSON file
- 📋 **Table output**: Beautiful terminal table display with color coding
- 🔄 **BPF CO-RE**: Compile Once - Run Everywhere compatibility
- 🧩 **TCP segmentation support**: Handle large HTTP requests/responses with GSO/TSO
- 🔧 **Kernel 5.10+ compatibility**: Uses `bpf_probe_read()` for maximum compatibility
- 🔒 **OpenSSL/BoringSSL support**: Trace SSL_write and SSL_read via uprobes

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Kernel Space                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  tcp_sendmsg / tcp_recvmsg Kernel Functions       │  │
│  └─────────────┬─────────────────────────────────────┘  │
│                │ kprobes                                 │
│  ┌─────────────▼─────────────────────────────────────┐  │
│  │           eBPF Program (http_trace.bpf.c)         │  │
│  │  - Capture payload and socket info                │  │
│  │  - Send to userspace via perf buffer              │  │
│  └─────────────┬─────────────────────────────────────┘  │
└────────────────┼────────────────────────────────────────┘
                 │ perf event buffer
┌────────────────▼────────────────────────────────────────┐
│                   User Space (Go)                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │                eBPF Loader                        │  │
│  └─────────────┬─────────────────────────────────────┘  │
│                │                                          │
│  ┌─────────────▼─────────────────────────────────────┐  │
│  │               HTTP Parser                         │  │
│  │  - Match request/response pairs                  │  │
│  │  - Extract metrics                                │  │
│  └─────────────┬─────────────────────────────────────┘  │
│                │                                          │
│  ┌─────────────▼─────────────────────────────────────┐  │
│  │               Output Layer                         │  │
│  │  - Terminal Table                                 │  │
│  │  - JSON Export                                    │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Requirements

### System Requirements

- Linux kernel 5.4+ (with BTF support for CO-RE)
- Root privileges (for eBPF operations)

### Build Dependencies

- Go 1.21+
- Clang/LLVM
- libbpf-dev
- linux-headers

## Installation

### Install Dependencies (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y clang llvm libbpf-dev linux-headers-$(uname -r)
```

### Build

```bash
# Clone the repository
cd http-tracer

# Install Go dependencies
make deps

# Build the binary
make build
```

## Usage

### Basic Usage

```bash
# Run with default settings (requires root)
sudo ./http-tracer
```

### Filter by PID

```bash
# Trace only PID 1234
sudo ./http-tracer --pid 1234
sudo ./http-tracer -p 1234
```

### Response Time Alert

```bash
# Alert when response time exceeds 500ms
sudo ./http-tracer --alert 500ms
sudo ./http-tracer -a 1s
```

### Export to JSON

```bash
# Export trace data to output.json
sudo ./http-tracer --json output.json
sudo ./http-tracer -j trace.json
```

### Verbose Mode

```bash
# Show debug information
sudo ./http-tracer --verbose
sudo ./http-tracer -v
```

### Combined Options

```bash
# Filter by PID, set alert threshold, and export to JSON
sudo ./http-tracer -p 8080 -a 300ms -j results.json
```

### Show Help

```bash
./http-tracer --help
```

## Output Example

```
🚀 Starting eBPF HTTP tracer...
📡 Monitoring tcp_sendmsg and tcp_recvmsg kernel functions
⏹️  Press Ctrl+C to stop

+----------+------+----------+--------+-------------------+--------+-----------+----------+----------+
|   TIME   | PID  |   COMM   | METHOD |       PATH        | STATUS | RESP TIME | REQ SIZE | RES SIZE |
+----------+------+----------+--------+-------------------+--------+-----------+----------+----------+
| 15:30:45 | 1234 | curl     | GET    | /api/users        |    200 | 45ms      | 128 B    | 2.1 KB   |
| 15:30:46 | 5678 | nginx    | POST   | /api/login        |    401 | 12ms      | 512 B    | 256 B    |
| 15:30:47 | 1234 | curl     | GET    | /api/data         |    500 | 650ms ⚠️  | 64 B     | 128 B    |
+----------+------+----------+--------+-------------------+--------+-----------+----------+----------+

🚨 ALERT: Response time exceeded threshold! 650ms > 500ms
```

## Output Fields

| Field | Description |
|-------|-------------|
| TIME | Timestamp of the response |
| PID | Process ID |
| COMM | Process command name |
| METHOD | HTTP method (GET, POST, PUT, etc.) |
| PATH | Request path |
| STATUS | HTTP status code (color coded) |
| RESP TIME | Response time (red if exceeds threshold) |
| REQ SIZE | Request payload size |
| RES SIZE | Response payload size |
| SRC | Source IP:Port |
| DST | Destination IP:Port |

## JSON Output Format

```json
{
  "timestamp": "2024-01-15T15:30:47Z",
  "count": 3,
  "requests": [
    {
      "PID": 1234,
      "Comm": "curl",
      "Method": "GET",
      "Path": "/api/users",
      "StatusCode": 200,
      "ResponseTime": 45000000,
      "RequestSize": 128,
      "ResponseSize": 2150,
      "SrcIP": "192.168.1.100",
      "DstIP": "10.0.0.1",
      "SrcPort": 54321,
      "DstPort": 80,
      "Timestamp": "2024-01-15T15:30:45.123Z"
    }
  ]
}
```

## Project Structure

```
http-tracer/
├── bpf/
│   └── http_trace.bpf.c      # eBPF C program (kernel space) - TCP + TLS tracing
├── cmd/
│   └── http-tracer/
│       └── main.go           # CLI entry point
├── internal/
│   ├── ebpf/
│   │   └── loader.go         # eBPF program loader
│   ├── parser/
│   │   └── http.go           # HTTP protocol parser with TLS integration
│   ├── tls/
│   │   ├── keylog.go         # SSLKEYLOGFILE parser
│   │   ├── decrypt.go        # TLS 1.2/1.3 decryption (AES-CBC, AES-GCM)
│   │   └── manager.go        # TLS session state management
│   ├── output/
│   │   ├── table.go          # Table output formatter
│   │   └── json.go           # JSON export
│   └── types/
│       └── types.go          # Type definitions (with TLS support)
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

## How It Works

### 1. eBPF Tracing

The eBPF program attaches kprobes to:
- `tcp_sendmsg` - for outgoing HTTP requests
- `tcp_recvmsg` - for incoming HTTP responses

### 2. Data Collection

For each TCP send/recv event, the eBPF program captures:
- Process ID and thread ID
- Process command name
- Timestamp
- Socket information (source/dest IP and port)
- Payload data (first 512 bytes for HTTP parsing)

### 3. HTTP Parsing

The user-space parser:
1. Identifies HTTP requests (GET, POST, etc.)
2. Stores pending requests in a map
3. Matches responses to corresponding requests
4. Calculates response time
5. Extracts all relevant metrics

### 4. Output

Results are displayed in real-time as a table, with optional:
- Color coding for status codes
- Alerts for slow responses
- JSON export on exit

## Performance Considerations

- **Low overhead**: eBPF programs run in kernel space with minimal overhead
- **Extended payload**: Captures up to 4096 bytes for HTTP parsing (headers + partial body)
- **Per CPU buffers**: Uses perf event per-CPU buffers for efficient data transfer
- **CO-RE**: BPF CO-RE ensures compatibility across kernel versions
- **Segmentation support**: Handles TCP GSO/TSO segmented packets with multi-segment iovec

## Compatibility Notes

### Kernel Version Support

| Kernel Version | Status | Notes |
|----------------|--------|-------|
| 5.4 - 5.9 | ✅ Supported | Basic tracing support |
| 5.10+ | ✅ Supported | Full CO-RE support with bpf_probe_read() |

### Known Issues & Fixes

1. **`bpf_probe_read_user` relocation error**: 
   - **Symptom**: "relocation failed: unknown symbol: bpf_probe_read_user"
   - **Cause**: Newer kernels require using `bpf_probe_read()` instead
   - **Fix**: Uses `bpf_probe_read()` for reading user-space memory, compatible across kernel versions

2. **HTTP body truncation for large requests**:
   - **Symptom**: Large HTTP bodies (>MTU) being truncated
   - **Cause**: TCP segmentation offload (GSO/TSO) splits large packets
   - **Fix**: Implemented multi-segment iovec reading to capture data from multiple segments

3. **Kernel 5.10+ CO-RE compatibility**:
   - Uses BPF CO-RE (Compile Once - Run Everywhere) technology
   - Uses `bpf_probe_read_kernel()` for kernel memory access
   - Uses `bpf_probe_read()` for user memory access (compatible with all kernel versions)
   - Avoids deprecated helper functions

## Troubleshooting

### Permission Denied

Ensure you're running with root privileges:
```bash
sudo ./http-tracer
```

### BTF Not Found

If you get BTF-related errors, ensure your kernel was compiled with BTF:
```bash
# Check for BTF support
ls /sys/kernel/btf/vmlinux
```

### Missing Dependencies

Install required packages:
```bash
sudo apt-get install -y clang llvm libbpf-dev linux-headers-$(uname -r)
```

## License

GPL-3.0 (required for eBPF programs)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
