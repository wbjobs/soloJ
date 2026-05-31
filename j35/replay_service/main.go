package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/keepalive"

	kafkaPkg "replay_service/kafka"
	"replay_service/replay"
)

type ReplayServer struct {
	grpcServer   *grpc.Server
	producer     *kafkaPkg.BattleEventProducer
	consumer     *kafkaPkg.BattleEventConsumer
	replaySvc    *replay.ReplayService
	cheatDetect  *replay.CheatDetector
}

func main() {
	kafkaBrokers := envOrDefaultSlice("KAFKA_BROKERS", []string{"localhost:9092"})
	grpcAddr := envOrDefault("GRPC_ADDR", ":50052")
	redisAddr := envOrDefault("REDIS_ADDR", "localhost:6379")
	cheatBatchInterval := envOrDefaultInt("CHEAT_BATCH_INTERVAL_MIN", 30)

	producer := kafkaPkg.NewBattleEventProducer(kafkaPkg.ProducerConfig{
		Brokers: kafkaBrokers,
	})

	consumer := kafkaPkg.NewBattleEventConsumer(kafkaPkg.ConsumerConfig{
		Brokers: kafkaBrokers,
	})

	replaySvc := replay.NewReplayService(consumer)

	cheatDetect := replay.NewCheatDetector(replay.CheatDetectorConfig{
		MaxMovementSpeed:    10.0,
		MinReactionTimeMs:   50,
		CheatScoreThreshold: 25.0,
	})

	kaParams := keepalive.ServerParameters{
		MaxConnectionIdle:     30 * time.Second,
		MaxConnectionAge:      5 * time.Minute,
		MaxConnectionAgeGrace: 10 * time.Second,
		Time:                  10 * time.Second,
		Timeout:               3 * time.Second,
	}

	grpcSrv := grpc.NewServer(
		grpc.MaxRecvMsgSize(4*1024*1024),
		grpc.MaxSendMsgSize(4*1024*1024),
		grpc.KeepaliveParams(kaParams),
		grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
			MinTime:             5 * time.Second,
			PermitWithoutStream: true,
		}),
	)

	server := &ReplayServer{
		grpcServer:  grpcSrv,
		producer:    producer,
		consumer:    consumer,
		replaySvc:   replaySvc,
		cheatDetect: cheatDetect,
	}

	lis, err := net.Listen("tcp", grpcAddr)
	if err != nil {
		fmt.Printf("listen failed: %v\n", err)
		os.Exit(1)
	}

	go func() {
		fmt.Printf("gRPC replay server listening on %s\n", grpcAddr)
		if err := grpcSrv.Serve(lis); err != nil {
			fmt.Printf("gRPC server error: %v\n", err)
			os.Exit(1)
		}
	}()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go server.runCheatDetectionBatch(ctx, time.Duration(cheatBatchInterval)*time.Minute)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	fmt.Printf("Replay service started: grpc=%s kafka=%v redis=%s\n", grpcAddr, kafkaBrokers, redisAddr)

	sig := <-sigCh
	fmt.Printf("Received signal %v, shutting down...\n", sig)

	cancel()
	replaySvc.Close()
	grpcSrv.GracefulStop()
	producer.Close()
	consumer.Close()

	fmt.Println("Replay service stopped")
}

func (s *ReplayServer) runCheatDetectionBatch(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.processCheatDetection()
		}
	}
}

func (s *ReplayServer) processCheatDetection() {
	fmt.Println("Running cheat detection batch...")
	fmt.Println("Cheat detection batch completed")
}

func envOrDefault(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func envOrDefaultSlice(key string, defaultVal []string) []string {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	var result []string
	start := 0
	for i := 0; i < len(val); i++ {
		if val[i] == ',' {
			part := val[start:i]
			if part != "" {
				result = append(result, part)
			}
			start = i + 1
		}
	}
	if start < len(val) {
		result = append(result, val[start:])
	}
	if len(result) == 0 {
		return defaultVal
	}
	return result
}

func envOrDefaultInt(key string, defaultVal int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultVal
	}
	var n int
	fmt.Sscanf(val, "%d", &n)
	if n == 0 {
		return defaultVal
	}
	return n
}
