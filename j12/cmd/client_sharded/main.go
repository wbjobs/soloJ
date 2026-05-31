package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"math/rand"
	"strings"
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
	function   = flag.String("f", "wordcount:1.0.0", "function ID to call")
	textLines  = flag.Int("lines", 1000, "number of text lines to generate")
	timeout    = flag.Duration("timeout", 120*time.Second, "request timeout")
	watch      = flag.Bool("watch", true, "watch progress of sharded task")
	sharded    = flag.Bool("sharded", true, "force sharded execution")
)

type Client struct {
	host    host.Host
	logger  *zap.Logger
	nodes   map[peer.ID]peer.AddrInfo
	resultCh chan *types.TaskResult
}

func main() {
	flag.Parse()

	logger, _ := zap.NewProductionConfig().Build()
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
		host:     h,
		logger:   logger,
		nodes:    make(map[peer.ID]peer.AddrInfo),
		resultCh: make(chan *types.TaskResult, 100),
	}

	mdnsService := mdns.NewMdnsService(h, "fcnet-func-compute", &mdnsNotifee{client: client})
	if err := mdnsService.Start(); err != nil {
		logger.Warn("mDNS start failed", zap.Error(err))
	}
	defer mdnsService.Stop()

	h.SetStreamHandler("/fcnet/result/1.0.0", client.handleResult)
	h.SetStreamHandler("/fcnet/task/1.0.0", client.handleStatusUpdate)

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

	var input map[string]interface{}
	switch *function {
	case "wordcount:1.0.0":
		input = generateWordCountInput(*textLines)
	case "math:1.0.0":
		input = generateBatchMathInput(*textLines)
	default:
		input = map[string]interface{}{
			"data": []interface{}{"hello world", "hello go"},
		}
	}

	task := &types.Task{
		FunctionID: types.FunctionID(*function),
		Input:      input,
		Submitter:  h.ID(),
		Priority:   1,
		MaxRetries: 3,
		IsSharded:  *sharded,
	}

	logger.Info("submitting task",
		zap.String("function", *function),
		zap.Int("data_size", len(input["data"].([]interface{}))))

	taskID, err := client.submitTask(ctx, target, task)
	if err != nil {
		logger.Fatal("failed to submit task", zap.Error(err))
	}

	logger.Info("task submitted", zap.String("task_id", string(taskID)))

	if *watch && *sharded {
		go client.watchProgress(ctx, target, taskID)
	}

	select {
	case result := <-client.resultCh:
		fmt.Println("\n=== Task Complete ===")
		printResult(result)
	case <-ctx.Done():
		fmt.Println("\n=== Timeout ===")
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

func (c *Client) submitTask(ctx context.Context, target peer.ID, task *types.Task) (types.TaskID, error) {
	task.ID = types.NewTaskID()
	task.CreatedAt = time.Now()

	s, err := c.host.NewStream(ctx, target, "/fcnet/task/1.0.0")
	if err != nil {
		return "", fmt.Errorf("create stream: %w", err)
	}
	defer s.Close()

	msg := map[string]interface{}{
		"type":    "task_submit",
		"payload": task,
	}
	if err := json.NewEncoder(s).Encode(msg); err != nil {
		return "", fmt.Errorf("send task: %w", err)
	}

	return task.ID, nil
}

func (c *Client) handleResult(s network.Stream) {
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

	c.logger.Info("received result", zap.String("task_id", string(result.TaskID)))
	select {
	case c.resultCh <- &result:
	default:
	}
}

func (c *Client) handleStatusUpdate(s network.Stream) {
	defer s.Close()

	var msg map[string]json.RawMessage
	if err := json.NewDecoder(s).Decode(&msg); err != nil {
		return
	}

	msgType, _ := msg["type"]
	if string(msgType) == `"task_status"` {
		var payload types.TaskResult
		if err := json.Unmarshal(msg["payload"], &payload); err != nil {
			return
		}
		c.logger.Debug("status update", zap.String("task_id", string(payload.TaskID)))
	}
}

func (c *Client) watchProgress(ctx context.Context, target peer.ID, taskID types.TaskID) {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	fmt.Println("\n=== Watching Progress ===")

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			progress, err := c.queryProgress(ctx, target, taskID)
			if err != nil {
				c.logger.Debug("query progress failed", zap.Error(err))
				continue
			}

			if progress != nil {
				printProgress(progress)
				if progress.Progress >= 1.0 {
					return
				}
			}
		}
	}
}

