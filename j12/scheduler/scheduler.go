package scheduler

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/fcnet/func-compute/config"
	"github.com/fcnet/func-compute/p2p"
	"github.com/fcnet/func-compute/plugin"
	"github.com/fcnet/func-compute/sharding"
	"github.com/fcnet/func-compute/types"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/serialx/hashring"
	"go.uber.org/zap"
)

type Scheduler struct {
	cfg           *config.SchedulerConfig
	logger        *zap.Logger
	nodeHost      *p2p.NodeHost
	pluginManager *plugin.Manager
	nodeID        peer.ID

	taskQueue     chan *types.Task
	taskStatus    map[types.TaskID]types.TaskStatus
	taskStatusMtx sync.RWMutex

	taskResults    map[types.TaskID]*types.TaskResult
	taskResultsMtx sync.RWMutex

	taskToCacheKey    map[types.TaskID]string
	taskToCacheKeyMtx sync.RWMutex

	resultCache     map[string]*types.TaskResult
	resultCacheMtx  sync.RWMutex
	resultCacheTime map[string]time.Time

	hashRing     *hashring.HashRing
	hashRingMtx  sync.RWMutex

	shardTasks        map[types.TaskID]*shardTaskState
	shardTasksMtx     sync.RWMutex

	shardProgress     map[types.TaskID]*types.ShardedTaskProgress
	shardProgressMtx  sync.RWMutex

	shardPolicies     map[types.FunctionID]*types.ShardPolicy
	shardPoliciesMtx  sync.RWMutex

	combiners         map[types.FunctionID]sharding.CombinerType
	combinersMtx      sync.RWMutex

	onTaskResult func(*types.TaskResult)

	ctx    context.Context
	cancel context.CancelFunc
}

type shardTaskState struct {
	parentTaskID types.TaskID
	totalShards  int
	results      map[int]*types.TaskResult
	completed    int
	failed       int
	mu           sync.Mutex
}

func NewScheduler(
	cfg *config.SchedulerConfig,
	logger *zap.Logger,
	nodeHost *p2p.NodeHost,
	pluginManager *plugin.Manager,
	nodeID peer.ID,
) *Scheduler {
	ctx, cancel := context.WithCancel(context.Background())

	s := &Scheduler{
		cfg:             cfg,
		logger:          logger,
		nodeHost:        nodeHost,
		pluginManager:   pluginManager,
		nodeID:          nodeID,
		taskQueue:       make(chan *types.Task, cfg.QueueSize),
		taskStatus:      make(map[types.TaskID]types.TaskStatus),
		taskResults:     make(map[types.TaskID]*types.TaskResult),
		taskToCacheKey:  make(map[types.TaskID]string),
		resultCache:     make(map[string]*types.TaskResult),
		resultCacheTime: make(map[string]time.Time),
		hashRing:        hashring.New([]string{}),
		shardTasks:      make(map[types.TaskID]*shardTaskState),
		shardProgress:   make(map[types.TaskID]*types.ShardedTaskProgress),
		shardPolicies:   make(map[types.FunctionID]*types.ShardPolicy),
		combiners:       make(map[types.FunctionID]sharding.CombinerType),
		ctx:             ctx,
		cancel:          cancel,
	}

	nodeHost.SetTaskHandler(s.handleIncomingTask)
	nodeHost.SetResultHandler(s.handleIncomingResult)
	nodeHost.SetOnHeartbeatHandler(s.handleNodeHeartbeat)
	nodeHost.SetOnNodeLeaveHandler(s.handleNodeLeave)
	nodeHost.SetStatusHandler(s.handleIncomingStatus)
	nodeHost.SetStatusQueryHandler(s.handleStatusQuery)

	return s
}

func (s *Scheduler) RegisterShardPolicy(functionID types.FunctionID, policy types.ShardPolicy) {
	s.shardPoliciesMtx.Lock()
	defer s.shardPoliciesMtx.Unlock()
	s.shardPolicies[functionID] = &policy
}

func (s *Scheduler) RegisterCombiner(functionID types.FunctionID, combiner sharding.CombinerType) {
	s.combinersMtx.Lock()
	defer s.combinersMtx.Unlock()
	s.combiners[functionID] = combiner
}

