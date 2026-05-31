package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"fastproto/protocol"
)

const (
	listenAddr            = ":8888"
	apiURL                = "https://jsonplaceholder.typicode.com/posts"
	maxConcurrent         = 100
	readTimeout           = 30 * time.Second
	writeTimeout          = 30 * time.Second
	httpTimeout           = 15 * time.Second
	responseHeaderTimeout = 10 * time.Second
	maxResponseBodySize   = 5 * 1024 * 1024
	cacheTTL              = 10 * time.Second
	cacheCleanInterval    = 30 * time.Second
)

type QueryRequest struct {
	UserID int    `json:"user_id"`
	Query  string `json:"query"`
}

type cacheEntry struct {
	data    []byte
	expires time.Time
}

var (
	connSem     = make(chan struct{}, maxConcurrent)
	activeConn  int64
	cacheHits   int64
	cacheMisses int64
	cache       sync.Map
	httpClient  = &http.Client{
		Timeout: httpTimeout,
		Transport: &http.Transport{
			MaxConnsPerHost:       maxConcurrent,
			MaxIdleConns:          maxConcurrent,
			MaxIdleConnsPerHost:   maxConcurrent,
			IdleConnTimeout:       90 * time.Second,
			ResponseHeaderTimeout: responseHeaderTimeout,
		},
	}
)

func main() {
	go startCacheCleaner()

	listener, err := net.Listen("tcp", listenAddr)
	if err != nil {
		log.Fatalf("Failed to listen on %s: %v", listenAddr, err)
	}
	defer listener.Close()

	log.Printf("TCP server listening on %s, max concurrent connections: %d, cache TTL: %v",
		listenAddr, maxConcurrent, cacheTTL)

	for {
		conn, err := listener.Accept()
		if err != nil {
			log.Printf("Accept error: %v", err)
			continue
		}

		select {
		case connSem <- struct{}{}:
		default:
			log.Printf("Max concurrent connections reached, rejecting %s", conn.RemoteAddr())
			conn.Close()
			continue
		}

		atomic.AddInt64(&activeConn, 1)
		go handleConnection(conn)
	}
}

func startCacheCleaner() {
	ticker := time.NewTicker(cacheCleanInterval)
	defer ticker.Stop()

	for range ticker.C {
		cleanExpiredCache()
	}
}

func cleanExpiredCache() {
	now := time.Now()
	removed := 0

	cache.Range(func(key, value interface{}) bool {
		entry := value.(*cacheEntry)
		if now.After(entry.expires) {
			cache.Delete(key)
			removed++
		}
		return true
	})

	if removed > 0 {
		log.Printf("Cache cleanup: removed %d expired entries", removed)
	}
}

func getCacheKey(userID int, query string) string {
	return fmt.Sprintf("%d:%s", userID, query)
}

func handleConnection(conn net.Conn) {
	defer func() {
		<-connSem
		atomic.AddInt64(&activeConn, -1)
		conn.Close()
	}()

	remoteAddr := conn.RemoteAddr().String()
	log.Printf("New connection from %s (active: %d)", remoteAddr, atomic.LoadInt64(&activeConn))

	for {
		conn.SetReadDeadline(time.Now().Add(readTimeout))
		pkt, err := protocol.Decode(conn)
		if err != nil {
			if err != io.EOF {
				log.Printf("Decode error from %s: %v", remoteAddr, err)
			}
			break
		}

		respPayload, reqErr := handlePacket(pkt, remoteAddr)

		if reqErr != nil {
			errResp := map[string]string{"error": reqErr.Error()}
			respPayload, _ = json.Marshal(errResp)
		}

		respPkt := protocol.NewQueryResponse(respPayload)
		respData, encErr := protocol.Encode(respPkt)
		if encErr != nil {
			log.Printf("Encode error for %s: %v", remoteAddr, encErr)
			continue
		}

		conn.SetWriteDeadline(time.Now().Add(writeTimeout))
		if _, err := conn.Write(respData); err != nil {
			log.Printf("Write error to %s: %v", remoteAddr, err)
			break
		}
	}

	log.Printf("Connection closed from %s (active: %d)", remoteAddr, atomic.LoadInt64(&activeConn))
}

func handlePacket(pkt *protocol.Packet, remoteAddr string) ([]byte, error) {
	switch pkt.CmdID {
	case protocol.CmdQueryReq:
		return processQuery(pkt.Payload)
	default:
		log.Printf("Unknown command ID 0x%02X from %s", pkt.CmdID, remoteAddr)
		return nil, fmt.Errorf("unknown command ID: 0x%02X", pkt.CmdID)
	}
}

func processQuery(payload []byte) ([]byte, error) {
	var req QueryRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		return nil, fmt.Errorf("invalid payload: %w", err)
	}

	cacheKey := getCacheKey(req.UserID, req.Query)
	if entry, ok := cache.Load(cacheKey); ok {
		cached := entry.(*cacheEntry)
		if time.Now().Before(cached.expires) {
			atomic.AddInt64(&cacheHits, 1)
			log.Printf("Cache hit: user_id=%d, query=%s (hits=%d, misses=%d)",
				req.UserID, req.Query, atomic.LoadInt64(&cacheHits), atomic.LoadInt64(&cacheMisses))
			return cached.data, nil
		}
		cache.Delete(cacheKey)
	}

	atomic.AddInt64(&cacheMisses, 1)
	log.Printf("Cache miss: user_id=%d, query=%s (hits=%d, misses=%d)",
		req.UserID, req.Query, atomic.LoadInt64(&cacheHits), atomic.LoadInt64(&cacheMisses))

	ctx, cancel := context.WithTimeout(context.Background(), httpTimeout)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create http request: %w", err)
	}

	q := httpReq.URL.Query()
	q.Set("userId", fmt.Sprintf("%d", req.UserID))
	q.Set("q", req.Query)
	httpReq.URL.RawQuery = q.Encode()

	httpResp, err := httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode < 200 || httpResp.StatusCode >= 300 {
		return nil, fmt.Errorf("http status: %d", httpResp.StatusCode)
	}

	limitedReader := io.LimitReader(httpResp.Body, maxResponseBodySize)
	body, err := io.ReadAll(limitedReader)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	cache.Store(cacheKey, &cacheEntry{
		data:    body,
		expires: time.Now().Add(cacheTTL),
	})

	return body, nil
}
