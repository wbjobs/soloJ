package sharding

import (
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/fcnet/func-compute/types"
)

type SumCombiner struct{}

func NewSumCombiner() *SumCombiner {
	return &SumCombiner{}
}

func (c *SumCombiner) Name() string {
	return "sum_combiner"
}

func (c *SumCombiner) Combine(parentTaskID types.TaskID, results []*types.TaskResult) (*types.TaskResult, error) {
	if len(results) == 0 {
		return nil, fmt.Errorf("no results to combine")
	}

	var totalSum float64
	var totalCount int64
	startedAt := time.Now()
	var firstFinishedAt time.Time

	for _, r := range results {
		if !r.Success {
			continue
		}

		if firstFinishedAt.IsZero() || r.FinishedAt.Before(firstFinishedAt) {
			firstFinishedAt = r.FinishedAt
		}

		for key, value := range r.Output {
			switch v := value.(type) {
			case float64:
				if key == "sum" || key == "total" || key == "count" {
					totalSum += v
				}
				if key == "count" {
					totalCount += int64(v)
				}
			case int:
				if key == "sum" || key == "total" || key == "count" {
					totalSum += float64(v)
				}
				if key == "count" {
					totalCount += int64(v)
				}
			case int64:
				if key == "sum" || key == "total" || key == "count" {
					totalSum += float64(v)
				}
				if key == "count" {
					totalCount += v
				}
			}
		}
	}

	if firstFinishedAt.IsZero() {
		firstFinishedAt = time.Now()
	}

	output := map[string]interface{}{
		"sum":         totalSum,
		"total":       totalSum,
		"count":       totalCount,
		"shard_count": len(results),
		"average":     0.0,
	}

	if totalCount > 0 {
		output["average"] = totalSum / float64(totalCount)
	}

	return &types.TaskResult{
		TaskID:     parentTaskID,
		FunctionID: results[0].FunctionID,
		Output:     output,
		Success:    true,
		StartedAt:  startedAt,
		FinishedAt: time.Now(),
		CacheKey:   "",
	}, nil
}

type AverageCombiner struct{}

func NewAverageCombiner() *AverageCombiner {
	return &AverageCombiner{}
}

func (c *AverageCombiner) Name() string {
	return "average_combiner"
}

func (c *AverageCombiner) Combine(parentTaskID types.TaskID, results []*types.TaskResult) (*types.TaskResult, error) {
	if len(results) == 0 {
		return nil, fmt.Errorf("no results to combine")
	}

	var totalSum float64
	var totalCount int64
	startedAt := time.Now()

	for _, r := range results {
		if !r.Success {
			continue
		}

		if sum, ok := r.Output["sum"].(float64); ok {
			totalSum += sum
		}
		if count, ok := r.Output["count"].(float64); ok {
			totalCount += int64(count)
		}
	}

	average := 0.0
	if totalCount > 0 {
		average = totalSum / float64(totalCount)
	}

	output := map[string]interface{}{
		"average":     average,
		"total_sum":   totalSum,
		"total_count": totalCount,
		"shard_count": len(results),
	}

	return &types.TaskResult{
		TaskID:     parentTaskID,
		FunctionID: results[0].FunctionID,
		Output:     output,
		Success:    true,
		StartedAt:  startedAt,
		FinishedAt: time.Now(),
	}, nil
}

type ListCombiner struct{}

func NewListCombiner() *ListCombiner {
	return &ListCombiner{}
}

func (c *ListCombiner) Name() string {
	return "list_combiner"
}

