package scheduler

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"modbus-fuzzer/core"
)

const (
	TaskQueueKey       = "modbus:fuzz:tasks"
	ResultQueueKey     = "modbus:fuzz:results"
	WorkerGroupKey     = "modbus:fuzz:workers"
	ProcessingQueueKey = "modbus:fuzz:processing"
	BackupFile         = "task_backup.json"
	MaxLocalQueueSize  = 10000
	ReconnectInterval  = 2 * time.Second
	HealthCheckInterval = 5 * time.Second
)

type Scheduler struct {
	redisClient   *redis.Client
	ctx           context.Context
	cancel        context.CancelFunc
	targets       []string
	interval      time.Duration
	malformedRate int

	localQueue      []*core.FuzzTask
	localQueueMutex sync.Mutex

	redisConnected bool
	connMutex      sync.RWMutex

	retryQueue      []*core.FuzzTask
	retryQueueMutex sync.Mutex

	backupDir string

	wg sync.WaitGroup
}

func NewScheduler(redisAddr string, redisDB int, targets []string, interval time.Duration, malformedRate int) *Scheduler {
	rdb := redis.NewClient(&redis.Options{
		Addr:            redisAddr,
		DB:              redisDB,
		PoolSize:        50,
		MinIdleConns:    10,
		MaxRetries:      5,
		MinRetryBackoff: 100 * time.Millisecond,
		MaxRetryBackoff: 2 * time.Second,
		DialTimeout:     5 * time.Second,
		ReadTimeout:     3 * time.Second,
		WriteTimeout:    3 * time.Second,
		PoolTimeout:     10 * time.Second,
		IdleTimeout:     5 * time.Minute,
	})

	ctx, cancel := context.WithCancel(context.Background())

	backupDir := "./data"
	os.MkdirAll(backupDir, 0755)

	return &Scheduler{
		redisClient:   rdb,
		ctx:           ctx,
		cancel:        cancel,
		targets:       targets,
		interval:      interval,
		malformedRate: malformedRate,
		backupDir:     backupDir,
		redisConnected: false,
	}
}

func (s *Scheduler) Start() error {
	log.Println("[Scheduler] Starting...")

	if err := s.connectRedis(); err != nil {
		log.Printf("[Scheduler] Warning: Failed initial Redis connection, will retry: %v", err)
	}

	if err := s.loadBackup(); err != nil {
		log.Printf("[Scheduler] Warning: Failed to load backup: %v", err)
	}

	s.wg.Add(4)
	go s.generateTasks()
	go s.processResults()
	go s.healthCheck()
	go s.flushLocalQueue()

	log.Println("[Scheduler] Started successfully")
	return nil
}

func (s *Scheduler) connectRedis() error {
	s.connMutex.Lock()
	defer s.connMutex.Unlock()

	ctx, cancel := context.WithTimeout(s.ctx, 5*time.Second)
	defer cancel()

	_, err := s.redisClient.Ping(ctx).Result()
	if err != nil {
		s.redisConnected = false
		return fmt.Errorf("redis ping failed: %v", err)
	}

	if !s.redisConnected {
		log.Println("[Scheduler] Redis connection established")
		s.redisConnected = true
		s.recoverProcessingTasks()
	}

	return nil
}

func (s *Scheduler) isRedisConnected() bool {
	s.connMutex.RLock()
	defer s.connMutex.RUnlock()
	return s.redisConnected
}

func (s *Scheduler) setRedisConnected(connected bool) {
	s.connMutex.Lock()
	defer s.connMutex.Unlock()
	if s.redisConnected && !connected {
		log.Println("[Scheduler] Redis connection lost")
	}
	s.redisConnected = connected
}

func (s *Scheduler) healthCheck() {
	defer s.wg.Done()

	ticker := time.NewTicker(HealthCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := s.connectRedis(); err != nil {
				s.setRedisConnected(false)
				log.Printf("[Scheduler] Redis health check failed: %v", err)
			}
		case <-s.ctx.Done():
			return
		}
	}
}