func (s *Scheduler) getShardPolicy(functionID types.FunctionID) *types.ShardPolicy {
	s.shardPoliciesMtx.RLock()
	defer s.shardPoliciesMtx.RUnlock()
	if policy, ok := s.shardPolicies[functionID]; ok {
		return policy
	}

	return &types.ShardPolicy{
		Strategy:       types.ShardStrategySize,
		ThresholdBytes: 1024 * 1024,
		MaxShards:      16,
		ShardSizeBytes: 256 * 1024,
		DataField:      "data",
	}
}

func (s *Scheduler) getCombiner(functionID types.FunctionID) sharding.CombinerType {
	s.combinersMtx.RLock()
	defer s.combinersMtx.RUnlock()
	if combiner, ok := s.combiners[functionID]; ok {
		return combiner
	}
	return sharding.CombinerPassthrough
}

func (s *Scheduler) Start() {
	for i := 0; i < s.cfg.WorkerCount; i++ {
		go s.worker(i)
	}

	go s.cacheCleaner()
}

func (s *Scheduler) Stop() {
	s.cancel()
	close(s.taskQueue)
}

func (s *Scheduler) worker(id int) {
	s.logger.Debug("worker started", zap.Int("id", id))

	for {
		select {
		case <-s.ctx.Done():
			s.logger.Debug("worker stopped", zap.Int("id", id))
			return
		case task := <-s.taskQueue:
			s.executeTask(task)
		}
	}
}

func (s *Scheduler) SubmitTask(task *types.Task) error {
	task.ID = types.NewTaskID()
	task.CreatedAt = time.Now()
	if task.MaxRetries == 0 {
		task.MaxRetries = s.cfg.MaxRetries
	}

	if s.cfg.EnableDedup {
		cacheKey := s.generateCacheKey(task)
		if cached := s.getCachedResult(cacheKey); cached != nil {
			s.logger.Debug("result found in cache", zap.String("task_id", string(task.ID)))
			cached.TaskID = task.ID
			if s.onTaskResult != nil {
				s.onTaskResult(cached)
			}
			return nil
		}
	}

	providers := s.nodeHost.GetFunctionProviders(task.FunctionID)
	if len(providers) == 0 {
		return fmt.Errorf("no providers available for function: %s", task.FunctionID)
	}

	policy := s.getShardPolicy(task.FunctionID)
	inputSize := sharding.CalculateInputSize(task.Input)

	if !task.IsSubTask && !task.IsSharded && inputSize >= policy.ThresholdBytes {
		s.logger.Info("input size exceeds threshold, splitting task",
			zap.String("task_id", string(task.ID)),
			zap.Int64("input_size", inputSize),
			zap.Int64("threshold", policy.ThresholdBytes))
		return s.submitShardedTask(task, policy, providers)
	}

	targetNode := s.selectNode(task, providers)
	if targetNode == s.nodeID {
		s.taskStatusMtx.Lock()
		s.taskStatus[task.ID] = types.TaskStatusPending
		s.taskStatusMtx.Unlock()
		s.taskQueue <- task
	} else {
		s.taskStatusMtx.Lock()
		s.taskStatus[task.ID] = types.TaskStatusPending
		s.taskStatusMtx.Unlock()

		ctx, cancel := context.WithTimeout(s.ctx, 10*time.Second)
		defer cancel()
		if err := s.nodeHost.SendTask(ctx, targetNode, task); err != nil {
			s.logger.Warn("failed to forward task", zap.Error(err))
			return s.retryTask(task)
		}
	}

	return nil
}

