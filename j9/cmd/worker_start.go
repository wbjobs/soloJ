package cmd

import (
	"bytes"
	"context"
	"dtask/internal/plugin"
	"dtask/internal/redis"
	"dtask/internal/task"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"sync"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/spf13/cobra"
)

var (
	workerQueues    []string
	pluginDir       string
	maxConcurrency  int
	taskTimeout     time.Duration
	heartbeatTTL    time.Duration
	reclaimInterval time.Duration
)

type Worker struct {
	id             string
	rdb            *redis.Client
	pluginManager  *plugin.Manager
	runningTasks   sync.Map
	shutdownChan   chan struct{}
	wg             sync.WaitGroup
	concurrencySem chan struct{}
}

func NewWorker(workerID string, rdb *redis.Client, pm *plugin.Manager, maxConc int) *Worker {
	return &Worker{
		id:             workerID,
		rdb:            rdb,
		pluginManager:  pm,
		runningTasks:   sync.Map{},
		shutdownChan:   make(chan struct{}),
		concurrencySem: make(chan struct{}, maxConc),
	}
}

func (w *Worker) Start(queues []string) {
	go w.heartbeatLoop()
	go w.reclaimExpiredTasksLoop()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		fmt.Println("\nShutting down worker...")
		close(w.shutdownChan)
		w.requeueRunningTasks()
		w.wg.Wait()
		w.rdb.Close()
		os.Exit(0)
	}()

	fmt.Printf("Worker %s started. Listening to queues: %v\n", w.id, queues)
	fmt.Printf("Max concurrency: %d, Task timeout: %v\n", maxConcurrency, taskTimeout)

	for {
		select {
		case <-w.shutdownChan:
			return
		default:
			for _, queue := range queues {
				select {
				case w.concurrencySem <- struct{}{}:
					taskID, err := w.rdb.PopFromQueue(queue, 5*time.Second)
					if err != nil {
						<-w.concurrencySem
						if err.Error() != "redis: nil" {
							fmt.Printf("Error popping from queue %s: %v\n", queue, err)
						}
						continue
					}

					w.wg.Add(1)
					go func(q string, tid string) {
						defer w.wg.Done()
						defer func() { <-w.concurrencySem }()
						w.processTask(q, tid)
					}(queue, taskID)
				default:
				}
			}
		}
	}
}

func (w *Worker) heartbeatLoop() {
	ticker := time.NewTicker(heartbeatTTL / 2)
	defer ticker.Stop()

	for {
		select {
		case <-w.shutdownChan:
			return
		case <-ticker.C:
			if err := w.rdb.RefreshHeartbeat(heartbeatTTL); err != nil {
				fmt.Printf("Heartbeat error: %v\n", err)
			}
		}
	}
}

func (w *Worker) reclaimExpiredTasksLoop() {
	ticker := time.NewTicker(reclaimInterval)
	defer ticker.Stop()

	for {
		select {
		case <-w.shutdownChan:
			return
		case <-ticker.C:
			reclaimed, err := w.rdb.ReclaimExpiredTasks(taskTimeout)
			if err != nil {
				fmt.Printf("Reclaim tasks error: %v\n", err)
			} else if len(reclaimed) > 0 {
				fmt.Printf("Reclaimed %d expired tasks: %v\n", len(reclaimed), reclaimed)
			}
		}
	}
}

func (w *Worker) requeueRunningTasks() {
	fmt.Println("Re-queuing running tasks...")

	w.runningTasks.Range(func(key, value interface{}) bool {
		taskID := key.(string)
		queue := value.(string)

		if err := w.rdb.RemoveFromProcessing(taskID); err != nil {
			fmt.Printf("Error removing task %s from processing: %v\n", taskID, err)
		}

		if err := w.rdb.PushToQueue(queue, taskID); err != nil {
			fmt.Printf("Error re-queuing task %s: %v\n", taskID, err)
		} else {
			fmt.Printf("Re-queued task: %s\n", taskID)
		}

		taskData, err := w.rdb.GetTask(taskID)
		if err == nil {
			if t, err := task.Unmarshal(taskData); err == nil {
				t.Status = task.StatusPending
				t.UpdatedAt = time.Now()
				if data, err := t.Marshal(); err == nil {
					w.rdb.SetTask(taskID, data)
				}
			}
		}

		return true
	})
}

