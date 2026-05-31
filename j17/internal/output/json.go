package output

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/ebpf-http-tracer/internal/types"
)

type JSONOutput struct {
	file     *os.File
	encoder  *json.Encoder
	mu       sync.Mutex
	requests []*types.HTTPRequest
}

func NewJSONOutput(path string) (*JSONOutput, error) {
	f, err := os.Create(path)
	if err != nil {
		return nil, fmt.Errorf("creating JSON file: %w", err)
	}

	encoder := json.NewEncoder(f)
	encoder.SetIndent("", "  ")

	return &JSONOutput{
		file:     f,
		encoder:  encoder,
		requests: make([]*types.HTTPRequest, 0),
	}, nil
}

func (j *JSONOutput) Write(req *types.HTTPRequest) {
	j.mu.Lock()
	defer j.mu.Unlock()

	j.requests = append(j.requests, req)
}

func (j *JSONOutput) Close() error {
	j.mu.Lock()
	defer j.mu.Unlock()

	output := struct {
		Timestamp time.Time           `json:"timestamp"`
		Count     int                 `json:"count"`
		Requests  []*types.HTTPRequest `json:"requests"`
	}{
		Timestamp: time.Now(),
		Count:     len(j.requests),
		Requests:  j.requests,
	}

	if err := j.encoder.Encode(output); err != nil {
		return fmt.Errorf("encoding JSON: %w", err)
	}

	if err := j.file.Sync(); err != nil {
		return fmt.Errorf("syncing file: %w", err)
	}

	return j.file.Close()
}
