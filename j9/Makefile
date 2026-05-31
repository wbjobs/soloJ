.PHONY: all build install clean test-plugin

BINARY_NAME=dtask
PLUGIN_NAME=logger.so

all: build

build:
	go build -o $(BINARY_NAME) .

install: build
	mv $(BINARY_NAME) /usr/local/bin/

clean:
	rm -f $(BINARY_NAME)
	rm -f plugins/logger/$(PLUGIN_NAME)

test-plugin:
	go build -buildmode=plugin -o plugins/logger/$(PLUGIN_NAME) plugins/logger/main.go

install-plugin: test-plugin
	mkdir -p ~/.dtask/plugins
	cp plugins/logger/$(PLUGIN_NAME) ~/.dtask/plugins/

run-worker:
	./$(BINARY_NAME) worker start --queues high,default,low

run-worker-high-conc:
	./$(BINARY_NAME) worker start --queues high,default,low --concurrency 50

run-worker-long-task:
	./$(BINARY_NAME) worker start --queues high,default,low --task-timeout 8h

submit-test:
	./$(BINARY_NAME) submit --queue high --script ./examples/job.py

submit-low:
	./$(BINARY_NAME) submit --queue low --script ./examples/job.py

submit-with-dep:
	@echo "Usage: make submit-with-dep DEP=<task_id>"
	./$(BINARY_NAME) submit --queue high --script ./examples/job.py --dep $(DEP)

graph:
	@echo "Usage: make graph TASK=<task_id>"
	./$(BINARY_NAME) graph $(TASK)

deps:
	go mod download
	go mod tidy

test:
	go test ./...

vet:
	go vet ./...