func (s *Scheduler) submitShardedTask(task *types.Task, policy *types.ShardPolicy, providers []peer.ID) error {
	splitter := sharding.GetSplitter(policy.Strategy)
	subTasks, err := splitter.Split(task, *policy)
	if err != nil {
		s.logger.Warn("failed to split task, falling back to normal execution", zap.Error(err))
		return s.submitNormalTask(task, providers)
	}

	if len(subTasks) <= 1 {
		s.logger.Info("only one shard generated, executing as normal task")
		return s.submitNormalTask(task, providers)
	}

	task.IsSharded = true

	s.shardTasksMtx.Lock()
	s.shardTasks[task.ID] = &shardTaskState{
		parentTaskID: task.ID,
		totalShards:  len(subTasks),
		results:      make(map[int]*types.TaskResult),
	}
	s.shardTasksMtx.Unlock()

	s.initShardProgress(task.ID, len(subTasks), subTasks)

	s.taskStatusMtx.Lock()
	s.taskStatus[task.ID] = types.TaskStatusRunning
	s.taskStatusMtx.Unlock()

	s.logger.Info("submitting sharded task",
		zap.String("task_id", string(task.ID)),
		zap.Int("num_shards", len(subTasks)))

	for _, subTask := range subTasks {
		subTask.ParentID = task.ID

		s.updateSubTaskProgress(task.ID, subTask.ID, subTask.ShardInfo.ShardIndex, types.TaskStatusPending, nil)

		go func(st *types.Task) {
			if err := s.submitSubTask(st, providers); err != nil {
				s.logger.Warn("failed to submit sub task",
					zap.String("sub_task_id", string(st.ID)),
					zap.String("parent_id", string(task.ID)),
					zap.Error(err))
				s.handleSubTaskFailure(task.ID, st, err)
			}
		}(subTask)
	}

	return nil
}

func (s *Scheduler) submitNormalTask(task *types.Task, providers []peer.ID) error {
	targetNode := s.selectNode(task, providers)
	if targetNode == s.nodeID {
		s.taskStatusMtx.Lock()
		s.taskStatus[task.ID] = types.TaskStatusPending
		s.taskStatusMtx.Unlock()
		s.taskQueue <- task
	} else {
		s.taskStatusMtx.Lock()
		s.taskStatus[task.ID] = types.TaskStatusPending
		s.taskStatusMtx.Unlock()

		ctx, cancel := context.WithTimeout(s.ctx, 10*time.Second)
		defer cancel()
		if err := s.nodeHost.SendTask(ctx, targetNode, task); err != nil {
			s.logger.Warn("failed to forward task", zap.Error(err))
			return s.retryTask(task)
		}
	}
	return nil
}

func (s *Scheduler) submitSubTask(task *types.Task, providers []peer.ID) error {
	targetNode := s.selectNode(task, providers)
	if targetNode == s.nodeID {
		s.taskStatusMtx.Lock()
		s.taskStatus[task.ID] = types.TaskStatusPending
		s.taskStatusMtx.Unlock()
		select {
		case s.taskQueue <- task:
			return nil
		default:
			return fmt.Errorf("task queue full")
		}
	} else {
		s.taskStatusMtx.Lock()
		s.taskStatus[task.ID] = types.TaskStatusPending
		s.taskStatusMtx.Unlock()

		ctx, cancel := context.WithTimeout(s.ctx, 10*time.Second)
		defer cancel()
		return s.nodeHost.SendTask(ctx, targetNode, task)
	}
}

func (s *Scheduler) handleIncomingTask(from peer.ID, task *types.Task) {
	s.logger.Debug("received task", zap.String("from", from.String()), zap.String("task_id", string(task.ID)))

	if _, ok := s.pluginManager.GetFunction(task.FunctionID); !ok {
		s.logger.Warn("function not available locally", zap.String("function", string(task.FunctionID)))
		return
	}

	s.taskStatusMtx.Lock()
	s.taskStatus[task.ID] = types.TaskStatusPending
	s.taskStatusMtx.Unlock()

	select {
	case s.taskQueue <- task:
	default:
		s.logger.Warn("task queue full, dropping task")
	}
}

