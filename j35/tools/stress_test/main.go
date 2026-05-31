package main

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	combat "combat_service/proto"
)

type StressTestConfig struct {
	StateServiceAddr     string
	CollisionServiceAddr string
	DamageServiceAddr    string
	RedisAddr            string
	BotCount             int
	Duration             time.Duration
	SkillRatePerBot      int
}

type Metrics struct {
	TotalSkills       int64
	TotalDamageEvents int64
	TotalLatencyUs    int64
	LatencySamples    int64
	Errors            int64
	startTime         time.Time
	frameCount        int64
}

var metrics Metrics

func main() {
	cfg := StressTestConfig{
		StateServiceAddr:     "localhost:50052",
		CollisionServiceAddr: "localhost:50051",
		DamageServiceAddr:    "localhost:50053",
		RedisAddr:            "localhost:6379",
		BotCount:             2000,
		Duration:             5 * time.Minute,
		SkillRatePerBot:      2,
	}

	fmt.Println("=== MMORPG Combat System Stress Test ===")
	fmt.Printf("Bots: %d, Duration: %v\n", cfg.BotCount, cfg.Duration)
	fmt.Println("Connecting to services...")

	rdb := redis.NewClient(&redis.Options{
		Addr: cfg.RedisAddr,
	})
	defer rdb.Close()

	collisionConn, err := grpc.Dial(cfg.CollisionServiceAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(4*1024*1024)),
	)
	if err != nil {
		fmt.Printf("Collision service connection failed: %v\n", err)
		os.Exit(1)
	}
	defer collisionConn.Close()

	collisionClient := combat.NewCollisionServiceClient(collisionConn)

	damageConn, err := grpc.Dial(cfg.DamageServiceAddr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		fmt.Printf("Damage service connection failed: %v\n", err)
		os.Exit(1)
	}
	defer damageConn.Close()

	damageClient := combat.NewDamageArbiterServiceClient(damageConn)

	fmt.Println("Initializing unit states...")
	unitStates := make([]*combat.UnitState, cfg.BotCount)
	for i := 0; i < cfg.BotCount; i++ {
		angle := rand.Float64() * 2 * math.Pi
		radius := rand.Float64() * 180
		unitStates[i] = &combat.UnitState{
			UnitId: uint64(i + 1),
			Position: &combat.Vector3{
				X: float32(radius * math.Cos(angle)),
				Y: 0,
				Z: float32(radius * math.Sin(angle)),
			},
			Heading: float32(rand.Float64() * 360),
			Hp:      1000,
			MaxHp:   1000,
		}
	}

	fmt.Println("Starting stress test...")
	metrics.startTime = time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), cfg.Duration)
	defer cancel()

	var wg sync.WaitGroup

	fmt.Println("Starting movement simulation workers...")
	for w := 0; w < 8; w++ {
		wg.Add(1)
		go func(workerId int) {
			defer wg.Done()
			unitsPerWorker := cfg.BotCount / 8
			startIdx := workerId * unitsPerWorker
			endIdx := startIdx + unitsPerWorker
			if workerId == 7 {
				endIdx = cfg.BotCount
			}
			simulateMovement(ctx, unitStates[startIdx:endIdx], startIdx)
		}(w)
	}

	fmt.Println("Starting skill cast workers...")
	for w := 0; w < 4; w++ {
		wg.Add(1)
		go func(workerId int) {
			defer wg.Done()
			runSkillGenerator(ctx, workerId, cfg.BotCount, cfg.SkillRatePerBot,
				collisionClient, damageClient, unitStates)
		}(w)
	}

	go printStats(ctx)

	fmt.Println("Press Ctrl+C to stop early")
	wg.Wait()

	printFinalStats()
}

func simulateMovement(ctx context.Context, units []*combat.UnitState, startIdx int) {
	ticker := time.NewTicker(16 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			for _, u := range units {
				moveUnit(u)
			}
			atomic.AddInt64(&metrics.frameCount, 1)
		}
	}
}

func moveUnit(u *combat.UnitState) {
	speed := 5.0
	angle := float64(u.Heading) * math.Pi / 180.0
	dt := 0.016

	u.Position.X += float32(speed * math.Cos(angle) * dt)
	u.Position.Z += float32(speed * math.Sin(angle) * dt)

	bound := float32(200.0)
	if u.Position.X > bound || u.Position.X < -bound {
		u.Heading = 180 - u.Heading
	}
	if u.Position.Z > bound || u.Position.Z < -bound {
		u.Heading = -u.Heading
	}

	u.Position.X = clamp(u.Position.X, -bound, bound)
	u.Position.Z = clamp(u.Position.Z, -bound, bound)

	if rand.Float64() < 0.02 {
		u.Heading = float32(rand.Float64() * 360)
	}
}

