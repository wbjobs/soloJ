.PHONY: all build generate clean help

BIN_NAME := http-tracer
BPF_SRC := bpf/http_trace.bpf.c
BPF_OUT := internal/ebpf/bpf_bpfel.go internal/ebpf/bpf_bpfeb.go

GO ?= go
CLANG ?= clang
BPF2GO ?= $(GO) run github.com/cilium/ebpf/cmd/bpf2go

VMLINUX ?= /sys/kernel/btf/vmlinux
BPF_INCLUDE ?= -I/usr/include -I/usr/include/x86_64-linux-gnu
BPF_CFLAGS ?= -O2 -g -Wall -Werror -Wno-address-of-packed-member

all: build

help:
	@echo "Available targets:"
	@echo "  make build    - Build the http-tracer binary"
	@echo "  make generate - Generate eBPF Go bindings"
	@echo "  make clean    - Clean build artifacts"
	@echo "  make run      - Run the tracer (requires root)"
	@echo "  make deps     - Install dependencies"
	@echo ""
	@echo "Kernel Compatibility:"
	@echo "  - Kernel 5.4+: Basic support"
	@echo "  - Kernel 5.10+: Full CO-RE support"
	@echo "  - Uses bpf_probe_read() for maximum compatibility"
	@echo "  - Supports TCP segmentation offload (GSO/TSO)"

deps:
	@echo "Installing Go dependencies..."
	$(GO) mod download
	@echo "Installing bpf2go..."
	$(GO) install github.com/cilium/ebpf/cmd/bpf2go@latest

generate: $(BPF_OUT)

$(BPF_OUT): $(BPF_SRC)
	@echo "Generating eBPF Go bindings..."
	@echo "Note: Uses bpf_probe_read() for kernel 5.10+ compatibility"
	cd internal/ebpf && $(BPF2GO) -cc $(CLANG) -cflags "$(BPF_CFLAGS) $(BPF_INCLUDE)" bpf ../../$(BPF_SRC) -- $(BPF_INCLUDE)

build: generate
	@echo "Building $(BIN_NAME)..."
	$(GO) build -o $(BIN_NAME) ./cmd/http-tracer

build-amd64: generate
	@echo "Building $(BIN_NAME) for amd64..."
	GOARCH=amd64 $(GO) build -o $(BIN_NAME) ./cmd/http-tracer

run: build
	@echo "Running tracer (requires root privileges)..."
	@echo "Tip: Use --alert 500ms for response time alerts"
	@echo "Tip: Use --json output.json to export data"
	sudo ./$(BIN_NAME)

clean:
	@echo "Cleaning up..."
	rm -f $(BIN_NAME)
	rm -f internal/ebpf/bpf_*.go
	rm -f internal/ebpf/*.o
