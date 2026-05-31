.PHONY: all build server client test clean

all: build

build: server client

server:
	go build -o bin/server.exe ./server

client:
	go build -o bin/client.exe ./client

test:
	go test -v ./...

clean:
	rm -rf bin/
