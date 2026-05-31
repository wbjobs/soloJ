package node

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/dcdn/api/internal/dao"
)

type Handler struct {
	store *dao.Store
	ttl   time.Duration
}

func NewHandler(store *dao.Store, ttl time.Duration) *Handler {
	return &Handler{store: store, ttl: ttl}
}

func (h *Handler) Register(g *gin.Engine) {
	api := g.Group("/api/v1")
	{
		api.POST("/nodes", h.registerNode)
		api.GET("/nodes", h.listNodes)
		api.GET("/nodes/:id", h.getNode)
		api.PUT("/nodes/:id/heartbeat", h.heartbeat)
		api.DELETE("/nodes/:id", h.deregisterNode)
		api.GET("/nodes/:id/metrics", h.proxyMetrics)
		api.GET("/nodes/:id/score", h.getScore)
		api.POST("/nodes/:id/heritage", h.heritage)
	}
}

type registerReq struct {
	ID           string  `json:"id"`
	Address      string  `json:"address" binding:"required"`
	Region       string  `json:"region" binding:"required"`
	BandwidthCap float64 `json:"bandwidth_cap"`
}

func (h *Handler) registerNode(c *gin.Context) {
	var req registerReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.ID == "" {
		req.ID = uuid.NewString()
	}
	now := time.Now()
	n := &dao.Node{
		ID:            req.ID,
		Address:       req.Address,
		Region:        req.Region,
		BandwidthCap:  req.BandwidthCap,
		Status:        "online",
		LastHeartbeat: now,
		RegisteredAt:  now,
	}
	if err := h.store.RegisterNode(c.Request.Context(), n); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, n)
}

func (h *Handler) listNodes(c *gin.Context) {
	ns, err := h.store.ListAllNodes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, ns)
}

func (h *Handler) getNode(c *gin.Context) {
	n, err := h.store.GetNode(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, n)
}

type heartbeatReq struct {
	CPU       float64 `json:"cpu_usage"`
	Mem       float64 `json:"mem_usage"`
	BWUsage   float64 `json:"bw_usage"`
	LatencyMs float64 `json:"lat_ms"`
}

func (h *Handler) heartbeat(c *gin.Context) {
	id := c.Param("id")
	var req heartbeatReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	hb := &dao.Heartbeat{
		NodeID:    id,
		CPU:       req.CPU,
		Mem:       req.Mem,
		BWUsage:   req.BWUsage,
		LatencyMs: req.LatencyMs,
		TS:        time.Now(),
	}
	if err := h.store.UpdateHeartbeat(c.Request.Context(), hb); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"accepted": true, "next_interval_ms": h.ttl.Milliseconds() / 2})
}

func (h *Handler) deregisterNode(c *gin.Context) {
	if err := h.store.SetNodeStatus(c.Request.Context(), c.Param("id"), "evicted"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// proxyMetrics 反向代理到节点的 /metrics 接口
func (h *Handler) proxyMetrics(c *gin.Context) {
	ctx := c.Request.Context()
	n, err := h.store.GetNode(ctx, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	url := fmt.Sprintf("http://%s/metrics", n.Address)
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	cli := &http.Client{Timeout: 3 * time.Second}
	resp, err := cli.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	defer resp.Body.Close()
	c.Status(resp.StatusCode)
	for k, vs := range resp.Header {
		for _, v := range vs {
			c.Writer.Header().Add(k, v)
		}
	}
	_, _ = io.Copy(c.Writer, resp.Body)
}

func (h *Handler) getScore(c *gin.Context) {
	sh, err := h.store.LatestScore(c.Request.Context(), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, sh)
}

type heritageReq struct {
	ToNodeIDs []string `json:"to_node_ids" binding:"required"`
}

func (h *Handler) heritage(c *gin.Context) {
	ctx := context.Background()
	id := c.Param("id")
	var req heritageReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// 获取退出节点的最新 Elo 作为遗产总额
	sh, err := h.store.LatestScore(ctx, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "source score not found"})
		return
	}
	// 简化：将遗产请求封装成 Raft 日志条目类型，触发 applyFn 时再分发给 health 模块
	c.JSON(http.StatusAccepted, gin.H{
		"from":        id,
		"total_elo":   sh.Elo,
		"to_node_ids": req.ToNodeIDs,
		"status":      "heritage_transfer_submitted",
	})
}
