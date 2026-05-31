.PHONY: all wasm frontend backend clean run-backend run-frontend

all: wasm backend

wasm:
	@echo "Building WASM module..."
	@cd wasm && powershell -File build.ps1

frontend:
	@echo "Installing frontend dependencies..."
	@cd frontend && npm install
	@echo "Building frontend..."
	@cd frontend && npm run build

backend:
	@echo "Building backend..."
	@cd backend && go build -o ../bin/server.exe ./cmd/server

run-backend:
	@echo "Starting backend server..."
	@cd backend && go run ./cmd/server -addr :8080 -db ./data/rocksdb

run-frontend:
	@echo "Starting frontend dev server..."
	@cd frontend && npm run dev

clean:
	@echo "Cleaning..."
	@if exist wasm\build rmdir /s /q wasm\build
	@if exist bin rmdir /s /q bin
	@if exist frontend\dist rmdir /s /q frontend\dist
	@if exist backend\data rmdir /s /q backend\data
	@echo "Clean complete."

init:
	@echo "Initializing project..."
	@cd frontend && npm install