func (s *Scheduler) handleIncomingResult(from peer.ID, result *types.TaskResult) {
	s.logger.Debug("received result",
		zap.String("from", from.String()),
		zap.String("task_id", string(result.TaskID)),
		zap.String("parent_id", string(result.ParentID)))

	s.taskStatusMtx.Lock()
	if result.Success {
		s.taskStatus[result.TaskID] = types.TaskStatusCompleted
		s.cacheResult(result)
	} else {
		s.taskStatus[result.TaskID] = types.TaskStatusFailed
	}
	s.taskStatusMtx.Unlock()

	s.taskResultsMtx.Lock()
	s.taskResults[result.TaskID] = result
	s.taskResultsMtx.Unlock()

	if result.CacheKey != "" {
		s.taskToCacheKeyMtx.Lock()
		s.taskToCacheKey[result.TaskID] = result.CacheKey
		s.taskToCacheKeyMtx.Unlock()
	}

	if result.IsSubTaskResult && result.ParentID != "" {
		s.handleSubTaskResult(result)
	}

	if s.onTaskResult != nil && !result.IsSubTaskResult {
		s.onTaskResult(result)
	}
}

func (s *Scheduler) handleSubTaskResult(result *types.TaskResult) {
	parentID := result.ParentID

	s.shardTasksMtx.RLock()
	state, exists := s.shardTasks[parentID]
	s.shardTasksMtx.RUnlock()

	if !exists {
		s.logger.Warn("received result for unknown parent task",
			zap.String("sub_task_id", string(result.TaskID)),
			zap.String("parent_id", string(parentID)))
		return
	}

	var shardIndex int
	if result.ShardInfo != nil {
		shardIndex = result.ShardInfo.ShardIndex
	}

	s.updateSubTaskProgress(parentID, result.TaskID, shardIndex, s.getTaskStatusFromResult(result), result)

	state.mu.Lock()
	defer state.mu.Unlock()

	if result.Success {
		state.completed++
		state.results[shardIndex] = result
	} else {
		state.failed++
	}

	s.logger.Debug("shard progress",
		zap.String("parent_id", string(parentID)),
		zap.Int("shard_index", shardIndex),
		zap.Int("completed", state.completed),
		zap.Int("failed", state.failed),
		zap.Int("total", state.totalShards))

	if state.completed+state.failed >= state.totalShards {
		s.finishShardedTask(parentID, state)
	}
}

func (s *Scheduler) handleSubTaskFailure(parentID types.TaskID, subTask *types.Task, err error) {
	s.shardTasksMtx.RLock()
	state, exists := s.shardTasks[parentID]
	s.shardTasksMtx.RUnlock()

	if !exists {
		return
	}

	shardIndex := -1
	if subTask.ShardInfo != nil {
		shardIndex = subTask.ShardInfo.ShardIndex
	}

	state.mu.Lock()
	state.failed++
	state.mu.Unlock()

	failedResult := &types.TaskResult{
		TaskID:         subTask.ID,
		FunctionID:     subTask.FunctionID,
		IsSubTaskResult: true,
		ParentID:       parentID,
		ShardInfo:      subTask.ShardInfo,
		Error:          err.Error(),
		Success:        false,
	}

	s.updateSubTaskProgress(parentID, subTask.ID, shardIndex, types.TaskStatusFailed, failedResult)

	state.mu.Lock()
	defer state.mu.Unlock()

	if state.completed+state.failed >= state.totalShards {
		s.finishShardedTask(parentID, state)
	}
}

func (s *Scheduler) finishShardedTask(parentID types.TaskID, state *shardTaskState) {
	s.logger.Info("all shards completed, combining results",
		zap.String("parent_id", string(parentID)),
		zap.Int("completed", state.completed),
		zap.Int("failed", state.failed))

	results := make([]*types.TaskResult, 0, len(state.results))
	for _, r := range state.results {
		results = append(results, r)
	}

	combinerType := s.getCombiner(results[0].FunctionID)
	combiner := sharding.GetCombiner(combinerType)

	combinedResult, err := combiner.Combine(parentID, results)
	if err != nil {
		s.logger.Error("failed to combine results", zap.Error(err))
		combinedResult = &types.TaskResult{
			TaskID:     parentID,
			FunctionID: results[0].FunctionID,
			Output: map[string]interface{}{
				"error": "failed to combine results: " + err.Error(),
				"shard_results": results,
			},
			Success: false,
			Error:   err.Error(),
		}
	}

	combinedResult.StartedAt = results[0].StartedAt
	combinedResult.FinishedAt = time.Now()

	s.taskStatusMtx.Lock()
	if combinedResult.Success {
		s.taskStatus[parentID] = types.TaskStatusCompleted
	} else {
		s.taskStatus[parentID] = types.TaskStatusFailed
	}
	s.taskStatusMtx.Unlock()

	s.taskResultsMtx.Lock()
	s.taskResults[parentID] = combinedResult
	s.taskResultsMtx.Unlock()

	s.shardTasksMtx.Lock()
	delete(s.shardTasks, parentID)
	s.shardTasksMtx.Unlock()

	s.broadcastTaskStatus(parentID, s.getTaskStatusFromResult(combinedResult), combinedResult)

	if s.onTaskResult != nil {
		s.onTaskResult(combinedResult)
	}

	s.logger.Info("sharded task completed",
		zap.String("parent_id", string(parentID)),
		zap.Bool("success", combinedResult.Success))
}