func (s *Scheduler) generateTasks() {
	defer s.wg.Done()

	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			for _, target := range s.targets {
				task := s.createTask(target)
				if err := s.enqueueTask(task); err != nil {
					log.Printf("[Scheduler] Failed to enqueue task %s: %v", task.ID, err)
					s.addToLocalQueue(task)
				} else {
					log.Printf("[Scheduler] Enqueued task %s for %s (malformed: %v)",
						task.ID, task.TargetIP, task.IsMalformed)
				}
			}
		case <-s.ctx.Done():
			return
		}
	}
}

func (s *Scheduler) createTask(targetIP string) *core.FuzzTask {
	isMalformed := core.RandomInt(0, 100) < s.malformedRate
	packet := core.GeneratePacket(isMalformed)

	return &core.FuzzTask{
		ID:          core.GenerateTaskID(),
		TargetIP:    targetIP,
		TargetPort:  502,
		PacketData:  packet.Raw,
		IsMalformed: isMalformed,
		Timestamp:   time.Now().Unix(),
	}
}

func (s *Scheduler) enqueueTask(task *core.FuzzTask) error {
	if !s.isRedisConnected() {
		return fmt.Errorf("redis not connected")
	}

	data, err := task.Serialize()
	if err != nil {
		return fmt.Errorf("serialize failed: %v", err)
	}

	ctx, cancel := context.WithTimeout(s.ctx, 3*time.Second)
	defer cancel()

	pipe := s.redisClient.TxPipeline()
	pipe.LPush(ctx, TaskQueueKey, data)
	pipe.LPush(ctx, ProcessingQueueKey, data)
	_, err = pipe.Exec(ctx)

	if err != nil {
		s.setRedisConnected(false)
		return fmt.Errorf("redis LPush failed: %v", err)
	}

	return nil
}

func (s *Scheduler) addToLocalQueue(task *core.FuzzTask) {
	s.localQueueMutex.Lock()
	defer s.localQueueMutex.Unlock()

	if len(s.localQueue) >= MaxLocalQueueSize {
		log.Printf("[Scheduler] Local queue full (%d), dropping oldest task", MaxLocalQueueSize)
		s.localQueue = s.localQueue[1:]
	}

	s.localQueue = append(s.localQueue, task)

	if err := s.saveBackup(); err != nil {
		log.Printf("[Scheduler] Warning: Failed to save backup: %v", err)
	}

	log.Printf("[Scheduler] Task %s buffered to local queue (size: %d)",
		task.ID, len(s.localQueue))
}

func (s *Scheduler) flushLocalQueue() {
	defer s.wg.Done()

	ticker := time.NewTicker(ReconnectInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if !s.isRedisConnected() {
				continue
			}

			s.localQueueMutex.Lock()
			tasks := make([]*core.FuzzTask, len(s.localQueue))
			copy(tasks, s.localQueue)
			s.localQueueMutex.Unlock()

			if len(tasks) == 0 {
				continue
			}

			successCount := 0
			var failedTasks []*core.FuzzTask

			for _, task := range tasks {
				if err := s.enqueueTask(task); err != nil {
					failedTasks = append(failedTasks, task)
					log.Printf("[Scheduler] Failed to flush task %s: %v", task.ID, err)
				} else {
					successCount++
				}
			}

			s.localQueueMutex.Lock()
			s.localQueue = failedTasks
			s.localQueueMutex.Unlock()

			if successCount > 0 {
				log.Printf("[Scheduler] Flushed %d tasks to Redis, %d remaining",
					successCount, len(failedTasks))
				s.saveBackup()
			}

		case <-s.ctx.Done():
			return
		}
	}
}

func (s *Scheduler) recoverProcessingTasks() {
	ctx, cancel := context.WithTimeout(s.ctx, 5*time.Second)
	defer cancel()

	results, err := s.redisClient.LRange(ctx, ProcessingQueueKey, 0, -1).Result()
	if err != nil {
		log.Printf("[Scheduler] Failed to recover processing tasks: %v", err)
		return
	}

	if len(results) == 0 {
		return
	}

	log.Printf("[Scheduler] Recovering %d tasks from processing queue", len(results))

	pipe := s.redisClient.TxPipeline()
	for _, data := range results {
		pipe.LPush(ctx, TaskQueueKey, data)
	}
	pipe.Del(ctx, ProcessingQueueKey)

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("[Scheduler] Failed to move processing tasks: %v", err)
		return
	}

	log.Printf("[Scheduler] Recovered %d tasks to main queue", len(results))
}

