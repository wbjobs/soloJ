package task

import (
	"encoding/json"
	"time"
)

type TaskStatus string

const (
	StatusPending TaskStatus = "pending"
	StatusRunning TaskStatus = "running"
	StatusDone    TaskStatus = "done"
	StatusFailed  TaskStatus = "failed"
)

type Task struct {
	ID           string     `json:"id"`
	Queue        string     `json:"queue"`
	Script       string     `json:"script"`
	Status       TaskStatus `json:"status"`
	Output       string     `json:"output,omitempty"`
	ExitCode     int        `json:"exit_code,omitempty"`
	Dependencies []string   `json:"dependencies,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

func NewTask(id, queue, script string, deps []string) *Task {
	now := time.Now()
	if deps == nil {
		deps = []string{}
	}
	return &Task{
		ID:           id,
		Queue:        queue,
		Script:       script,
		Status:       StatusPending,
		Dependencies: deps,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
}

func (t *Task) Marshal() (string, error) {
	data, err := json.Marshal(t)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func Unmarshal(data string) (*Task, error) {
	var t Task
	if err := json.Unmarshal([]byte(data), &t); err != nil {
		return nil, err
	}
	return &t, nil
}