func (s *Scheduler) executeTask(task *types.Task) {
	if task.IsSubTask && task.ParentID != "" {
		s.updateSubTaskProgress(task.ParentID, task.ID, task.ShardInfo.ShardIndex, types.TaskStatusRunning, nil)
	}

	s.taskStatusMtx.Lock()
	s.taskStatus[task.ID] = types.TaskStatusRunning
	s.taskStatusMtx.Unlock()

	spec, ok := s.pluginManager.GetSpec(task.FunctionID)
	if !ok {
		s.logger.Error("function spec not found", zap.String("function", string(task.FunctionID)))
		s.failTask(task, fmt.Errorf("function not found"))
		return
	}

	execCtx, cancel := context.WithTimeout(s.ctx, spec.Timeout)
	defer cancel()

	result := &types.TaskResult{
		TaskID:         task.ID,
		FunctionID:     task.FunctionID,
		Executor:       s.nodeID,
		StartedAt:      time.Now(),
		CacheKey:       s.generateCacheKey(task),
		IsSubTaskResult: task.IsSubTask,
		ParentID:       task.ParentID,
		ShardInfo:      task.ShardInfo,
	}

	done := make(chan error)
	go func() {
		output, err := s.pluginManager.Execute(task.FunctionID, task.Input)
		if err != nil {
			done <- err
			return
		}
		result.Output = output
		done <- nil
	}()

	select {
	case err := <-done:
		result.FinishedAt = time.Now()
		if err != nil {
			result.Success = false
			result.Error = err.Error()
			s.logger.Warn("task execution failed", zap.String("task_id", string(task.ID)), zap.Error(err))
			s.retryTask(task)
		} else {
			result.Success = true
			s.cacheResult(result)
		}
	case <-execCtx.Done():
		result.FinishedAt = time.Now()
		result.Success = false
		result.Error = "execution timeout"
		s.logger.Warn("task execution timeout", zap.String("task_id", string(task.ID)))
		s.retryTask(task)
	}

	s.taskStatusMtx.Lock()
	if result.Success {
		s.taskStatus[task.ID] = types.TaskStatusCompleted
	} else {
		s.taskStatus[task.ID] = types.TaskStatusFailed
	}
	s.taskStatusMtx.Unlock()

	s.taskResultsMtx.Lock()
	s.taskResults[task.ID] = result
	s.taskResultsMtx.Unlock()

	s.taskToCacheKeyMtx.Lock()
	s.taskToCacheKey[task.ID] = result.CacheKey
	s.taskToCacheKeyMtx.Unlock()

	if task.Submitter != "" && task.Submitter != s.nodeID {
		ctx, cancel := context.WithTimeout(s.ctx, 10*time.Second)
		defer cancel()
		if err := s.nodeHost.SendResult(ctx, task.Submitter, result); err != nil {
			s.logger.Warn("failed to send result back", zap.Error(err))
		}
	}

	s.broadcastTaskStatus(task.ID, s.getTaskStatusFromResult(result), result)

	if task.IsSubTask {
		s.handleSubTaskResult(result)
	} else if s.onTaskResult != nil {
		s.onTaskResult(result)
	}
}

