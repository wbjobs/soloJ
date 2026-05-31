package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"time"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	"github.com/dcdn/api/internal/config"
	"github.com/dcdn/api/internal/dao"
	"github.com/dcdn/api/internal/health"
	nodehandler "github.com/dcdn/api/internal/node"
	"github.com/dcdn/api/internal/raft"
	schedhandler "github.com/dcdn/api/internal/scheduler"
)

func main() {
	cfg := config.Load()
	log.Printf("[dcdn] starting: node_id=%s region=%s", cfg.RaftNodeID, cfg.Region)

	store, err := dao.NewStore(cfg.TiDBDSN)
	if err != nil {
		log.Fatalf("init tidb: %v", err)
	}
	defer store.Close()

	scorer := health.NewEloVariantScorer(store)

	// Raft 状态机 applyFn：将黑板报应用到本地评分表
	// 幂等保护：同一 (node_id, version) 只落库一次，避免 ApplyFn 被重复触发导致评分累加
	appliedSet := make(map[string]struct{})
	applyFn := func(e raft.LogEntry) error {
		switch e.Type {
		case "score_update":
			var sh dao.ScoreHistory
			if err := json.Unmarshal(e.Payload, &sh); err != nil {
				return err
			}
			key := fmt.Sprintf("score:%s:%d", sh.NodeID, sh.Version)
			if _, ok := appliedSet[key]; ok {
				return nil
			}
			appliedSet[key] = struct{}{}
			return store.SaveScore(context.Background(), &sh)
		case "heritage_transfer":
			var ht struct {
				From  string   `json:"from"`
				Total float64  `json:"total"`
				To    []string `json:"to"`
				TS    int64    `json:"ts"`
			}
			if err := json.Unmarshal(e.Payload, &ht); err != nil {
				return err
			}
			key := fmt.Sprintf("heritage:%s:%d", ht.From, ht.TS)
			if _, ok := appliedSet[key]; ok {
				return nil
			}
			appliedSet[key] = struct{}{}
			return scorer.TransferHeritage(context.Background(), ht.From, ht.Total, ht.To)
		}
		return nil
	}
	rn := raft.NewRaftNode(cfg.RaftNodeID, cfg.RaftCluster, store, applyFn)
	// 启动 Raft 心跳/选举驱动循环
	rn.StartTicker()
	defer rn.Stop()

	// HTTP 路由（节点管理 + 调度）
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger())
	sch := schedhandler.New(store)
	nodehandler.NewHandler(store, cfg.HeartbeatTTL).Register(r)
	schedhandler.NewHTTPHandler(sch).Register(r)
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"node":       cfg.RaftNodeID,
			"role":       rn.Role(),
			"term":       rn.Term(),
			"commit_idx": rn.Commit(),
			"ts":         time.Now(),
		})
	})

	// gRPC 服务器
	grpcSrv := grpc.NewServer()
	reflection.Register(grpcSrv)
	// 此处可扩展接入 proto 生成的 pb dcdnpb.RegisterEdgeNodeServiceServer(...)
	// 为了纯演示无编译依赖，留占位 hook
	log.Printf("[dcdn] gRPC placeholder listening on %s", cfg.GRPCAddr)

	// 启动 HTTP
	httpSrv := &http.Server{Addr: cfg.NodeManagerAddr, Handler: r}
	go func() {
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("http: %v", err)
		}
	}()
	go func() {
		lis, err := net.Listen("tcp", cfg.GRPCAddr)
		if err != nil {
			log.Fatalf("grpc listen: %v", err)
		}
		if err := grpcSrv.Serve(lis); err != nil {
			log.Fatalf("grpc serve: %v", err)
		}
	}()

	// 心跳超时清理 + 自动遗产转移
	go startHeritageMonitor(store, scorer, cfg.HeartbeatTTL)

	// 优雅关闭
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(ctx)
	grpcSrv.GracefulStop()
	log.Println("[dcdn] stopped")
}

// startHeritageMonitor 定期扫描超时节点，将其 Elo 遗产转移给存活节点
func startHeritageMonitor(store *dao.Store, scorer *health.EloVariantScorer, ttl time.Duration) {
	t := time.NewTicker(ttl)
	defer t.Stop()
	for range t.C {
		ctx := context.Background()
		all, _ := store.ListAllNodes(ctx)
		var evicted, survivors []string
		cutoff := time.Now().Add(-ttl * 3)
		for _, n := range all {
			if n.LastHeartbeat.Before(cutoff) && n.Status != "evicted" {
				evicted = append(evicted, n.ID)
				_ = store.SetNodeStatus(ctx, n.ID, "evicted")
			} else if n.Status == "online" {
				survivors = append(survivors, n.ID)
			}
		}
		for _, id := range evicted {
			sh, err := store.LatestScore(ctx, id)
			if err != nil || sh == nil {
				continue
			}
			log.Printf("[heritage] transferring %s elo=%.2f to %d nodes", id, sh.Elo, len(survivors))
			_ = scorer.TransferHeritage(ctx, id, sh.Elo, survivors)
		}
	}
}
