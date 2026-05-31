package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/spf13/viper"
	grpcapi "modbus-fuzzer/api/grpc"
	restapi "modbus-fuzzer/api/rest"
	"modbus-fuzzer/core/rules"
	"modbus-fuzzer/plc"
	"modbus-fuzzer/scheduler"
	"modbus-fuzzer/worker"
)

type Config struct {
	API struct {
		RESTPort int  `mapstructure:"rest_port"`
		GRPCPort int  `mapstructure:"grpc_port"`
		Enabled  bool `mapstructure:"enabled"`
	} `mapstructure:"api"`

	Redis struct {
		Address    string `mapstructure:"address"`
		Database   int    `mapstructure:"database"`
		PoolSize   int    `mapstructure:"pool_size"`
		MaxRetries int    `mapstructure:"max_retries"`
	} `mapstructure:"redis"`

	Scheduler struct {
		Targets               []string `mapstructure:"targets"`
		IntervalMs            int      `mapstructure:"interval_ms"`
		MalformedRate         int      `mapstructure:"malformed_rate"`
		HealthCheckIntervalMs int      `mapstructure:"health_check_interval_ms"`
		MaxLocalQueueSize     int      `mapstructure:"max_local_queue_size"`
		BackupDir             string   `mapstructure:"backup_dir"`
	} `mapstructure:"scheduler"`

	Worker struct {
		Count              int `mapstructure:"count"`
		MaxConcurrentTasks int `mapstructure:"max_concurrent_tasks"`
		MaxConnPerTarget   int `mapstructure:"max_conn_per_target"`
		ConnIdleTimeoutS   int `mapstructure:"conn_idle_timeout_s"`
	} `mapstructure:"worker"`

	PLC struct {
		ListenAddr       string `mapstructure:"listen_addr"`
		SimulateCrash    bool   `mapstructure:"simulate_crash"`
		CrashAfterPackets int   `mapstructure:"crash_after_packets"`
	} `mapstructure:"plc"`
}

var (
	config      Config
	wg          sync.WaitGroup
	ruleManager *rules.RuleManager
	redisClient *redis.Client
)

func main() {
	mode := flag.String("mode", "all", "运行模式: scheduler|worker|plc|api|all")
	workerID := flag.String("worker-id", "w1", "Worker ID")
	configFile := flag.String("config", "cmd/config/config.yaml", "配置文件路径")
	flag.Parse()

	if err := loadConfig(*configFile); err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	initGlobalResources()

	ctx, cancel := context.WithCancel(context.Background())

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		log.Printf("收到信号 %v，正在优雅关闭...", sig)
		cancel()
	}()

	switch *mode {
	case "scheduler":
		runScheduler(ctx)
	case "worker":
		runWorker(ctx, *workerID)
	case "plc":
		runPLC(ctx)
	case "api":
		runAPIServer(ctx)
	case "all":
		runAll(ctx)
	default:
		fmt.Println("无效的模式，使用: scheduler|worker|plc|api|all")
		os.Exit(1)
	}

	wg.Wait()
	cleanupGlobalResources()
	log.Println("所有组件已安全关闭")
}

func loadConfig(configFile string) error {
	viper.SetConfigFile(configFile)
	viper.SetConfigType("yaml")

	viper.SetDefault("api.enabled", true)
	viper.SetDefault("api.rest_port", 8080)
	viper.SetDefault("api.grpc_port", 50051)
	viper.SetDefault("redis.pool_size", 50)
	viper.SetDefault("redis.max_retries", 5)
	viper.SetDefault("scheduler.health_check_interval_ms", 5000)
	viper.SetDefault("scheduler.max_local_queue_size", 10000)
	viper.SetDefault("scheduler.backup_dir", "./data")
	viper.SetDefault("worker.max_concurrent_tasks", 10)
	viper.SetDefault("worker.max_conn_per_target", 5)
	viper.SetDefault("worker.conn_idle_timeout_s", 30)
	viper.SetDefault("plc.crash_after_packets", 50)

	if err := viper.ReadInConfig(); err != nil {
		return err
	}

	return viper.Unmarshal(&config)
}