func (s *Scheduler) failTask(task *types.Task, err error) {
	result := &types.TaskResult{
		TaskID:     task.ID,
		FunctionID: task.FunctionID,
		Executor:   s.nodeID,
		StartedAt:  time.Now(),
		FinishedAt: time.Now(),
		Success:    false,
		Error:      err.Error(),
	}

	s.taskStatusMtx.Lock()
	s.taskStatus[task.ID] = types.TaskStatusFailed
	s.taskStatusMtx.Unlock()

	if s.onTaskResult != nil {
		s.onTaskResult(result)
	}
}

func (s *Scheduler) retryTask(task *types.Task) error {
	if task.RetryCount >= task.MaxRetries {
		s.logger.Warn("max retries reached", zap.String("task_id", string(task.ID)))
		s.failTask(task, fmt.Errorf("max retries reached"))
		return fmt.Errorf("max retries reached")
	}

	task.RetryCount++
	s.logger.Info("retrying task", zap.String("task_id", string(task.ID)), zap.Int("retry", task.RetryCount))

	time.Sleep(s.cfg.RetryInterval)

	providers := s.nodeHost.GetFunctionProviders(task.FunctionID)
	if len(providers) == 0 {
		s.failTask(task, fmt.Errorf("no providers available"))
		return fmt.Errorf("no providers available")
	}

	targetNode := s.selectNode(task, providers)
	if targetNode == s.nodeID {
		select {
		case s.taskQueue <- task:
			return nil
		default:
			return fmt.Errorf("queue full")
		}
	}

	ctx, cancel := context.WithTimeout(s.ctx, 10*time.Second)
	defer cancel()
	return s.nodeHost.SendTask(ctx, targetNode, task)
}

func (s *Scheduler) selectNode(task *types.Task, providers []peer.ID) peer.ID {
	if len(providers) == 0 {
		return ""
	}

	s.hashRingMtx.RLock()
	defer s.hashRingMtx.RUnlock()

	node, ok := s.hashRing.GetNode(string(task.ID))
	if ok {
		nodeID := peer.ID(node)
		for _, p := range providers {
			if p == nodeID {
				return p
			}
		}
	}

	for _, p := range providers {
		if info, ok := s.nodeHost.GetNodeInfo(p); ok {
			if info.Status == types.NodeStatusOnline && info.Load < 0.8 {
				return p
			}
		}
	}

	return providers[0]
}

func (s *Scheduler) generateCacheKey(task *types.Task) string {
	h := sha256.New()
	h.Write([]byte(string(task.FunctionID)))
	inputBytes, _ := json.Marshal(task.Input)
	h.Write(inputBytes)
	return hex.EncodeToString(h.Sum(nil))
}

func (s *Scheduler) cacheResult(result *types.TaskResult) {
	if !s.cfg.EnableDedup {
		return
	}

	s.resultCacheMtx.Lock()
	defer s.resultCacheMtx.Unlock()

	s.resultCache[result.CacheKey] = result
	s.resultCacheTime[result.CacheKey] = time.Now()
}

func (s *Scheduler) getCachedResult(cacheKey string) *types.TaskResult {
	if !s.cfg.EnableDedup {
		return nil
	}

	s.resultCacheMtx.RLock()
	defer s.resultCacheMtx.RUnlock()

	result, ok := s.resultCache[cacheKey]
	if !ok {
		return nil
	}

	if time.Since(s.resultCacheTime[cacheKey]) > s.cfg.ResultTTL {
		return nil
	}

	return result
}

func (s *Scheduler) cacheCleaner() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.cleanExpiredCache()
		}
	}
}

func (s *Scheduler) cleanExpiredCache() {
	s.resultCacheMtx.Lock()
	defer s.resultCacheMtx.Unlock()

	now := time.Now()
	for key, t := range s.resultCacheTime {
		if now.Sub(t) > s.cfg.ResultTTL {
			delete(s.resultCache, key)
			delete(s.resultCacheTime, key)
		}
	}
}

func (s *Scheduler) handleNodeHeartbeat(peerID peer.ID, info *types.NodeInfo) {
	s.hashRingMtx.Lock()
	defer s.hashRingMtx.Unlock()

	s.hashRing = s.hashRing.AddNode(string(peerID))
}

