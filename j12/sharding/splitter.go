package sharding

import (
	"encoding/json"
	"fmt"
	"hash/fnv"

	"github.com/fcnet/func-compute/types"
)

type RangeSplitter struct{}

func NewRangeSplitter() *RangeSplitter {
	return &RangeSplitter{}
}

func (s *RangeSplitter) Name() string {
	return "range_splitter"
}

func (s *RangeSplitter) Split(task *types.Task, policy types.ShardPolicy) ([]*types.Task, error) {
	data, ok := task.Input[policy.DataField]
	if !ok {
		return nil, fmt.Errorf("data field %s not found in input", policy.DataField)
	}

	items, ok := data.([]interface{})
	if !ok {
		return nil, fmt.Errorf("data field %s is not an array", policy.DataField)
	}

	totalItems := len(items)
	if totalItems == 0 {
		return nil, fmt.Errorf("no data to split")
	}

	numShards := policy.MaxShards
	if numShards <= 0 {
		numShards = 4
	}
	if numShards > totalItems {
		numShards = totalItems
	}

	shardSize := (totalItems + numShards - 1) / numShards
	shards := make([]*types.Task, 0, numShards)

	for i := 0; i < numShards; i++ {
		start := i * shardSize
		end := (i + 1) * shardSize
		if end > totalItems {
			end = totalItems
		}

		shardItems := items[start:end]
		shardInput := make(map[string]interface{})
		for k, v := range task.Input {
			shardInput[k] = v
		}
		shardInput[policy.DataField] = shardItems

		shardTask := &types.Task{
			ID:         types.NewTaskID(),
			FunctionID: task.FunctionID,
			Input:      shardInput,
			Submitter:  task.Submitter,
			CreatedAt:  task.CreatedAt,
			Priority:   task.Priority,
			MaxRetries: task.MaxRetries,
			IsSubTask:  true,
			ParentID:   task.ID,
			ShardInfo: &types.ShardInfo{
				ShardIndex: i,
				TotalShards: numShards,
				ShardKey:   fmt.Sprintf("shard-%d", i),
				ShardRange: &types.ShardRange{
					Start: int64(start),
					End:   int64(end),
				},
			},
		}

		shards = append(shards, shardTask)
	}

	return shards, nil
}

type HashSplitter struct{}

func NewHashSplitter() *HashSplitter {
	return &HashSplitter{}
}

func (s *HashSplitter) Name() string {
	return "hash_splitter"
}

func (s *HashSplitter) Split(task *types.Task, policy types.ShardPolicy) ([]*types.Task, error) {
	data, ok := task.Input[policy.DataField]
	if !ok {
		return nil, fmt.Errorf("data field %s not found in input", policy.DataField)
	}

	items, ok := data.([]interface{})
	if !ok {
		return nil, fmt.Errorf("data field %s is not an array", policy.DataField)
	}

	if policy.ShardKeyField == "" {
		return nil, fmt.Errorf("shard key field not specified")
	}

	numShards := policy.MaxShards
	if numShards <= 0 {
		numShards = 4
	}

	shardBuckets := make([][]interface{}, numShards)
	for _, item := range items {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("item is not a map, cannot extract key field %s", policy.ShardKeyField)
		}

		key, ok := itemMap[policy.ShardKeyField]
		if !ok {
			return nil, fmt.Errorf("key field %s not found in item", policy.ShardKeyField)
		}

		keyStr := fmt.Sprintf("%v", key)
		hash := fnvHash(keyStr)
		shardIdx := int(hash % uint32(numShards))
		shardBuckets[shardIdx] = append(shardBuckets[shardIdx], item)
	}

	shards := make([]*types.Task, 0, numShards)
	actualShards := 0

	for i, bucket := range shardBuckets {
		if len(bucket) == 0 {
			continue
		}

		shardInput := make(map[string]interface{})
		for k, v := range task.Input {
			shardInput[k] = v
		}
		shardInput[policy.DataField] = bucket

		shardTask := &types.Task{
			ID:         types.NewTaskID(),
			FunctionID: task.FunctionID,
			Input:      shardInput,
			Submitter:  task.Submitter,
			CreatedAt:  task.CreatedAt,
			Priority:   task.Priority,
			MaxRetries: task.MaxRetries,
			IsSubTask:  true,
			ParentID:   task.ID,
			ShardInfo: &types.ShardInfo{
				ShardIndex: actualShards,
				TotalShards: 0,
				ShardKey:   fmt.Sprintf("hash-%d", i),
			},
		}

		shards = append(shards, shardTask)
		actualShards++
	}

	for _, shard := range shards {
		shard.ShardInfo.TotalShards = actualShards
	}

	return shards, nil
}