func initGlobalResources() {
	ruleManager = rules.NewRuleManager()

	redisClient = redis.NewClient(&redis.Options{
		Addr:         config.Redis.Address,
		DB:           config.Redis.Database,
		PoolSize:     config.Redis.PoolSize,
		MinIdleConns: 10,
		MaxRetries:   config.Redis.MaxRetries,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	seedDefaultRules()
}

func seedDefaultRules() {
	defaultRules := []*rules.MutationRule{
		{
			ID:          "invalid_fc",
			Name:        "Invalid Function Code",
			Description: "Use random invalid function codes (0x80-0xFF)",
			Type:        rules.TypeInvalidFunctionCode,
			Weight:      15,
			Enabled:     true,
		},
		{
			ID:          "invalid_length",
			Name:        "Invalid Data Length",
			Description: "Use random invalid data lengths",
			Type:        rules.TypeInvalidDataLength,
			Weight:      15,
			Enabled:     true,
			Parameters: map[string]string{
				"min_length": "0",
				"max_length": "255",
			},
		},
		{
			ID:          "overflow",
			Name:        "Overflow Data",
			Description: "Send large amount of data to trigger overflow",
			Type:        rules.TypeOverflowData,
			Weight:      10,
			Enabled:     true,
			Parameters: map[string]string{
				"length": "1000",
			},
		},
		{
			ID:          "invalid_pid",
			Name:        "Invalid Protocol ID",
			Description: "Use non-zero protocol ID",
			Type:        rules.TypeInvalidProtocolID,
			Weight:      10,
			Enabled:     true,
		},
		{
			ID:          "boundary",
			Name:        "Boundary Values",
			Description: "Use boundary values for addresses and quantities",
			Type:        rules.TypeBoundaryValue,
			Weight:      10,
			Enabled:     true,
		},
		{
			ID:          "malformed",
			Name:        "Malformed Packet",
			Description: "Completely random malformed packet data",
			Type:        rules.TypeMalformedPacket,
			Weight:      10,
			Enabled:     true,
		},
		{
			ID:          "fuzzy_bytes",
			Name:        "Fuzzy Bytes",
			Description: "Randomly flip bits in packet data",
			Type:        rules.TypeFuzzyBytes,
			Weight:      10,
			Enabled:     true,
		},
		{
			ID:          "reversed",
			Name:        "Reversed Bytes",
			Description: "Reverse the byte order of data",
			Type:        rules.TypeReversedBytes,
			Weight:      10,
			Enabled:     true,
		},
		{
			ID:          "invalid_uid",
			Name:        "Invalid Unit ID",
			Description: "Use random unit IDs (0-255)",
			Type:        rules.TypeInvalidUnitID,
			Weight:      10,
			Enabled:     true,
		},
	}

	for _, rule := range defaultRules {
		if err := ruleManager.AddRule(rule); err != nil {
			log.Printf("Warning: Failed to add default rule %s: %v", rule.ID, err)
		}
	}

	log.Printf("Loaded %d default mutation rules", len(defaultRules))
}

func cleanupGlobalResources() {
	if redisClient != nil {
		redisClient.Close()
	}
}

func runAPIServer(ctx context.Context) {
	log.Println("=== 启动 API 服务 ===")

	if !config.API.Enabled {
		log.Println("API 服务已禁用")
		return
	}

	restAddr := fmt.Sprintf(":%d", config.API.RESTPort)
	restServer := restapi.NewAPIServer(ruleManager, redisClient)
	if err := restServer.Start(restAddr); err != nil {
		log.Fatalf("REST API 启动失败: %v", err)
	}
	log.Printf("REST API 已启动，监听 %s", restAddr)

	grpcAddr := fmt.Sprintf(":%d", config.API.GRPCPort)
	grpcServer := grpcapi.NewFuzzingServer()
	if err := grpcServer.Start(grpcAddr); err != nil {
		log.Fatalf("gRPC 服务启动失败: %v", err)
	}
	log.Printf("gRPC 服务已启动，监听 %s", grpcAddr)

	wg.Add(1)
	go func() {
		defer wg.Done()
		<-ctx.Done()
		log.Println("正在关闭 API 服务...")
		restServer.Stop()
		grpcServer.Stop()
		log.Println("API 服务已关闭")
	}()

	log.Println("=== API 服务文档 ===")
	log.Printf("REST API: http://localhost%s/api/v1", restAddr)
	log.Printf("  POST   /api/v1/rules              - 创建新规则")
	log.Printf("  GET    /api/v1/rules              - 列出所有规则")
	log.Printf("  GET    /api/v1/rules/:id          - 获取规则详情")
	log.Printf("  PUT    /api/v1/rules/:id          - 更新规则")
	log.Printf("  DELETE /api/v1/rules/:id          - 删除规则")
	log.Printf("  POST   /api/v1/rules/:id/enable   - 启用规则")
	log.Printf("  POST   /api/v1/rules/:id/disable  - 禁用规则")
	log.Printf("  POST   /api/v1/rules/broadcast    - 广播所有规则到 Worker")
	log.Printf("  GET    /api/v1/health             - 健康检查")
	log.Printf("gRPC: localhost%s (FuzzingService)", grpcAddr)
	log.Printf("  GetCoverage    - 获取覆盖率快照")
	log.Printf("  StreamCoverage - 实时覆盖率流")
}

func runScheduler(ctx context.Context) {
	log.Println("=== 启动调度器 ===")

	if config.API.Enabled {
		runAPIServer(ctx)
		time.Sleep(200 * time.Millisecond)
	}

	interval := time.Duration(config.Scheduler.IntervalMs) * time.Millisecond
	s := scheduler.NewScheduler(
		config.Redis.Address,
		config.Redis.Database,
		config.Scheduler.Targets,
		interval,
		config.Scheduler.MalformedRate,
	)

	if err := s.Start(); err != nil {
		log.Fatalf("调度器启动失败: %v", err)
	}

	log.Println("调度器已启动")

	wg.Add(1)
	go func() {
		defer wg.Done()
		<-ctx.Done()
		log.Println("正在关闭调度器...")
		s.Stop()
		log.Println("调度器已关闭")
	}()
}

func runWorker(ctx context.Context, id string) {
	log.Printf("=== 启动 Worker %s ===", id)

	w, err := worker.NewWorker(
		id,
		config.Redis.Address,
		config.Redis.Database,
	)
	if err != nil {
		log.Fatalf("Worker %s 创建失败: %v", id, err)
	}

	w.Start()
	log.Printf("Worker %s 已启动", id)

	wg.Add(1)
	go func() {
		defer wg.Done()
		<-ctx.Done()
		log.Printf("正在关闭 Worker %s...", id)
		w.Stop()
		log.Printf("Worker %s 已关闭", id)
	}()
}

func runPLC(ctx context.Context) {
	log.Println("=== 启动模拟 PLC ===")

	p := plc.NewSimulatorWithConfig(
		config.PLC.ListenAddr,
		config.PLC.SimulateCrash,
		uint64(config.PLC.CrashAfterPackets),
	)

	if err := p.Start(); err != nil {
		log.Fatalf("PLC 启动失败: %v", err)
	}

	log.Printf("PLC 已启动，监听 %s", config.PLC.ListenAddr)

	wg.Add(1)
	go func() {
		defer wg.Done()
		<-ctx.Done()
		log.Println("正在关闭 PLC...")
		p.Stop()
		log.Println("PLC 已关闭")
	}()
}

func runAll(ctx context.Context) {
	log.Println("=== 启动完整系统 ===")

	runAPIServer(ctx)

	time.Sleep(300 * time.Millisecond)

	runPLC(ctx)

	time.Sleep(300 * time.Millisecond)

	runScheduler(ctx)

	time.Sleep(300 * time.Millisecond)

	for i := 1; i <= config.Worker.Count; i++ {
		runWorker(ctx, fmt.Sprintf("w%d", i))
		time.Sleep(100 * time.Millisecond)
	}

	log.Println("所有组件已启动")
}