func (s *Scheduler) handleNodeLeave(peerID peer.ID) {
	s.hashRingMtx.Lock()
	defer s.hashRingMtx.Unlock()

	s.hashRing = s.hashRing.RemoveNode(string(peerID))
}

func (s *Scheduler) handleIncomingStatus(from peer.ID, payload *p2p.TaskStatusPayload) {
	s.logger.Debug("received task status update",
		zap.String("from", from.String()),
		zap.String("task_id", string(payload.TaskID)),
		zap.String("status", string(payload.Status)))

	s.taskStatusMtx.Lock()
	s.taskStatus[payload.TaskID] = payload.Status
	s.taskStatusMtx.Unlock()

	if payload.Result != nil {
		s.taskResultsMtx.Lock()
		s.taskResults[payload.TaskID] = payload.Result
		s.taskResultsMtx.Unlock()

		if payload.Result.CacheKey != "" {
			s.taskToCacheKeyMtx.Lock()
			s.taskToCacheKey[payload.TaskID] = payload.Result.CacheKey
			s.taskToCacheKeyMtx.Unlock()

			s.cacheResult(payload.Result)
		}
	}
}

func (s *Scheduler) handleStatusQuery(taskID types.TaskID) (types.TaskStatus, *types.TaskResult, bool) {
	s.taskStatusMtx.RLock()
	status, statusOk := s.taskStatus[taskID]
	s.taskStatusMtx.RUnlock()

	if !statusOk {
		return "", nil, false
	}

	s.taskResultsMtx.RLock()
	result, resultOk := s.taskResults[taskID]
	s.taskResultsMtx.RUnlock()

	return status, result, true
}

func (s *Scheduler) SetTaskResultHandler(handler func(*types.TaskResult)) {
	s.onTaskResult = handler
}

func (s *Scheduler) GetTaskStatus(taskID types.TaskID) (types.TaskStatus, *types.TaskResult, bool) {
	s.taskStatusMtx.RLock()
	status, statusOk := s.taskStatus[taskID]
	s.taskStatusMtx.RUnlock()

	if !statusOk {
		return "", nil, false
	}

	if status == types.TaskStatusCompleted || status == types.TaskStatusFailed {
		s.taskResultsMtx.RLock()
		result, resultOk := s.taskResults[taskID]
		s.taskResultsMtx.RUnlock()

		if resultOk {
			return status, result, true
		}
	}

	if s.cfg.EnableDedup {
		s.taskToCacheKeyMtx.RLock()
		cacheKey, cacheOk := s.taskToCacheKey[taskID]
		s.taskToCacheKeyMtx.RUnlock()

		if cacheOk {
			if cached := s.getCachedResult(cacheKey); cached != nil {
				return types.TaskStatusCompleted, cached, true
			}
		}
	}

	return status, nil, true
}

func (s *Scheduler) broadcastTaskStatus(taskID types.TaskID, status types.TaskStatus, result *types.TaskResult) {
	s.logger.Debug("broadcasting task status",
		zap.String("task_id", string(taskID)),
		zap.String("status", string(status)))

	s.nodeHost.BroadcastTaskStatus(taskID, status, result)
}

func (s *Scheduler) getTaskStatusFromResult(result *types.TaskResult) types.TaskStatus {
	if result.Success {
		return types.TaskStatusCompleted
	}
	return types.TaskStatusFailed
}

func (s *Scheduler) initShardProgress(parentID types.TaskID, totalShards int, subTasks []*types.Task) {
	s.shardProgressMtx.Lock()
	defer s.shardProgressMtx.Unlock()

	progress := &types.ShardedTaskProgress{
		ParentTaskID:  parentID,
		TotalShards:   totalShards,
		Completed:     0,
		Failed:        0,
		InProgress:    0,
		Pending:       totalShards,
		Progress:      0.0,
		SubTasks:      make(map[types.TaskID]*types.SubTaskInfo),
		StartedAt:     time.Now(),
		LastUpdatedAt: time.Now(),
	}

	for _, st := range subTasks {
		shardIndex := 0
		if st.ShardInfo != nil {
			shardIndex = st.ShardInfo.ShardIndex
		}
		progress.SubTasks[st.ID] = &types.SubTaskInfo{
			TaskID:     st.ID,
			ShardIndex: shardIndex,
			Status:     types.TaskStatusPending,
		}
	}

	s.shardProgress[parentID] = progress
}