func (w *Worker) processTask(queue string, taskID string) {
	fmt.Printf("[%s] Processing task: %s\n", w.id, taskID)

	w.runningTasks.Store(taskID, queue)
	defer w.runningTasks.Delete(taskID)

	if err := w.rdb.MoveToProcessing(queue, taskID, heartbeatTTL); err != nil {
		fmt.Printf("Error moving task %s to processing: %v\n", taskID, err)
	}

	taskData, err := w.rdb.GetTask(taskID)
	if err != nil {
		fmt.Printf("Error getting task %s: %v\n", taskID, err)
		w.failTask(taskID, "", 1, fmt.Sprintf("failed to get task: %v", err))
		return
	}

	t, err := task.Unmarshal(taskData)
	if err != nil {
		fmt.Printf("Error unmarshaling task %s: %v\n", taskID, err)
		w.failTask(taskID, "", 1, fmt.Sprintf("failed to unmarshal task: %v", err))
		return
	}

	t.Status = task.StatusRunning
	t.UpdatedAt = time.Now()
	if data, err := t.Marshal(); err == nil {
		w.rdb.SetTask(taskID, data)
	}

	w.pluginManager.RunPreExecuteHooks(t)

	output, exitCode := w.executeTask(t)

	t.Output = output
	t.ExitCode = exitCode

	if exitCode == 0 {
		t.Status = task.StatusDone
	} else {
		t.Status = task.StatusFailed
	}
	t.UpdatedAt = time.Now()

	w.pluginManager.RunPostExecuteHooks(t)

	if data, err := t.Marshal(); err == nil {
		w.rdb.SetTask(taskID, data)
	}

	if err := w.rdb.RemoveFromProcessing(taskID); err != nil {
		fmt.Printf("Error removing task %s from processing: %v\n", taskID, err)
	}

	if t.Status == task.StatusDone {
		w.checkAndQueueDependentTasks(taskID)
	}

	fmt.Printf("[%s] Task %s completed with status: %s (exit code: %d)\n", w.id, taskID, t.Status, exitCode)
}

func (w *Worker) executeTask(t *task.Task) (string, int) {
	ctx, cancel := context.WithTimeout(context.Background(), taskTimeout)
	defer cancel()

	var outputBuf bytes.Buffer

	pythonCmd := "python3"
	if runtime.GOOS == "windows" {
		pythonCmd = "python"
	}

	cmd := exec.CommandContext(ctx, pythonCmd, t.Script)
	cmd.Stdout = &outputBuf
	cmd.Stderr = &outputBuf

	err := cmd.Run()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			outputBuf.WriteString(fmt.Sprintf("\nTask timed out after %v\n", taskTimeout))
			return outputBuf.String(), -1
		}
		if exitErr, ok := err.(*exec.ExitError); ok {
			return outputBuf.String(), exitErr.ExitCode()
		}
		outputBuf.WriteString(fmt.Sprintf("\nExecution error: %v\n", err))
		return outputBuf.String(), 1
	}

	return outputBuf.String(), 0
}

func (w *Worker) failTask(taskID string, output string, exitCode int, errMsg string) {
	taskData, err := w.rdb.GetTask(taskID)
	if err != nil {
		return
	}

	t, err := task.Unmarshal(taskData)
	if err != nil {
		return
	}

	if output != "" {
		t.Output = output
	} else {
		t.Output = errMsg
	}
	t.ExitCode = exitCode
	t.Status = task.StatusFailed
	t.UpdatedAt = time.Now()

	if data, err := t.Marshal(); err == nil {
		w.rdb.SetTask(taskID, data)
	}

	w.rdb.RemoveFromProcessing(taskID)
}