func (c *Client) queryProgress(ctx context.Context, target peer.ID, taskID types.TaskID) (*types.ShardedTaskProgress, error) {
	s, err := c.host.NewStream(ctx, target, "/fcnet/task/1.0.0")
	if err != nil {
		return nil, fmt.Errorf("create stream: %w", err)
	}
	defer s.Close()

	msg := map[string]interface{}{
		"type": "status_query",
		"payload": map[string]interface{}{
			"task_id": taskID,
		},
	}
	if err := json.NewEncoder(s).Encode(msg); err != nil {
		return nil, fmt.Errorf("send query: %w", err)
	}

	var resp map[string]json.RawMessage
	if err := json.NewDecoder(s).Decode(&resp); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	var response struct {
		ShardedProgress *types.ShardedTaskProgress `json:"sharded_progress"`
	}
	if err := json.Unmarshal(resp["payload"], &response); err != nil {
		return nil, nil
	}

	return response.ShardedProgress, nil
}

func printProgress(p *types.ShardedTaskProgress) {
	barWidth := 30
	filled := int(p.Progress * float64(barWidth))
	bar := strings.Repeat("█", filled) + strings.Repeat("░", barWidth-filled)

	fmt.Printf("\rProgress: [%s] %.1f%% | %d/%d | Pending:%d Running:%d Completed:%d Failed:%d",
		bar,
		p.Progress*100,
		p.Completed+p.Failed,
		p.TotalShards,
		p.Pending,
		p.InProgress,
		p.Completed,
		p.Failed)
}

func printResult(result *types.TaskResult) {
	fmt.Printf("Task ID: %s\n", result.TaskID)
	fmt.Printf("Success: %v\n", result.Success)
	if result.Error != "" {
		fmt.Printf("Error: %s\n", result.Error)
		return
	}
	fmt.Printf("Duration: %v\n", result.FinishedAt.Sub(result.StartedAt))
	fmt.Printf("Executor: %s\n", result.Executor)
	fmt.Printf("Output:\n")

	if data, ok := result.Output["map"]; ok {
		if counts, ok := data.(map[string]interface{}); ok {
			fmt.Printf("  Total Words: %d\n", int(result.Output["total_words"].(float64)))
			fmt.Printf("  Unique Words: %d\n", len(counts))
			fmt.Println("  Top 10 words:")

			type wordCount struct {
				word  string
				count int
			}
			wcs := make([]wordCount, 0, len(counts))
			for w, c := range counts {
				wcs = append(wcs, wordCount{w, int(c.(float64))})
			}
			for i := 0; i < 10 && i < len(wcs); i++ {
				fmt.Printf("    %s: %d\n", wcs[i].word, wcs[i].count)
			}
			return
		}
	}

	if sum, ok := result.Output["sum"]; ok {
		fmt.Printf("  Sum: %v\n", sum)
	}
	if total, ok := result.Output["total"]; ok {
		fmt.Printf("  Total: %v\n", total)
	}
	if average, ok := result.Output["average"]; ok {
		fmt.Printf("  Average: %v\n", average)
	}
	if count, ok := result.Output["count"]; ok {
		fmt.Printf("  Count: %v\n", count)
	}
	if shardCount, ok := result.Output["shard_count"]; ok {
		fmt.Printf("  Shards: %v\n", shardCount)
	}

	fmt.Printf("  Full output: %+v\n", result.Output)
}

func generateWordCountInput(lines int) map[string]interface{} {
	words := []string{
		"hello", "world", "go", "programming", "language",
		"code", "data", "compute", "function", "distributed",
		"system", "network", "p2p", "libp2p", "task",
		"scheduler", "worker", "node", "cluster", "parallel",
	}

	data := make([]interface{}, 0, lines)
	for i := 0; i < lines; i++ {
		lineWords := make([]string, 0, 10)
		for j := 0; j < 10; j++ {
			lineWords = append(lineWords, words[rand.Intn(len(words))])
		}
		data = append(data, strings.Join(lineWords, " "))
	}

	return map[string]interface{}{
		"data":           data,
		"case_sensitive": false,
	}
}

func generateBatchMathInput(count int) map[string]interface{} {
	data := make([]interface{}, 0, count)
	for i := 0; i < count; i++ {
		data = append(data, map[string]interface{}{
			"operation": "add",
			"a":         rand.Float64() * 100,
			"b":         rand.Float64() * 100,
		})
	}

	return map[string]interface{}{
		"data": data,
	}
}