func (s *Scheduler) updateSubTaskProgress(parentID types.TaskID, subTaskID types.TaskID, shardIndex int, status types.TaskStatus, result *types.TaskResult) {
	s.shardProgressMtx.Lock()
	defer s.shardProgressMtx.Unlock()

	progress, exists := s.shardProgress[parentID]
	if !exists {
		progress = &types.ShardedTaskProgress{
			ParentTaskID: parentID,
			SubTasks:     make(map[types.TaskID]*types.SubTaskInfo),
		}
		s.shardProgress[parentID] = progress
	}

	info, exists := progress.SubTasks[subTaskID]
	if !exists {
		info = &types.SubTaskInfo{
			TaskID:     subTaskID,
			ShardIndex: shardIndex,
		}
		progress.SubTasks[subTaskID] = info
	}

	if info.Status == types.TaskStatusPending {
		progress.Pending--
	} else if info.Status == types.TaskStatusRunning {
		progress.InProgress--
	} else if info.Status == types.TaskStatusCompleted {
		progress.Completed--
	} else if info.Status == types.TaskStatusFailed {
		progress.Failed--
	}

	info.Status = status
	now := time.Now()
	if status == types.TaskStatusRunning {
		info.StartedAt = &now
		progress.InProgress++
	} else if status == types.TaskStatusCompleted {
		info.FinishedAt = &now
		progress.Completed++
	} else if status == types.TaskStatusFailed {
		info.FinishedAt = &now
		progress.Failed++
	} else if status == types.TaskStatusPending {
		progress.Pending++
	}

	if result != nil {
		info.Result = result
		info.Error = result.Error
		info.Executor = result.Executor
	}

	total := progress.Completed + progress.Failed
	progress.Progress = float64(total) / float64(progress.TotalShards)
	progress.LastUpdatedAt = now
}

func (s *Scheduler) GetShardedProgress(taskID types.TaskID) (*types.ShardedTaskProgress, bool) {
	s.shardProgressMtx.RLock()
	defer s.shardProgressMtx.RUnlock()

	progress, exists := s.shardProgress[taskID]
	if !exists {
		return nil, false
	}

	result := *progress
	result.SubTasks = make(map[types.TaskID]*types.SubTaskInfo)
	for k, v := range progress.SubTasks {
		copyInfo := *v
		result.SubTasks[k] = &copyInfo
	}

	return &result, true
}

func (s *Scheduler) GetAllShardedProgress() map[types.TaskID]*types.ShardedTaskProgress {
	s.shardProgressMtx.RLock()
	defer s.shardProgressMtx.RUnlock()

	result := make(map[types.TaskID]*types.ShardedTaskProgress)
	for k, v := range s.shardProgress {
		progress := *v
		progress.SubTasks = make(map[types.TaskID]*types.SubTaskInfo)
		for sk, sv := range v.SubTasks {
			copyInfo := *sv
			progress.SubTasks[sk] = &copyInfo
		}
		result[k] = &progress
	}

	return result
}

func (s *Scheduler) CleanupProgress(taskID types.TaskID) {
	s.shardProgressMtx.Lock()
	defer s.shardProgressMtx.Unlock()

	if progress, exists := s.shardProgress[taskID]; exists {
		if progress.Completed+progress.Failed >= progress.TotalShards {
			delete(s.shardProgress, taskID)
		}
	}
}

func (s *Scheduler) GetProgress(taskID types.TaskID) (types.TaskStatus, *types.TaskResult, *types.ShardedTaskProgress, bool) {
	status, result, ok := s.GetTaskStatus(taskID)
	if !ok {
		return "", nil, nil, false
	}

	shardedProgress, shardedOk := s.GetShardedProgress(taskID)
	return status, result, shardedProgress, shardedOk
}
