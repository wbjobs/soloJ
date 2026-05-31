package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"state_service/ecs"
	grpcSrv "state_service/grpc"
	"state_service/store"
)

func main() {
	redisAddr := envOrDefault("REDIS_ADDR", "localhost:6379")
	cassandraHosts := envOrDefaultSlice("CASSANDRA_HOSTS", []string{"localhost"})
	grpcAddr := envOrDefault("GRPC_ADDR", ":50051")
	tickRate := 60

	redisStore, err := store.NewRedisStore(store.RedisConfig{
		Addr:     redisAddr,
		Password: envOrDefault("REDIS_PASSWORD", ""),
		DB:       0,
		TTL:      30 * time.Minute,
	})
	if err != nil {
		fmt.Printf("Redis init failed: %v, continuing without redis\n", err)
	}

	var cassStore *store.CassandraStore
	cassStore, err = store.NewCassandraStore(store.CassandraConfig{
		Hosts:       cassandraHosts,
		Keyspace:    "state_service",
		Consistency: envOrDefault("CASSANDRA_CONSISTENCY", "quorum"),
	})
	if err != nil {
		fmt.Printf("Cassandra init failed: %v, continuing without cassandra\n", err)
		cassStore = nil
	}

	world := ecs.NewWorld()

	world.RegisterSystem(ecs.NewMovementSystem())
	world.RegisterSystem(ecs.NewHealthSystem())
	world.RegisterSystem(ecs.NewBuffSystem())
	world.RegisterSystem(ecs.NewCooldownSystem())

	server := grpcSrv.NewStateServer(grpcSrv.ServerConfig{
		ListenAddr:  grpcAddr,
		RedisStore:  redisStore,
		CassStore:   cassStore,
		World:      world,
		KafkaBroker: envOrDefault("KAFKA_BROKERS", ""),
	})

	go func() {
		if err := server.Start(grpcAddr); err != nil {
			fmt.Printf("gRPC server error: %v\n", err)
			os.Exit(1)
		}
	}()

	ticker := time.NewTicker(time.Duration(1000/tickRate) * time.Millisecond)
	defer ticker.Stop()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	fmt.Printf("State service started: grpc=%s tick_rate=%d\n", grpcAddr, tickRate)

	for {
		select {
		case <-ticker.C:
			dt := 1.0 / float64(tickRate)
			server.Tick(dt)
		case sig := <-sigCh:
			fmt.Printf("Received signal %v, shutting down...\n", sig)
			server.Stop()
			if redisStore != nil {
				redisStore.Close()
			}
			if cassStore != nil {
				cassStore.Close()
			}
			return
		}
	}
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
	for _, s := range splitByComma(val) {
		if s != "" {
			result = append(result, s)
		}
	}
	if len(result) == 0 {
		return defaultVal
	}
	return result
}

func splitByComma(s string) []string {
	var parts []string
	start := 0
	for i := 0; i < len(s); i++ {
		if s[i] == ',' {
			parts = append(parts, s[start:i])
			start = i + 1
		}
	}
	parts = append(parts, s[start:])
	return parts
}
