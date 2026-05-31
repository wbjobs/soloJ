package core

import (
	"encoding/json"
	"fmt"
)

type FuzzTask struct {
	ID          string `json:"id"`
	TargetIP    string `json:"target_ip"`
	TargetPort  int    `json:"target_port"`
	PacketData  []byte `json:"packet_data"`
	IsMalformed bool   `json:"is_malformed"`
	Timestamp   int64  `json:"timestamp"`
}

func (t *FuzzTask) Serialize() ([]byte, error) {
	return json.Marshal(t)
}

func (t *FuzzTask) MatchID() string {
	return fmt.Sprintf(`"id":"%s"`, t.ID)
}

func DeserializeTask(data []byte) (*FuzzTask, error) {
	var task FuzzTask
	err := json.Unmarshal(data, &task)
	if err != nil {
		return nil, err
	}
	return &task, nil
}

type TaskResult struct {
	TaskID     string `json:"task_id"`
	Success    bool   `json:"success"`
	TargetIP   string `json:"target_ip"`
	IsAlive    bool   `json:"is_alive"`
	ErrorMsg   string `json:"error_msg"`
	FinishedAt int64  `json:"finished_at"`
}

func (r *TaskResult) Serialize() ([]byte, error) {
	return json.Marshal(r)
}

func DeserializeResult(data []byte) (*TaskResult, error) {
	var result TaskResult
	err := json.Unmarshal(data, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func GenerateTaskID() string {
	return fmt.Sprintf("task_%d_%d", RandomInt(1000, 9999), RandomInt(1000, 9999))
}
