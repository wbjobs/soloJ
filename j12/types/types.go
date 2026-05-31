package types

import (
	"time"

	"github.com/google/uuid"
	"github.com/libp2p/go-libp2p/core/peer"
)

type FunctionID string
type TaskID string
type NodeID string

type FunctionSpec struct {
	ID          FunctionID            `json:"id"`
	Name        string                `json:"name"`
	Version     string                `json:"version"`
	Description string                `json:"description"`
	InputSchema map[string]interface{} `json:"input_schema"`
	OutputSchema map[string]interface{} `json:"output_schema"`
	Timeout     time.Duration         `json:"timeout"`
	MemoryMB    int64                 `json:"memory_mb"`
	PluginPath  string                `json:"plugin_path"`
}

type Task struct {
	ID         TaskID                 `json:"id"`
	FunctionID FunctionID             `json:"function_id"`
	Input      map[string]interface{} `json:"input"`
	Submitter  peer.ID                `json:"submitter"`
	CreatedAt  time.Time              `json:"created_at"`
	Priority   int                    `json:"priority"`
	RetryCount int                    `json:"retry_count"`
	MaxRetries int                    `json:"max_retries"`

	IsSharded  bool      `json:"is_sharded"`
	IsSubTask  bool      `json:"is_sub_task"`
	ParentID   TaskID    `json:"parent_id,omitempty"`
	ShardInfo  *ShardInfo `json:"shard_info,omitempty"`
}

type ShardInfo struct {
	ShardIndex int         `json:"shard_index"`
	TotalShards int        `json:"total_shards"`
	ShardKey   string      `json:"shard_key"`
	ShardRange *ShardRange `json:"shard_range,omitempty"`
}

type ShardRange struct {
	Start int64 `json:"start"`
	End   int64 `json:"end"`
}

type ShardStrategy string

const (
	ShardStrategyRange   ShardStrategy = "range"
	ShardStrategyHash    ShardStrategy = "hash"
	ShardStrategyKey     ShardStrategy = "key"
	ShardStrategySize    ShardStrategy = "size"
)

type ShardPolicy struct {
	Strategy        ShardStrategy `json:"strategy"`
	ThresholdBytes  int64         `json:"threshold_bytes"`
	MaxShards       int           `json:"max_shards"`
	ShardSizeBytes  int64         `json:"shard_size_bytes"`
	ShardKeyField   string        `json:"shard_key_field"`
	DataField       string        `json:"data_field"`
}

type ShardTask struct {
	Task      *Task
	ShardInfo ShardInfo
}

type ShardSplitter interface {
	Split(task *Task, policy ShardPolicy) ([]*Task, error)
	Name() string
}

type ResultCombiner interface {
	Combine(parentTaskID TaskID, results []*TaskResult) (*TaskResult, error)
	Name() string
}

type ShardedTaskProgress struct {
	ParentTaskID  TaskID
	TotalShards   int
	Completed     int
	Failed        int
	InProgress    int
	Pending       int
	Progress      float64
	SubTasks      map[TaskID]*SubTaskInfo
	StartedAt     time.Time
	LastUpdatedAt time.Time
}

type SubTaskInfo struct {
	TaskID     TaskID
	ShardIndex int
	Status     TaskStatus
	Executor   peer.ID
	Result     *TaskResult
	Error      string
	StartedAt  *time.Time
	FinishedAt *time.Time
}

type TaskResult struct {
	TaskID     TaskID                 `json:"task_id"`
	FunctionID FunctionID             `json:"function_id"`
	Output     map[string]interface{} `json:"output"`
	Error      string                 `json:"error,omitempty"`
	Executor   peer.ID                `json:"executor"`
	StartedAt  time.Time              `json:"started_at"`
	FinishedAt time.Time              `json:"finished_at"`
	Success    bool                   `json:"success"`
	CacheKey   string                 `json:"cache_key"`

	IsSubTaskResult bool      `json:"is_sub_task_result"`
	ParentID        TaskID    `json:"parent_id,omitempty"`
	ShardInfo       *ShardInfo `json:"shard_info,omitempty"`
}

type NodeInfo struct {
	ID            peer.ID      `json:"id"`
	Address       string       `json:"address"`
	Functions     []FunctionID `json:"functions"`
	LastHeartbeat time.Time    `json:"last_heartbeat"`
	Load          float64      `json:"load"`
	MemoryTotal   int64        `json:"memory_total"`
	MemoryUsed    int64        `json:"memory_used"`
	Status        NodeStatus   `json:"status"`
}

type NodeStatus string

const (
	NodeStatusOnline  NodeStatus = "online"
	NodeStatusOffline NodeStatus = "offline"
	NodeStatusBusy    NodeStatus = "busy"
)

type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusFailed    TaskStatus = "failed"
)

func NewTaskID() TaskID {
	return TaskID(uuid.New().String())
}

func NewFunctionID(name, version string) FunctionID {
	return FunctionID(name + ":" + version)
}

type PluginFunction interface {
	Execute(input map[string]interface{}) (map[string]interface{}, error)
	GetSpec() FunctionSpec
}