func (w *Worker) checkAndQueueDependentTasks(completedTaskID string) {
	dependents, err := w.rdb.GetDependentTasks(completedTaskID)
	if err != nil {
		return
	}

	for _, depTaskID := range dependents {
		taskData, err := w.rdb.GetTask(depTaskID)
		if err != nil {
			continue
		}

		depTask, err := task.Unmarshal(taskData)
		if err != nil {
			continue
		}

		if depTask.Status != task.StatusPending {
			continue
		}

		allDepsDone := true
		for _, depID := range depTask.Dependencies {
			depData, err := w.rdb.GetTask(depID)
			if err != nil {
				allDepsDone = false
				break
			}
			dep, err := task.Unmarshal(depData)
			if err != nil || dep.Status != task.StatusDone {
				allDepsDone = false
				break
			}
		}

		if allDepsDone {
			fmt.Printf("[%s] All dependencies met for task %s, queuing...\n", w.id, depTaskID)
			
			if err := w.rdb.PushToQueue(depTask.Queue, depTaskID); err != nil {
				fmt.Printf("[%s] Error queuing task %s: %v\n", w.id, depTaskID, err)
				continue
			}

			if err := w.rdb.RemoveFromPendingQueue(depTaskID); err != nil {
				fmt.Printf("[%s] Warning: Failed to remove from pending queue: %v\n", w.id, err)
			}

			depTask.Status = task.StatusPending
			depTask.UpdatedAt = time.Now()
			if data, err := depTask.Marshal(); err == nil {
				w.rdb.SetTask(depTaskID, data)
			}
		}
	}
}

var workerStartCmd = &cobra.Command{
	Use:   "start",
	Short: "Start a worker process",
	Long:  `Start a worker process that pulls tasks from Redis queues and executes them with reliability guarantees.`,
	Run: func(cmd *cobra.Command, args []string) {
		workerID := uuid.New().String()

		rdb := redis.NewClient(redisAddr, "", 0, workerID)
		if err := rdb.Ping(); err != nil {
			fmt.Printf("Error: Failed to connect to Redis: %v\n", err)
			os.Exit(1)
		}

		pluginManager := plugin.NewManager()

		if pluginDir == "" {
			home, err := os.UserHomeDir()
			if err == nil {
				pluginDir = filepath.Join(home, ".dtask", "plugins")
			}
		}

		if pluginDir != "" {
			if err := pluginManager.LoadPlugins(pluginDir); err != nil {
				fmt.Printf("Warning: Failed to load plugins: %v\n", err)
			}
		}

		fmt.Printf("Loaded %d plugins\n", pluginManager.PluginCount())

		worker := NewWorker(workerID, rdb, pluginManager, maxConcurrency)
		worker.Start(workerQueues)
	},
}

func init() {
	workerCmd.AddCommand(workerStartCmd)

	workerStartCmd.Flags().StringSliceVar(&workerQueues, "queues", []string{"default", "high", "low"}, "Queues to listen to")
	workerStartCmd.Flags().StringVar(&redisAddr, "redis", "localhost:6379", "Redis address")
	workerStartCmd.Flags().StringVar(&pluginDir, "plugin-dir", "", "Plugin directory (default: ~/.dtask/plugins)")
	workerStartCmd.Flags().IntVar(&maxConcurrency, "concurrency", 10, "Maximum concurrent tasks")
	workerStartCmd.Flags().DurationVar(&taskTimeout, "task-timeout", 2*time.Hour, "Task execution timeout")
	workerStartCmd.Flags().DurationVar(&heartbeatTTL, "heartbeat-ttl", 5*time.Minute, "Worker heartbeat TTL")
	workerStartCmd.Flags().DurationVar(&reclaimInterval, "reclaim-interval", 1*time.Minute, "Interval to reclaim expired tasks")
}
