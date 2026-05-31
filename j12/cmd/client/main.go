package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"time"

	"github.com/fcnet/func-compute/types"
	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/network"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/p2p/discovery/mdns"
	"go.uber.org/zap"
)

var (
	function  = flag.String("f", "math:1.0.0", "function ID to call")
	operation = flag.String("op", "add", "operation for math function")
	a         = flag.Float64("a", 0, "first number")
	b         = flag.Float64("b", 0, "second number")
	timeout   = flag.Duration("timeout", 30*time.Second, "request timeout")
)

type Client struct {
	host   host.Host
	logger *zap.Logger
	nodes  map[peer.ID]peer.AddrInfo
}

func main() {
	flag.Parse()

	logger, _ := zap.NewProduction()
	defer logger.Sync()

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	h, err := libp2p.New(libp2p.ListenAddrStrings("/ip4/0.0.0.0/tcp/0"))
	if err != nil {
		logger.Fatal("failed to create host", zap.Error(err))
	}
	defer h.Close()

	logger.Info("client started", zap.String("peer_id", h.ID().String()))

	client := &Client{
		host:   h,
		logger: logger,
		nodes:  make(map[peer.ID]peer.AddrInfo),
	}

	mdnsService := mdns.NewMdnsService(h, "fcnet-func-compute", &mdnsNotifee{client: client})
	if err := mdnsService.Start(); err != nil {
		logger.Warn("mDNS start failed", zap.Error(err))
	}
	defer mdnsService.Stop()

	logger.Info("discovering nodes...")
	time.Sleep(2 * time.Second)

	if len(client.nodes) == 0 {
		logger.Fatal("no nodes found")
	}

	var target peer.ID
	for id := range client.nodes {
		target = id
		break
	}
	logger.Info("using node", zap.String("target", target.String()))

	input := map[string]interface{}{
		"operation": *operation,
		"a":         *a,
		"b":         *b,
	}

	task := &types.Task{
		FunctionID: types.FunctionID(*function),
		Input:      input,
		Submitter:  h.ID(),
		Priority:   1,
		MaxRetries: 3,
	}

	result, err := client.submitTask(ctx, target, task)
	if err != nil {
		logger.Fatal("task failed", zap.Error(err))
	}

	fmt.Printf("Result: %+v\n", result)
	if result.Success {
		fmt.Printf("Output: %v\n", result.Output["result"])
	} else {
		fmt.Printf("Error: %s\n", result.Error)
	}
}

type mdnsNotifee struct {
	client *Client
}

func (m *mdnsNotifee) HandlePeerFound(pi peer.AddrInfo) {
	m.client.logger.Info("found node", zap.String("peer", pi.ID.String()))
	m.client.nodes[pi.ID] = pi
	if err := m.client.host.Connect(context.Background(), pi); err != nil {
		m.client.logger.Warn("failed to connect", zap.Error(err))
	}
}

func (c *Client) submitTask(ctx context.Context, target peer.ID, task *types.Task) (*types.TaskResult, error) {
	s, err := c.host.NewStream(ctx, target, "/fcnet/task/1.0.0")
	if err != nil {
		return nil, fmt.Errorf("create stream: %w", err)
	}
	defer s.Close()

	msg := map[string]interface{}{
		"type":    "task_submit",
		"payload": task,
	}
	if err := json.NewEncoder(s).Encode(msg); err != nil {
		return nil, fmt.Errorf("send task: %w", err)
	}

	resultCh := make(chan *types.TaskResult, 1)
	c.host.SetStreamHandler("/fcnet/result/1.0.0", func(s network.Stream) {
		defer s.Close()
		var msg map[string]json.RawMessage
		if err := json.NewDecoder(s).Decode(&msg); err != nil {
			c.logger.Warn("decode result failed", zap.Error(err))
			return
		}
		var result types.TaskResult
		if err := json.Unmarshal(msg["payload"], &result); err != nil {
			c.logger.Warn("unmarshal result failed", zap.Error(err))
			return
		}
		resultCh <- &result
	})

	select {
	case result := <-resultCh:
		return result, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}