func (c *ListCombiner) Combine(parentTaskID types.TaskID, results []*types.TaskResult) (*types.TaskResult, error) {
	if len(results) == 0 {
		return nil, fmt.Errorf("no results to combine")
	}

	combinedList := make([]interface{}, 0)
	startedAt := time.Now()

	type resultWithIndex struct {
		index int
		items []interface{}
	}

	sortedResults := make([]resultWithIndex, 0, len(results))

	for i, r := range results {
		if !r.Success {
			continue
		}

		idx := i
		if r.ShardInfo != nil {
			idx = r.ShardInfo.ShardIndex
		}

		for key, value := range r.Output {
			if key == "items" || key == "results" || key == "data" || key == "output" {
				if items, ok := value.([]interface{}); ok {
					sortedResults = append(sortedResults, resultWithIndex{
						index: idx,
						items: items,
					})
				}
			}
		}
	}

	sort.Slice(sortedResults, func(i, j int) bool {
		return sortedResults[i].index < sortedResults[j].index
	})

	for _, sr := range sortedResults {
		combinedList = append(combinedList, sr.items...)
	}

	output := map[string]interface{}{
		"items":       combinedList,
		"count":       len(combinedList),
		"shard_count": len(results),
	}

	return &types.TaskResult{
		TaskID:     parentTaskID,
		FunctionID: results[0].FunctionID,
		Output:     output,
		Success:    true,
		StartedAt:  startedAt,
		FinishedAt: time.Now(),
	}, nil
}

type MapCombiner struct{}

func NewMapCombiner() *MapCombiner {
	return &MapCombiner{}
}

func (c *MapCombiner) Name() string {
	return "map_combiner"
}

func (c *MapCombiner) Combine(parentTaskID types.TaskID, results []*types.TaskResult) (*types.TaskResult, error) {
	if len(results) == 0 {
		return nil, fmt.Errorf("no results to combine")
	}

	combinedMap := make(map[string]interface{})
	startedAt := time.Now()

	for _, r := range results {
		if !r.Success {
			continue
		}

		for key, value := range r.Output {
			if key == "map" || key == "result" || key == "output" {
				if m, ok := value.(map[string]interface{}); ok {
					for k, v := range m {
						if existing, ok := combinedMap[k]; ok {
							combinedMap[k] = combineValues(existing, v)
						} else {
							combinedMap[k] = v
						}
					}
				}
			}
		}
	}

	output := map[string]interface{}{
		"map":         combinedMap,
		"count":       len(combinedMap),
		"shard_count": len(results),
	}

	return &types.TaskResult{
		TaskID:     parentTaskID,
		FunctionID: results[0].FunctionID,
		Output:     output,
		Success:    true,
		StartedAt:  startedAt,
		FinishedAt: time.Now(),
	}, nil
}

func combineValues(a, b interface{}) interface{} {
	switch va := a.(type) {
	case float64:
		if vb, ok := b.(float64); ok {
			return va + vb
		}
	case int:
		if vb, ok := b.(int); ok {
			return va + vb
		}
	case int64:
		if vb, ok := b.(int64); ok {
			return va + vb
		}
	case []interface{}:
		if vb, ok := b.([]interface{}); ok {
			return append(va, vb...)
		}
	case map[string]interface{}:
		if vb, ok := b.(map[string]interface{}); ok {
			result := make(map[string]interface{})
			for k, v := range va {
				result[k] = v
			}
			for k, v := range vb {
				if ev, ok := result[k]; ok {
					result[k] = combineValues(ev, v)
				} else {
					result[k] = v
				}
			}
			return result
		}
	}
	return b
}

type PassthroughCombiner struct{}

func NewPassthroughCombiner() *PassthroughCombiner {
	return &PassthroughCombiner{}
}

func (c *PassthroughCombiner) Name() string {
	return "passthrough_combiner"
}

