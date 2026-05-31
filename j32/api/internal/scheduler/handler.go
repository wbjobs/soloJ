package scheduler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type HTTPHandler struct {
	sch *Scheduler
}

func NewHTTPHandler(sch *Scheduler) *HTTPHandler {
	return &HTTPHandler{sch: sch}
}

func (h *HTTPHandler) Register(g *gin.Engine) {
	api := g.Group("/api/v1")
	{
		api.POST("/schedule", h.schedule)
		api.POST("/schedule/feedback", h.feedback)
		api.GET("/schedule/weights", h.currentWeights)
	}
}

type scheduleReq struct {
	FileHash     string `json:"file_hash" binding:"required"`
	ClientRegion string `json:"client_region"`
	TopK         int    `json:"top_k"`
	Strategy     string `json:"strategy"` // random_weight | deterministic | adaptive
}

func (h *HTTPHandler) schedule(c *gin.Context) {
	var req scheduleReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.TopK <= 0 {
		req.TopK = 3
	}
	if req.Strategy == "" {
		req.Strategy = "deterministic"
	}
	result, err := h.sch.Select(c.Request.Context(), req.FileHash, req.ClientRegion, req.TopK, req.Strategy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

type feedbackReq struct {
	FileHash       string  `json:"file_hash" binding:"required"`
	NodeID         string  `json:"node_id" binding:"required"`
	DownloadSpeed  float64 `json:"download_speed"`
	ResponseTimeMs float64 `json:"response_time_ms"`
	Success        bool    `json:"success"`
}

func (h *HTTPHandler) feedback(c *gin.Context) {
	var req feedbackReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.sch.RecordFeedback(c.Request.Context(), req.FileHash, req.NodeID, req.DownloadSpeed, req.ResponseTimeMs, req.Success); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true, "message": "feedback recorded, Q-learning updated"})
}

func (h *HTTPHandler) currentWeights(c *gin.Context) {
	w := h.sch.QL().CurrentWeights()
	c.JSON(http.StatusOK, gin.H{
		"weights":     w,
		"epsilon":     h.sch.QL().Epsilon(),
		"avg_reward":  h.sch.QL().AvgReward(),
		"actions":     Actions,
	})
}
