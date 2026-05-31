package main

import (
	"dtask/internal/task"
	"fmt"
	"log"
	"os"
	"time"
)

var logger *log.Logger

func init() {
	f, err := os.OpenFile("/tmp/dtask_plugin.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		logger = log.New(os.Stdout, "[Logger Plugin] ", log.LstdFlags)
		return
	}
	logger = log.New(f, "[Logger Plugin] ", log.LstdFlags)
}

func Name() string {
	return "logger"
}

func PreExecute(t *task.Task) error {
	logger.Printf("PreExecute: Task %s is starting at %s\n", t.ID, time.Now().Format(time.RFC3339))
	logger.Printf("  Queue: %s, Script: %s\n", t.Queue, t.Script)
	fmt.Println("[Logger Plugin] PreExecute hook called for task:", t.ID)
	return nil
}

func PostExecute(t *task.Task) error {
	logger.Printf("PostExecute: Task %s completed at %s\n", t.ID, time.Now().Format(time.RFC3339))
	logger.Printf("  Status: %s, Exit Code: %d\n", t.Status, t.ExitCode)
	if t.Output != "" {
		logger.Printf("  Output: %s\n", truncateString(t.Output, 200))
	}
	fmt.Println("[Logger Plugin] PostExecute hook called for task:", t.ID)
	return nil
}

func truncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
