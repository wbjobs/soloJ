package cmd

import (
	"dtask/internal/redis"
	"dtask/internal/task"
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var statusCmd = &cobra.Command{
	Use:   "status [task_id]",
	Short: "Check the status of a task",
	Long:  `Query the current status of a task by its ID.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		taskID := args[0]

		rdb := redis.NewClient(redisAddr, "", 0, "status-client")
		if err := rdb.Ping(); err != nil {
			fmt.Printf("Error: Failed to connect to Redis: %v\n", err)
			os.Exit(1)
		}

		exists, err := rdb.TaskExists(taskID)
		if err != nil {
			fmt.Printf("Error: Failed to check task existence: %v\n", err)
			os.Exit(1)
		}

		if !exists {
			fmt.Printf("Task %s not found\n", taskID)
			os.Exit(1)
		}

		taskData, err := rdb.GetTask(taskID)
		if err != nil {
			fmt.Printf("Error: Failed to get task: %v\n", err)
			os.Exit(1)
		}

		t, err := task.Unmarshal(taskData)
		if err != nil {
			fmt.Printf("Error: Failed to unmarshal task: %v\n", err)
			os.Exit(1)
		}

		fmt.Printf("Task ID: %s\n", t.ID)
		fmt.Printf("Status: %s\n", t.Status)
		fmt.Printf("Queue: %s\n", t.Queue)
		fmt.Printf("Script: %s\n", t.Script)
		if len(t.Dependencies) > 0 {
			fmt.Printf("Dependencies: %s\n", t.Dependencies)
		}
		fmt.Printf("Created: %s\n", t.CreatedAt.Format("2006-01-02 15:04:05"))
		fmt.Printf("Updated: %s\n", t.UpdatedAt.Format("2006-01-02 15:04:05"))

		if t.Status == task.StatusDone || t.Status == task.StatusFailed {
			fmt.Printf("Exit Code: %d\n", t.ExitCode)
			if t.Output != "" {
				fmt.Printf("Output:\n%s\n", t.Output)
			}
		}
	},
}

func init() {
	rootCmd.AddCommand(statusCmd)
	statusCmd.Flags().StringVar(&redisAddr, "redis", "localhost:6379", "Redis address")
}
