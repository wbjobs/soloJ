package models

import "time"

type SensorData struct {
	Workshop    string    `json:"workshop" binding:"required"`
	SensorId    string    `json:"sensorId" binding:"required"`
	Temperature float64   `json:"temperature" binding:"required"`
	Vibration   float64   `json:"vibration" binding:"required"`
	Voltage     float64   `json:"voltage" binding:"required"`
	Timestamp   time.Time `json:"timestamp"`
}

type SensorDataWithStatus struct {
	Workshop          string    `json:"workshop"`
	SensorId          string    `json:"sensorId"`
	Temperature       float64   `json:"temperature"`
	Vibration         float64   `json:"vibration"`
	Voltage           float64   `json:"voltage"`
	Timestamp         time.Time `json:"timestamp"`
	ConsecutiveErrors int       `json:"consecutiveErrors"`
	IsAlerting        bool      `json:"isAlerting"`
	AlertType         string    `json:"alertType,omitempty"`
	AlertValue        float64   `json:"alertValue,omitempty"`
	AlertThreshold    float64   `json:"alertThreshold,omitempty"`
}

type BatchSensorData struct {
	Data []SensorData `json:"data" binding:"required"`
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type WebhookPayload struct {
	AlertId       string    `json:"alertId"`
	Timestamp     time.Time `json:"timestamp"`
	Workshop      string    `json:"workshop"`
	SensorId      string    `json:"sensorId"`
	AlertType     string    `json:"alertType"`
	CurrentValue  float64   `json:"currentValue"`
	Threshold     float64   `json:"threshold"`
	ConsecutiveCount int    `json:"consecutiveCount"`
	Message       string    `json:"message"`
}

type AlertRecord struct {
	AlertId       string
	Timestamp     time.Time
	Workshop      string
	SensorId      string
	AlertType     string
	CurrentValue  float64
	Threshold     float64
	ConsecutiveCount int
	Triggered     bool
}
