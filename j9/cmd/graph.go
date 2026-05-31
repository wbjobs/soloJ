package cmd

import (
	"dtask/internal/dag"
	"dtask/internal/redis"
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var maxDepth int

var graphCmd = &cobra.Command{
	Use:   "graph [task_id]",
	Short: "Display task dependency graph",
	Long:  `Display the task dependency graph as an ASCII tree in the terminal.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		taskID := args[0]

		rdb := redis.NewClient(redisAddr, "", 0, "graph-client")
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

		g, err := dag.BuildGraphFromRedis(rdb, taskID, maxDepth)
		if err != nil {
			fmt.Printf("Error: Failed to build graph: %v\n", err)
			os.Exit(1)
		}

		fmt.Println(g.PrintTree(taskID))
	},
}

func init() {
	rootCmd.AddCommand(graphCmd)
	graphCmd.Flags().StringVar(&redisAddr, "redis", "localhost:6379", "Redis address")
	graphCmd.Flags().IntVar(&maxDepth, "depth", 10, "Maximum depth to traverse")
}
