package cmd

import (
	"dtask/internal/dag"
	"dtask/internal/redis"
	"dtask/internal/task"
	"fmt"
	"os"
	"strings"

	"github.com/google/uuid"
	"github.com/spf13/cobra"
)

var (
	queueName    string
	scriptPath   string
	redisAddr    string
	dependencies []string
)

var submitCmd = &cobra.Command{
	Use:   "submit",
	Short: "Submit a task to the queue",
	Long:  `Submit a Python script to the specified task queue for execution. Supports task dependencies.`,
	Run: func(cmd *cobra.Command, args []string) {
		if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
			fmt.Printf("Error: Script file %s does not exist\n", scriptPath)
			os.Exit(1)
		}

		rdb := redis.NewClient(redisAddr, "", 0, "submit-client")
		if err := rdb.Ping(); err != nil {
			fmt.Printf("Error: Failed to connect to Redis: %v\n", err)
			os.Exit(1)
		}

		taskID := uuid.New().String()

		if len(dependencies) > 0 {
			hasCycle, cyclePath, err := dag.DetectCyclicDependency(rdb, taskID, dependencies)
			if err != nil {
				fmt.Printf("Warning: Failed to check for cyclic dependencies: %v\n", err)
			} else if hasCycle {
				fmt.Printf("Error: Cyclic dependency detected!\nCycle: %s\n", strings.Join(cyclePath, " -> "))
				os.Exit(1)
			}

			for _, depID := range dependencies {
				exists, _ := rdb.TaskExists(depID)
				if !exists {
					fmt.Printf("Warning: Dependency task %s does not exist\n", depID)
				}
			}
		}

		t := task.NewTask(taskID, queueName, scriptPath, dependencies)

		taskData, err := t.Marshal()
		if err != nil {
			fmt.Printf("Error: Failed to marshal task: %v\n", err)
			os.Exit(1)
		}

		if err := rdb.SetTask(taskID, taskData); err != nil {
			fmt.Printf("Error: Failed to store task: %v\n", err)
			os.Exit(1)
		}

		readyToQueue := true
		if len(dependencies) > 0 {
			for _, depID := range dependencies {
				if err := rdb.AddDependentTask(depID, taskID); err != nil {
					fmt.Printf("Warning: Failed to add dependent task index: %v\n", err)
				}
			}

			g, err := dag.BuildGraphFromRedis(rdb, taskID, 10)
			if err == nil {
				ready, unmet := g.CheckDependenciesReady(taskID)
				if !ready {
					readyToQueue = false
					fmt.Printf("Task has unmet dependencies:\n  %s\n", strings.Join(unmet, "\n  "))
					fmt.Println("Task will be queued automatically when all dependencies are completed.")
					if err := rdb.AddToPendingQueue(taskID); err != nil {
						fmt.Printf("Warning: Failed to add to pending queue: %v\n", err)
					}
				}
			}
		}

		if readyToQueue {
			if err := rdb.PushToQueue(queueName, taskID); err != nil {
				fmt.Printf("Error: Failed to push task to queue: %v\n", err)
				os.Exit(1)
			}
		}

		fmt.Printf("\nTask submitted successfully.\nTask ID: %s\n", taskID)
		if len(dependencies) > 0 {
			fmt.Printf("Dependencies: %s\n", strings.Join(dependencies, ", "))
		}
	},
}

func init() {
	rootCmd.AddCommand(submitCmd)

	submitCmd.Flags().StringVar(&queueName, "queue", "default", "Queue name to submit the task to")
	submitCmd.Flags().StringVar(&scriptPath, "script", "", "Path to the Python script to execute")
	submitCmd.Flags().StringVar(&redisAddr, "redis", "localhost:6379", "Redis address")
	submitCmd.Flags().StringSliceVar(&dependencies, "dep", []string{}, "Dependency task IDs (can be specified multiple times)")

	submitCmd.MarkFlagRequired("script")
}