func fnvHash(s string) uint32 {
	h := fnv.New32a()
	h.Write([]byte(s))
	return h.Sum32()
}

type SizeSplitter struct{}

func NewSizeSplitter() *SizeSplitter {
	return &SizeSplitter{}
}

func (s *SizeSplitter) Name() string {
	return "size_splitter"
}

func (s *SizeSplitter) Split(task *types.Task, policy types.ShardPolicy) ([]*types.Task, error) {
	dataBytes, err := json.Marshal(task.Input)
	if err != nil {
		return nil, fmt.Errorf("marshal input: %w", err)
	}

	inputSize := int64(len(dataBytes))
	if inputSize < policy.ThresholdBytes {
		return nil, fmt.Errorf("input size %d bytes is below threshold %d bytes", inputSize, policy.ThresholdBytes)
	}

	shardSize := policy.ShardSizeBytes
	if shardSize <= 0 {
		shardSize = 1024 * 1024
	}

	data, ok := task.Input[policy.DataField]
	if !ok {
		return nil, fmt.Errorf("data field %s not found in input", policy.DataField)
	}

	items, ok := data.([]interface{})
	if !ok {
		return splitByBytes(task, policy, shardSize)
	}

	return splitItemsBySize(task, policy, items, shardSize)
}

func splitByBytes(task *types.Task, policy types.ShardPolicy, shardSize int64) ([]*types.Task, error) {
	dataBytes, err := json.Marshal(task.Input[policy.DataField])
	if err != nil {
		return nil, fmt.Errorf("marshal data: %w", err)
	}

	totalBytes := len(dataBytes)
	numShards := (totalBytes + int(shardSize) - 1) / int(shardSize)
	if numShards > policy.MaxShards && policy.MaxShards > 0 {
		numShards = policy.MaxShards
	}

	shards := make([]*types.Task, 0, numShards)
	bytesPerShard := totalBytes / numShards

	for i := 0; i < numShards; i++ {
		start := i * bytesPerShard
		end := (i + 1) * bytesPerShard
		if i == numShards-1 {
			end = totalBytes
		}

		var shardData interface{}
		if err := json.Unmarshal(dataBytes[start:end], &shardData); err != nil {
			return nil, fmt.Errorf("unmarshal shard data: %w", err)
		}

		shardInput := make(map[string]interface{})
		for k, v := range task.Input {
			shardInput[k] = v
		}
		shardInput[policy.DataField] = shardData

		shardTask := &types.Task{
			ID:         types.NewTaskID(),
			FunctionID: task.FunctionID,
			Input:      shardInput,
			Submitter:  task.Submitter,
			CreatedAt:  task.CreatedAt,
			Priority:   task.Priority,
			MaxRetries: task.MaxRetries,
			IsSubTask:  true,
			ParentID:   task.ID,
			ShardInfo: &types.ShardInfo{
				ShardIndex: i,
				TotalShards: numShards,
				ShardKey:   fmt.Sprintf("size-%d", i),
				ShardRange: &types.ShardRange{
					Start: int64(start),
					End:   int64(end),
				},
			},
		}

		shards = append(shards, shardTask)
	}

	return shards, nil
}

