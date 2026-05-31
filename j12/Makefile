.PHONY: build build-plugins clean test

build:
	go build -o bin/node ./cmd/node

build-client:
	go build -o bin/client ./cmd/client
	go build -o bin/client_sharded ./cmd/client_sharded

build-plugins:
	go build -buildmode=plugin -o plugins/math.so ./plugins/math
	go build -buildmode=plugin -o plugins/wordcount.so ./plugins/wordcount

build-all: build build-client build-plugins

run-node:
	./bin/node

run-client-sharded:
	go run ./cmd/client_sharded -f wordcount:1.0.0 -lines 5000 -watch

clean:
	rm -rf bin/
	rm -f plugins/*.so

test:
	go test -v ./...

deps:
	go mod download
	go mod tidy
