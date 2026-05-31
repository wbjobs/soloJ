package cmd

import (
	"github.com/spf13/cobra"
)

var workerCmd = &cobra.Command{
	Use:   "worker",
	Short: "Worker commands",
	Long:  `Commands for managing task workers.`,
}

func init() {
	rootCmd.AddCommand(workerCmd)
}
