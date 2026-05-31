package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	NodeManagerAddr string
	ScoringAddr     string
	SchedulerAddr   string
	GRPCAddr        string
	TiDBDSN         string
	HeartbeatTTL    time.Duration
	RaftNodeID      string
	RaftCluster     []string
	Region          string
	BandwidthCap    float64
}

func Load() *Config {
	return &Config{
		NodeManagerAddr: env("NODE_MANAGER_ADDR", ":8080"),
		ScoringAddr:     env("SCORING_ADDR", ":8081"),
		SchedulerAddr:   env("SCHEDULER_ADDR", ":8082"),
		GRPCAddr:        env("GRPC_ADDR", ":9090"),
		TiDBDSN:         env("TIDB_DSN", "root:@tcp(127.0.0.1:4000)/dcdn?charset=utf8mb4&parseTime=True"),
		HeartbeatTTL:    time.Duration(envInt("HEARTBEAT_TTL_MS", 5000)) * time.Millisecond,
		RaftNodeID:      env("RAFT_NODE_ID", "node-1"),
		RaftCluster:     splitEnv("RAFT_CLUSTER", "127.0.0.1:9090,127.0.0.1:9091,127.0.0.1:9092"),
		Region:          env("REGION", "default"),
		BandwidthCap:    float64(envInt("BANDWIDTH_CAP", 1000)),
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func envInt(k string, def int) int {
	v := os.Getenv(k)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func splitEnv(k, def string) []string {
	v := env(k, def)
	out := []string{}
	for _, s := range splitString(v, ',') {
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}

func splitString(s string, sep byte) []string {
	var parts []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == sep {
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	parts = append(parts, s[start:])
	return parts
}
