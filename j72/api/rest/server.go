package rest

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"modbus-fuzzer/core/rules"
)

const (
	RulesChannel = "modbus:fuzz:rules:update"
	APIPath      = "/api/v1"
)

type APIServer struct {
	router      *gin.Engine
	ruleManager *rules.RuleManager
	redisClient *redis.Client
	httpServer  *http.Server
	ctx         context.Context
	cancel      context.CancelFunc
}

type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

func NewAPIServer(ruleManager *rules.RuleManager, redisClient *redis.Client) *APIServer {
	ctx, cancel := context.WithCancel(context.Background())

	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
	router.Use(corsMiddleware())

	srv := &APIServer{
		router:      router,
		ruleManager: ruleManager,
		redisClient: redisClient,
		ctx:         ctx,
		cancel:      cancel,
	}

	srv.setupRoutes()
	return srv
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func (s *APIServer) setupRoutes() {
	api := s.router.Group(APIPath)
	{
		rules := api.Group("/rules")
		{
			rules.GET("", s.listRules)
			rules.POST("", s.createRule)
			rules.GET("/:id", s.getRule)
			rules.PUT("/:id", s.updateRule)
			rules.DELETE("/:id", s.deleteRule)
			rules.POST("/:id/enable", s.enableRule)
			rules.POST("/:id/disable", s.disableRule)
			rules.POST("/broadcast", s.broadcastRules)
		}

		api.GET("/health", s.healthCheck)
	}
}

func (s *APIServer) Start(addr string) error {
	s.httpServer = &http.Server{
		Addr:    addr,
		Handler: s.router,
	}

	log.Printf("[REST API] Starting server on %s", addr)
	go func() {
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("[REST API] Server error: %v", err)
		}
	}()

	go s.listenRuleUpdates()

	return nil
}

func (s *APIServer) Stop() error {
	log.Println("[REST API] Stopping server...")
	s.cancel()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	return s.httpServer.Shutdown(ctx)
}

func (s *APIServer) listenRuleUpdates() {
	pubsub := s.redisClient.Subscribe(s.ctx, RulesChannel)
	defer pubsub.Close()

	ch := pubsub.Channel()
	for {
		select {
		case msg, ok := <-ch:
			if !ok {
				return
			}

			var rule rules.MutationRule
			if err := json.Unmarshal([]byte(msg.Payload), &rule); err != nil {
				log.Printf("[REST API] Failed to parse rule update: %v", err)
				continue
			}

			log.Printf("[REST API] Received rule update: %s", rule.ID)
		case <-s.ctx.Done():
			return
		}
	}
}

func (s *APIServer) listRules(c *gin.Context) {
	rulesList := s.ruleManager.GetAllRules()
	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    rulesList,
	})
}

func (s *APIServer) createRule(c *gin.Context) {
	var rule rules.MutationRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Message: fmt.Sprintf("Invalid request: %v", err),
		})
		return
	}

	if err := s.ruleManager.AddRule(&rule); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	go s.broadcastRuleUpdate(&rule)

	c.JSON(http.StatusCreated, APIResponse{
		Success: true,
		Message: "Rule created successfully",
		Data:    rule,
	})
}

func (s *APIServer) getRule(c *gin.Context) {
	id := c.Param("id")
	rule, exists := s.ruleManager.GetRule(id)
	if !exists {
		c.JSON(http.StatusNotFound, APIResponse{
			Success: false,
			Message: fmt.Sprintf("Rule %s not found", id),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    rule,
	})
}

func (s *APIServer) updateRule(c *gin.Context) {
	id := c.Param("id")

	var rule rules.MutationRule
	if err := c.ShouldBindJSON(&rule); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Message: fmt.Sprintf("Invalid request: %v", err),
		})
		return
	}

	rule.ID = id
	if err := s.ruleManager.UpdateRule(&rule); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	go s.broadcastRuleUpdate(&rule)

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: "Rule updated successfully",
		Data:    rule,
	})
}

func (s *APIServer) deleteRule(c *gin.Context) {
	id := c.Param("id")
	if err := s.ruleManager.DeleteRule(id); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: fmt.Sprintf("Rule %s deleted successfully", id),
	})
}

func (s *APIServer) enableRule(c *gin.Context) {
	id := c.Param("id")
	rule, exists := s.ruleManager.GetRule(id)
	if !exists {
		c.JSON(http.StatusNotFound, APIResponse{
			Success: false,
			Message: fmt.Sprintf("Rule %s not found", id),
		})
		return
	}

	rule.Enabled = true
	s.ruleManager.UpdateRule(rule)
	go s.broadcastRuleUpdate(rule)

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: fmt.Sprintf("Rule %s enabled", id),
		Data:    rule,
	})
}

func (s *APIServer) disableRule(c *gin.Context) {
	id := c.Param("id")
	rule, exists := s.ruleManager.GetRule(id)
	if !exists {
		c.JSON(http.StatusNotFound, APIResponse{
			Success: false,
			Message: fmt.Sprintf("Rule %s not found", id),
		})
		return
	}

	rule.Enabled = false
	s.ruleManager.UpdateRule(rule)
	go s.broadcastRuleUpdate(rule)

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: fmt.Sprintf("Rule %s disabled", id),
		Data:    rule,
	})
}

func (s *APIServer) broadcastRules(c *gin.Context) {
	rulesList := s.ruleManager.GetEnabledRules()
	count := 0
	for _, rule := range rulesList {
		if err := s.broadcastRuleUpdate(rule); err != nil {
			log.Printf("[REST API] Failed to broadcast rule %s: %v", rule.ID, err)
		} else {
			count++
		}
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: fmt.Sprintf("Broadcast %d rules to all workers", count),
	})
}

func (s *APIServer) broadcastRuleUpdate(rule *rules.MutationRule) error {
	data, err := json.Marshal(rule)
	if err != nil {
		return err
	}

	return s.redisClient.Publish(s.ctx, RulesChannel, data).Err()
}

func (s *APIServer) healthCheck(c *gin.Context) {
	redisStatus := "ok"
	if err := s.redisClient.Ping(s.ctx).Err(); err != nil {
		redisStatus = fmt.Sprintf("error: %v", err)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":        "running",
		"rules_count":   len(s.ruleManager.GetAllRules()),
		"redis_status":  redisStatus,
		"timestamp":     time.Now().Unix(),
	})
}