func (c *PassthroughCombiner) Combine(parentTaskID types.TaskID, results []*types.TaskResult) (*types.TaskResult, error) {
	if len(results) == 0 {
		return nil, fmt.Errorf("no results to combine")
	}

	shardResults := make([]map[string]interface{}, 0)
	var firstSuccess *types.TaskResult
	startedAt := time.Now()

	for _, r := range results {
		shardResult := map[string]interface{}{
			"shard_index": -1,
			"success":     r.Success,
			"output":      r.Output,
			"executor":    r.Executor.String(),
			"duration_ms": r.FinishedAt.Sub(r.StartedAt).Milliseconds(),
		}

		if r.ShardInfo != nil {
			shardResult["shard_index"] = r.ShardInfo.ShardIndex
			shardResult["shard_key"] = r.ShardInfo.ShardKey
		}

		if r.Error != "" {
			shardResult["error"] = r.Error
		}

		shardResults = append(shardResults, shardResult)

		if r.Success && firstSuccess == nil {
			firstSuccess = r
		}
	}

	successCount := 0
	for _, r := range results {
		if r.Success {
			successCount++
		}
	}

	allSuccess := successCount == len(results)

	output := map[string]interface{}{
		"shard_results":  shardResults,
		"total_shards":   len(results),
		"success_count":  successCount,
		"failed_count":   len(results) - successCount,
		"all_success":    allSuccess,
	}

	functionID := types.FunctionID("")
	if firstSuccess != nil {
		functionID = firstSuccess.FunctionID
	} else if len(results) > 0 {
		functionID = results[0].FunctionID
	}

	return &types.TaskResult{
		TaskID:     parentTaskID,
		FunctionID: functionID,
		Output:     output,
		Success:    allSuccess,
		StartedAt:  startedAt,
		FinishedAt: time.Now(),
	}, nil
}

type GroupByCombiner struct{}

func NewGroupByCombiner() *GroupByCombiner {
	return &GroupByCombiner{}
}

func (c *GroupByCombiner) Name() string {
	return "group_by_combiner"
}

func (c *GroupByCombiner) Combine(parentTaskID types.TaskID, results []*types.TaskResult) (*types.TaskResult, error) {
	if len(results) == 0 {
		return nil, fmt.Errorf("no results to combine")
	}

	groups := make(map[string][]interface{})
	startedAt := time.Now()

	for _, r := range results {
		if !r.Success {
			continue
		}

		if groupsData, ok := r.Output["groups"].(map[string]interface{}); ok {
			for key, value := range groupsData {
				if items, ok := value.([]interface{}); ok {
					groups[key] = append(groups[key], items...)
				}
			}
		}

		if groupsData, ok := r.Output["grouped"].(map[string]interface{}); ok {
			for key, value := range groupsData {
				if items, ok := value.([]interface{}); ok {
					groups[key] = append(groups[key], items...)
				}
			}
		}
	}

	output := map[string]interface{}{
		"groups":      groups,
		"group_count": len(groups),
		"shard_count": len(results),
	}

	return &types.TaskResult{
		TaskID:     parentTaskID,
		FunctionID: results[0].FunctionID,
		Output:     output,
		Success:    true,
		StartedAt:  startedAt,
		FinishedAt: time.Now(),
	}, nil
}

type CombinerType string

const (
	CombinerSum        CombinerType = "sum"
	CombinerAverage    CombinerType = "average"
	CombinerList       CombinerType = "list"
	CombinerMap        CombinerType = "map"
	CombinerGroupBy    CombinerType = "groupby"
	CombinerPassthrough CombinerType = "passthrough"
)

func GetCombiner(combinerType CombinerType) types.ResultCombiner {
	switch combinerType {
	case CombinerSum:
		return NewSumCombiner()
	case CombinerAverage:
		return NewAverageCombiner()
	case CombinerList:
		return NewListCombiner()
	case CombinerMap:
		return NewMapCombiner()
	case CombinerGroupBy:
		return NewGroupByCombiner()
	case CombinerPassthrough:
		return NewPassthroughCombiner()
	default:
		return NewPassthroughCombiner()
	}
}

func CalculateInputSize(input map[string]interface{}) int64 {
	data, err := json.Marshal(input)
	if err != nil {
		return 0
	}
	return int64(len(data))
}
