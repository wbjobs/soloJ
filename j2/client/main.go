package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"fastproto/protocol"
)

var (
	serverAddr = flag.String("addr", "127.0.0.1:8888", "server address")
	concurrent = flag.Int("c", 100, "concurrent connections")
	totalReq   = flag.Int("n", 1000, "total requests")
)

type ClientRequest struct {
	UserID int    `json:"user_id"`
	Query  string `json:"query"`
}

type Stats struct {
	success    int64
	fail       int64
	totalLatency int64
	minLatency int64
	maxLatency int64
}

func main() {
	flag.Parse()

	log.Printf("Starting test client: addr=%s, concurrent=%d, total=%d",
		*serverAddr, *concurrent, *totalReq)

	stats := &Stats{
		minLatency: int64(time.Hour),
	}

	var wg sync.WaitGroup
	ch := make(chan int, *concurrent)
	startTime := time.Now()

	for i := 0; i < *concurrent; i++ {
		wg.Add(1)
		go worker(i, ch, stats, &wg)
	}

	for i := 0; i < *totalReq; i++ {
		ch <- i
	}
	close(ch)

	wg.Wait()
	totalTime := time.Since(startTime)

	qps := float64(stats.success) / totalTime.Seconds()
	avgLatency := time.Duration(0)
	if stats.success > 0 {
		avgLatency = time.Duration(stats.totalLatency / stats.success)
	}

	fmt.Println("\n========== Test Results ==========")
	fmt.Printf("Total Requests:  %d\n", *totalReq)
	fmt.Printf("Success:         %d\n", stats.success)
	fmt.Printf("Failed:          %d\n", stats.fail)
	fmt.Printf("Total Time:      %v\n", totalTime)
	fmt.Printf("QPS:             %.2f\n", qps)
	fmt.Printf("Avg Latency:     %v\n", avgLatency)
	fmt.Printf("Min Latency:     %v\n", time.Duration(stats.minLatency))
	fmt.Printf("Max Latency:     %v\n", time.Duration(stats.maxLatency))
	fmt.Println("==================================")
}

func worker(id int, ch <-chan int, stats *Stats, wg *sync.WaitGroup) {
	defer wg.Done()

	conn, err := net.DialTimeout("tcp", *serverAddr, 5*time.Second)
	if err != nil {
		log.Printf("Worker %d: failed to connect: %v", id, err)
		return
	}
	defer conn.Close()

	for reqID := range ch {
		start := time.Now()
		err := sendRequest(conn, reqID)
		latency := time.Since(start).Nanoseconds()

		if err != nil {
			atomic.AddInt64(&stats.fail, 1)
			log.Printf("Worker %d, req %d: error: %v", id, reqID, err)
			conn.Close()
			conn, err = net.DialTimeout("tcp", *serverAddr, 5*time.Second)
			if err != nil {
				log.Printf("Worker %d: reconnect failed: %v", id, err)
				return
			}
			continue
		}

		atomic.AddInt64(&stats.success, 1)
		atomic.AddInt64(&stats.totalLatency, latency)

		for {
			curMin := atomic.LoadInt64(&stats.minLatency)
			if latency >= curMin || atomic.CompareAndSwapInt64(&stats.minLatency, curMin, latency) {
				break
			}
		}

		for {
			curMax := atomic.LoadInt64(&stats.maxLatency)
			if latency <= curMax || atomic.CompareAndSwapInt64(&stats.maxLatency, curMax, latency) {
				break
			}
		}
	}
}

func sendRequest(conn net.Conn, reqID int) error {
	req := ClientRequest{
		UserID: (reqID % 10) + 1,
		Query:  fmt.Sprintf("search_%d", reqID),
	}
	payload, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	pkt := protocol.NewQueryRequest(payload)
	data, err := protocol.Encode(pkt)
	if err != nil {
		return fmt.Errorf("encode: %w", err)
	}

	conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	if _, err := conn.Write(data); err != nil {
		return fmt.Errorf("write: %w", err)
	}

	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	resp, err := protocol.Decode(conn)
	if err != nil {
		return fmt.Errorf("decode: %w", err)
	}

	if resp.CmdID != protocol.CmdQueryResp {
		return fmt.Errorf("unexpected cmd id: 0x%02X", resp.CmdID)
	}

	return nil
}