func splitItemsBySize(task *types.Task, policy types.ShardPolicy, items []interface{}, shardSize int64) ([]*types.Task, error) {
	shards := make([]*types.Task, 0)
	currentShard := make([]interface{}, 0)
	currentSize := int64(0)

	for i, item := range items {
		itemBytes, err := json.Marshal(item)
		if err != nil {
			return nil, fmt.Errorf("marshal item %d: %w", i, err)
		}

		if currentSize+int64(len(itemBytes)) > shardSize && len(currentShard) > 0 {
			shardTask := createShardTask(task, policy, currentShard, len(shards), 0)
			shards = append(shards, shardTask)
			currentShard = make([]interface{}, 0)
			currentSize = 0
		}

		currentShard = append(currentShard, item)
		currentSize += int64(len(itemBytes))
	}

	if len(currentShard) > 0 {
		shardTask := createShardTask(task, policy, currentShard, len(shards), 0)
		shards = append(shards, shardTask)
	}

	totalShards := len(shards)
	for i := range shards {
		shards[i].ShardInfo.TotalShards = totalShards
	}

	return shards, nil
}

func createShardTask(task *types.Task, policy types.ShardPolicy, items []interface{}, idx int, total int) *types.Task {
	shardInput := make(map[string]interface{})
	for k, v := range task.Input {
		shardInput[k] = v
	}
	shardInput[policy.DataField] = items

	return &types.Task{
		ID:         types.NewTaskID(),
		FunctionID: task.FunctionID,
		Input:      shardInput,
		Submitter:  task.Submitter,
		CreatedAt:  task.CreatedAt,
		Priority:   task.Priority,
		MaxRetries: task.MaxRetries,
		IsSubTask:  true,
		ParentID:   task.ID,
		ShardInfo: &types.ShardInfo{
			ShardIndex: idx,
			TotalShards: total,
			ShardKey:   fmt.Sprintf("items-%d", idx),
		},
	}
}

type KeySplitter struct{}

func NewKeySplitter() *KeySplitter {
	return &KeySplitter{}
}

func (s *KeySplitter) Name() string {
	return "key_splitter"
}

func (s *KeySplitter) Split(task *types.Task, policy types.ShardPolicy) ([]*types.Task, error) {
	data, ok := task.Input[policy.DataField]
	if !ok {
		return nil, fmt.Errorf("data field %s not found in input", policy.DataField)
	}

	dataMap, ok := data.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("data field %s is not a map", policy.DataField)
	}

	if len(dataMap) == 0 {
		return nil, fmt.Errorf("no data to split")
	}

	groups := make(map[string][]interface{})
	for key, value := range dataMap {
		groups[key] = append(groups[key], value)
	}

	numShards := len(groups)
	if policy.MaxShards > 0 && numShards > policy.MaxShards {
		numShards = policy.MaxShards
	}

	shards := make([]*types.Task, 0, numShards)
	idx := 0

	for key, items := range groups {
		shardInput := make(map[string]interface{})
		for k, v := range task.Input {
			shardInput[k] = v
		}
		shardInput[policy.DataField] = items

		shardTask := &types.Task{
			ID:         types.NewTaskID(),
			FunctionID: task.FunctionID,
			Input:      shardInput,
			Submitter:  task.Submitter,
			CreatedAt:  task.CreatedAt,
			Priority:   task.Priority,
			MaxRetries: task.MaxRetries,
			IsSubTask:  true,
			ParentID:   task.ID,
			ShardInfo: &types.ShardInfo{
				ShardIndex: idx,
				TotalShards: len(groups),
				ShardKey:   key,
			},
		}

		shards = append(shards, shardTask)
		idx++
		if idx >= numShards {
			break
		}
	}

	return shards, nil
}

func GetSplitter(strategy types.ShardStrategy) types.ShardSplitter {
	switch strategy {
	case types.ShardStrategyRange:
		return NewRangeSplitter()
	case types.ShardStrategyHash:
		return NewHashSplitter()
	case types.ShardStrategyKey:
		return NewKeySplitter()
	case types.ShardStrategySize:
		return NewSizeSplitter()
	default:
		return NewSizeSplitter()
	}
}