func runSkillGenerator(ctx context.Context, workerId, totalBots, ratePerBot int,
	collisionClient combat.CollisionServiceClient,
	damageClient combat.DamageArbiterServiceClient,
	unitStates []*combat.UnitState) {

	interval := time.Second / time.Duration(ratePerBot)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			casterIdx := rand.Intn(totalBots)
			caster := unitStates[casterIdx]

			skillType := combat.SkillType(rand.Intn(4))
			skillRadius := float32(5 + rand.Float64()*15)

			cast := &combat.SkillCast{
				CasterId:  caster.UnitId,
				SkillId:   uint32(1 + rand.Intn(10)),
				SkillType: skillType,
				Origin: &combat.Vector3{
					X: caster.Position.X,
					Y: 0,
					Z: caster.Position.Z,
				},
				Direction: &combat.Vector3{
					X: float32(math.Cos(float64(caster.Heading) * math.Pi / 180)),
					Y: 0,
					Z: float32(math.Sin(float64(caster.Heading) * math.Pi / 180)),
				},
				Range:      float32(15 + rand.Float64()*20),
				Radius:     skillRadius,
				Width:      skillRadius * 0.5,
				Angle:      float32(30 + rand.Float64()*60),
				BaseDamage: int32(50 + rand.Intn(100)),
			}

			start := time.Now()

			collisionReq := &combat.CollisionCheckRequest{
				Cast:  cast,
				Units: unitStates,
			}

			collisionResp, err := collisionClient.CheckCollision(ctx, collisionReq)
			if err != nil {
				atomic.AddInt64(&metrics.Errors, 1)
				continue
			}

			atomic.AddInt64(&metrics.TotalSkills, 1)

			unitMap := make(map[uint64]*combat.UnitState)
			for _, u := range unitStates {
				unitMap[u.UnitId] = u
			}

			damageReq := &combat.DamageArbitrationRequest{
				Hits:       collisionResp.Results,
				Cast:       cast,
				UnitStates: unitMap,
			}

			damageResp, err := damageClient.ArbitrateDamage(ctx, damageReq)
			if err != nil {
				atomic.AddInt64(&metrics.Errors, 1)
				continue
			}

			latencyUs := time.Since(start).Microseconds()
			atomic.AddInt64(&metrics.TotalLatencyUs, latencyUs)
			atomic.AddInt64(&metrics.LatencySamples, 1)
			atomic.AddInt64(&metrics.TotalDamageEvents, int64(len(damageResp.Results)))
		}
	}
}

func printStats(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			elapsed := time.Since(metrics.startTime).Seconds()
			skills := atomic.LoadInt64(&metrics.TotalSkills)
			damages := atomic.LoadInt64(&metrics.TotalDamageEvents)
			samples := atomic.LoadInt64(&metrics.LatencySamples)
			errors := atomic.LoadInt64(&metrics.Errors)
			frames := atomic.LoadInt64(&metrics.frameCount)

			avgLatency := 0.0
			if samples > 0 {
				totalLat := atomic.LoadInt64(&metrics.TotalLatencyUs)
				avgLatency = float64(totalLat) / float64(samples) / 1000.0
			}

			fmt.Printf("\r[%.0fs] Skills: %d (%.0f/s) | Damage: %d | Avg Latency: %.2fms | Errors: %d | Frames: %d",
				elapsed, skills, float64(skills)/elapsed, damages, avgLatency, errors, frames)
		}
	}
}

func printFinalStats() {
	elapsed := time.Since(metrics.startTime).Seconds()
	skills := atomic.LoadInt64(&metrics.TotalSkills)
	damages := atomic.LoadInt64(&metrics.TotalDamageEvents)
	samples := atomic.LoadInt64(&metrics.LatencySamples)
	errors := atomic.LoadInt64(&metrics.Errors)
	frames := atomic.LoadInt64(&metrics.frameCount)

	avgLatency := 0.0
	if samples > 0 {
		totalLat := atomic.LoadInt64(&metrics.TotalLatencyUs)
		avgLatency = float64(totalLat) / float64(samples) / 1000.0
	}

	fmt.Println("\n\n=== FINAL RESULTS ===")
	fmt.Printf("Test Duration: %.2fs\n", elapsed)
	fmt.Printf("Total Skills Cast: %d\n", skills)
	fmt.Printf("Skills per Second: %.2f\n", float64(skills)/elapsed)
	fmt.Printf("Total Damage Events: %d\n", damages)
	fmt.Printf("Average Latency: %.2f ms\n", avgLatency)
	fmt.Printf("Errors: %d\n", errors)
	fmt.Printf("Frame Updates: %d (%.0f FPS)\n", frames, float64(frames)/elapsed)

	if avgLatency < 50 {
		fmt.Println("\n✓ PASS: Average latency < 50ms requirement met!")
	} else {
		fmt.Println("\n✗ FAIL: Average latency exceeds 50ms threshold")
	}
}

func clamp(v, min, max float32) float32 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}
