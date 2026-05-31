package main

import (
	"fmt"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/fcnet/func-compute/config"
	"github.com/fcnet/func-compute/p2p"
	"github.com/fcnet/func-compute/plugin"
	"github.com/fcnet/func-compute/registry"
	"github.com/fcnet/func-compute/scheduler"
	"github.com/fcnet/func-compute/sharding"
	"github.com/fcnet/func-compute/types"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func main() {
	cfg, err := config.Load("config.yaml")
	if err != nil {
		panic(fmt.Sprintf("load config: %v", err))
	}

	logger := setupLogger(cfg.Log.Level)
	defer logger.Sync()

	logger.Info("starting function compute node...")

	nodeHost, err := p2p.NewNodeHost(&cfg.P2P, logger)
	if err != nil {
		logger.Fatal("failed to create node host", zap.Error(err))
	}
	defer nodeHost.Close()

	logger.Info("node started", zap.String("peer_id", nodeHost.ID().String()))
	for _, addr := range nodeHost.Addrs() {
		logger.Info("listening on", zap.String("addr", addr.String()))
	}

	pluginMgr := plugin.NewManager(&cfg.Plugin, logger)
	if err := pluginMgr.LoadPlugins(); err != nil {
		logger.Warn("failed to load plugins", zap.Error(err))
	}

	funcs := pluginMgr.GetAllFunctions()
	logger.Info("loaded plugins", zap.Int("count", len(funcs)))
	for _, f := range funcs {
		logger.Info("function available", zap.String("name", f.Name), zap.String("version", f.Version))
		nodeHost.RegisterFunction(f.ID)
	}

	reg, err := registry.NewFunctionRegistry(&cfg.IPFS, logger)
	if err != nil {
		logger.Warn("failed to create registry", zap.Error(err))
	}

	for _, f := range funcs {
		reg.RegisterFunction(&f, nodeHost.ID())
	}

	sched := scheduler.NewScheduler(&cfg.Scheduler, logger, nodeHost, pluginMgr, nodeHost.ID())

	wordCountID := types.NewFunctionID("wordcount", "1.0.0")
	sched.RegisterShardPolicy(wordCountID, types.ShardPolicy{
		Strategy:       types.ShardStrategySize,
		ThresholdBytes: 1024,
		MaxShards:      8,
		ShardSizeBytes: 512,
		DataField:      "data",
	})
	sched.RegisterCombiner(wordCountID, sharding.CombinerMap)

	mathID := types.NewFunctionID("math", "1.0.0")
	sched.RegisterShardPolicy(mathID, types.ShardPolicy{
		Strategy:       types.ShardStrategyRange,
		ThresholdBytes: 1024,
		MaxShards:      4,
		DataField:      "data",
	})
	sched.RegisterCombiner(mathID, sharding.CombinerSum)

	sched.Start()
	defer sched.Stop()

	nodeInfo := &types.NodeInfo{
		ID:        nodeHost.ID(),
		Functions: pluginMgr.GetFunctionIDs(),
		Status:    types.NodeStatusOnline,
	}

	nodeHost.StartHeartbeat(nodeInfo)
	nodeHost.StartHealthChecker()

	setupSignalHandler(logger, nodeHost, sched)

	logger.Info("node is ready")
	select {}
}

func setupLogger(level string) *zap.Logger {
	config := zap.NewProductionConfig()
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	switch level {
	case "debug":
		config.Level = zap.NewAtomicLevelAt(zap.DebugLevel)
	case "info":
		config.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
	case "warn":
		config.Level = zap.NewAtomicLevelAt(zap.WarnLevel)
	case "error":
		config.Level = zap.NewAtomicLevelAt(zap.ErrorLevel)
	default:
		config.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
	}

	logger, err := config.Build()
	if err != nil {
		panic(err)
	}
	return logger
}

func setupSignalHandler(logger *zap.Logger, nodeHost *p2p.NodeHost, sched *scheduler.Scheduler) {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigCh
		logger.Info("received signal, shutting down...", zap.String("signal", sig.String()))

		sched.Stop()
		nodeHost.Close()

		logger.Info("shutdown complete")
		os.Exit(0)
	}()
}

func updateNodeInfo(nodeHost *p2p.NodeHost, pluginMgr *plugin.Manager) {
	ticker := time.NewTicker(5 * time.Second)
	go func() {
		for range ticker.C {
			var m runtime.MemStats
			runtime.ReadMemStats(&m)

			nodeInfo := &types.NodeInfo{
				ID:          nodeHost.ID(),
				Functions:   pluginMgr.GetFunctionIDs(),
				LastHeartbeat: time.Now(),
				Load:        0.0,
				MemoryTotal: 1024 * 1024 * 1024,
				MemoryUsed:  int64(m.Alloc),
				Status:      types.NodeStatusOnline,
			}

			nodeHost.StartHeartbeat(nodeInfo)
		}
	}()
}