func (s *Scheduler) processResults() {
	defer s.wg.Done()

	for {
		select {
		case <-s.ctx.Done():
			return
		default:
		}

		result, err := s.dequeueResult()
		if err != nil {
			if err != redis.Nil && err != context.Canceled {
				log.Printf("[Scheduler] Error dequeuing result: %v", err)
				if s.isRedisConnected() {
					s.setRedisConnected(false)
				}
			}
			time.Sleep(1 * time.Second)
			continue
		}

		s.acknowledgeResult(result)
		s.logResult(result)
	}
}

func (s *Scheduler) dequeueResult() (*core.TaskResult, error) {
	if !s.isRedisConnected() {
		return nil, fmt.Errorf("redis not connected")
	}

	data, err := s.redisClient.BRPop(s.ctx, 2*time.Second, ResultQueueKey).Result()
	if err != nil {
		return nil, err
	}

	if len(data) < 2 {
		return nil, fmt.Errorf("invalid result data")
	}

	return core.DeserializeResult([]byte(data[1]))
}

func (s *Scheduler) acknowledgeResult(result *core.TaskResult) {
	ctx, cancel := context.WithTimeout(s.ctx, 2*time.Second)
	defer cancel()

	matchStr := fmt.Sprintf(`"id":"%s"`, result.TaskID)
	removed, err := s.redisClient.LRem(ctx, ProcessingQueueKey, 1, matchStr).Result()
	if err != nil {
		log.Printf("[Scheduler] Warning: Failed to acknowledge task %s: %v",
			result.TaskID, err)
	} else if removed == 0 {
		log.Printf("[Scheduler] Warning: Task %s not found in processing queue", result.TaskID)
	}
}

func (s *Scheduler) logResult(result *core.TaskResult) {
	status := "ALIVE"
	if !result.IsAlive {
		status = "CRASHED"
	}

	log.Printf("[Scheduler] Result: Task=%s Target=%s Status=%s Success=%v Error=%s",
		result.TaskID, result.TargetIP, status, result.Success, result.ErrorMsg)
}

func (s *Scheduler) saveBackup() error {
	s.localQueueMutex.Lock()
	defer s.localQueueMutex.Unlock()

	if len(s.localQueue) == 0 {
		return nil
	}

	data, err := json.Marshal(s.localQueue)
	if err != nil {
		return err
	}

	backupPath := filepath.Join(s.backupDir, BackupFile)
	tmpPath := backupPath + ".tmp"

	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return err
	}

	return os.Rename(tmpPath, backupPath)
}

func (s *Scheduler) loadBackup() error {
	backupPath := filepath.Join(s.backupDir, BackupFile)

	data, err := os.ReadFile(backupPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	var tasks []*core.FuzzTask
	if err := json.Unmarshal(data, &tasks); err != nil {
		return err
	}

	s.localQueueMutex.Lock()
	s.localQueue = append(s.localQueue, tasks...)
	s.localQueueMutex.Unlock()

	log.Printf("[Scheduler] Loaded %d tasks from backup", len(tasks))

	os.Remove(backupPath)
	return nil
}

func (s *Scheduler) GetQueueLength() (int64, error) {
	ctx, cancel := context.WithTimeout(s.ctx, 2*time.Second)
	defer cancel()

	return s.redisClient.LLen(ctx, TaskQueueKey).Result()
}

func (s *Scheduler) GetLocalQueueLength() int {
	s.localQueueMutex.Lock()
	defer s.localQueueMutex.Unlock()
	return len(s.localQueue)
}

func (s *Scheduler) Stop() {
	log.Println("[Scheduler] Stopping...")
	s.cancel()

	s.wg.Wait()

	if err := s.saveBackup(); err != nil {
		log.Printf("[Scheduler] Warning: Failed to save final backup: %v", err)
	}

	s.redisClient.Close()

	log.Println("[Scheduler] Stopped cleanly")
}
