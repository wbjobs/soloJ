package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"iot-monitor/backend/internal/anomaly"
	"iot-monitor/backend/internal/influxdb"
	"iot-monitor/backend/internal/models"
)

type SensorHandler struct {
	influxClient   *influxdb.Client
	anomalyDetector *anomaly.Detector
}

func NewSensorHandler(influxClient *influxdb.Client, anomalyDetector *anomaly.Detector) *SensorHandler {
	return &SensorHandler{
		influxClient:   influxClient,
		anomalyDetector: anomalyDetector,
	}
}

func successResponse(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, models.Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func errorResponse(c *gin.Context, code int, message string) {
	statusCode := http.StatusOK
	switch code {
	case http.StatusBadRequest:
		statusCode = http.StatusBadRequest
	case http.StatusUnauthorized:
		statusCode = http.StatusUnauthorized
	case http.StatusForbidden:
		statusCode = http.StatusForbidden
	case http.StatusNotFound:
		statusCode = http.StatusNotFound
	case http.StatusRequestTimeout:
		statusCode = http.StatusRequestTimeout
	case http.StatusTooManyRequests:
		statusCode = http.StatusTooManyRequests
	case http.StatusInternalServerError:
		statusCode = http.StatusInternalServerError
	case http.StatusServiceUnavailable:
		statusCode = http.StatusServiceUnavailable
	}
	c.JSON(statusCode, models.Response{
		Code:    code,
		Message: message,
	})
}

func (h *SensorHandler) PostSensorData(c *gin.Context) {
	var data models.SensorData
	if err := c.ShouldBindJSON(&data); err != nil {
		errorResponse(c, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	if data.Timestamp.IsZero() {
		data.Timestamp = time.Now().UTC()
	}

	alert := h.anomalyDetector.ProcessData(&data)

	if err := h.influxClient.WriteData(c.Request.Context(), &data); err != nil {
		errorResponse(c, http.StatusInternalServerError, "Failed to write data: "+err.Error())
		return
	}

	response := gin.H{
		"status": "written",
	}
	if alert != nil {
		response["alert"] = alert
	}

	successResponse(c, response)
}

func (h *SensorHandler) PostSensorDataBatch(c *gin.Context) {
	var batch models.BatchSensorData
	if err := c.ShouldBindJSON(&batch); err != nil {
		errorResponse(c, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	if len(batch.Data) == 0 {
		errorResponse(c, http.StatusBadRequest, "Empty batch data")
		return
	}

	now := time.Now().UTC()
	var alerts []*models.AlertRecord

	for i := range batch.Data {
		if batch.Data[i].Timestamp.IsZero() {
			batch.Data[i].Timestamp = now
		}
		alert := h.anomalyDetector.ProcessData(&batch.Data[i])
		if alert != nil {
			alerts = append(alerts, alert)
		}
	}

	if err := h.influxClient.WriteBatch(c.Request.Context(), batch.Data); err != nil {
		errorResponse(c, http.StatusInternalServerError, "Failed to write batch data: "+err.Error())
		return
	}

	response := gin.H{
		"written": len(batch.Data),
	}
	if len(alerts) > 0 {
		response["alerts"] = alerts
		response["alertCount"] = len(alerts)
	}

	successResponse(c, response)
}

func (h *SensorHandler) GetSensorLatest(c *gin.Context) {
	latestData, err := h.influxClient.QueryLatest(c.Request.Context())
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "Failed to query latest data: "+err.Error())
		return
	}

	for workshop, sensors := range latestData {
		for sensorId, data := range sensors {
			baseData := &models.SensorData{
				Workshop:    workshop,
				SensorId:    sensorId,
				Temperature: data.Temperature,
				Vibration:   data.Vibration,
				Voltage:     data.Voltage,
				Timestamp:   data.Timestamp,
			}
			enriched := h.anomalyDetector.EnrichSensorData(baseData)
			latestData[workshop][sensorId] = enriched
		}
	}

	successResponse(c, latestData)
}

func (h *SensorHandler) GetSensorHistory(c *gin.Context) {
	workshop := c.Query("workshop")
	sensorId := c.Query("sensorId")
	hoursStr := c.DefaultQuery("hours", "24")

	if workshop == "" {
		errorResponse(c, http.StatusBadRequest, "workshop parameter is required")
		return
	}
	if sensorId == "" {
		errorResponse(c, http.StatusBadRequest, "sensorId parameter is required")
		return
	}

	hours, err := strconv.Atoi(hoursStr)
	if err != nil {
		errorResponse(c, http.StatusBadRequest, "Invalid hours parameter")
		return
	}

	if hours <= 0 {
		errorResponse(c, http.StatusBadRequest, "hours must be positive")
		return
	}

	historyData, err := h.influxClient.QueryHistory(c.Request.Context(), workshop, sensorId, hours)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "Failed to query history data: "+err.Error())
		return
	}

	successResponse(c, gin.H{
		"data": historyData,
	})
}

func (h *SensorHandler) GetWorkshops(c *gin.Context) {
	workshops, err := h.influxClient.GetWorkshops(c.Request.Context())
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "Failed to get workshops: "+err.Error())
		return
	}

	successResponse(c, gin.H{
		"workshops": workshops,
	})
}

func (h *SensorHandler) HealthCheck(c *gin.Context) {
	successResponse(c, gin.H{
		"status": "ok",
		"time":   time.Now().Format(time.RFC3339),
	})
}
