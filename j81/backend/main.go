package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"iot-monitor/backend/config"
	"iot-monitor/backend/internal/anomaly"
	"iot-monitor/backend/internal/handlers"
	"iot-monitor/backend/internal/influxdb"
	"iot-monitor/backend/internal/models"
)

func errorHandlingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) > 0 {
			for _, e := range c.Errors {
				if strings.Contains(e.Error(), "invalid character") ||
					strings.Contains(e.Error(), "unexpected EOF") ||
					strings.Contains(e.Error(), "cannot unmarshal") {
					c.JSON(http.StatusBadRequest, models.Response{
						Code:    http.StatusBadRequest,
						Message: "Invalid JSON format: " + e.Error(),
					})
					c.Abort()
					return
				}
			}
		}
	}
}

func main() {
	cfg := config.Load()

	influxClient := influxdb.NewClient(cfg)
	defer influxClient.Close()

	anomalyDetector := anomaly.NewDetector(cfg)
	log.Printf("Anomaly detection threshold: %d consecutive readings", anomalyDetector.GetAnomalyThreshold())
	if cfg.WebhookURL != "" {
		log.Printf("Webhook alerts enabled: %s", cfg.WebhookURL)
	} else {
		log.Printf("Webhook alerts disabled (no WEBHOOK_URL configured)")
	}

	sensorHandler := handlers.NewSensorHandler(influxClient, anomalyDetector)

	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(errorHandlingMiddleware())

	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Type", "Accept", "Authorization"}
	r.Use(cors.New(corsConfig))

	api := r.Group("/api")
	{
		sensor := api.Group("/sensor")
		{
			sensor.POST("/data", sensorHandler.PostSensorData)
			sensor.POST("/data/batch", sensorHandler.PostSensorDataBatch)
			sensor.GET("/latest", sensorHandler.GetSensorLatest)
			sensor.GET("/history", sensorHandler.GetSensorHistory)
			sensor.GET("/workshops", sensorHandler.GetWorkshops)
		}
		api.GET("/health", sensorHandler.HealthCheck)
	}

	srv := &http.Server{
		Addr:    ":" + cfg.BackendPort,
		Handler: r,
	}

	go func() {
		log.Printf("Server starting on port %s...", cfg.BackendPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exiting")
}
