package anomaly

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"iot-monitor/backend/config"
	"iot-monitor/backend/internal/models"
)

type ThresholdResult struct {
	IsAnomaly  bool
	AlertType  string
	Value      float64
	Threshold  float64
}

type SensorState struct {
	ConsecutiveErrors int
	LastAlertTime     time.Time
	LastAlertType     string
	Window            []ThresholdResult
	IsAlerting        bool
}

type Detector struct {
	cfg          *config.Config
	mu           sync.RWMutex
	sensorStates map[string]*SensorState
	cooldown     time.Duration
}

func NewDetector(cfg *config.Config) *Detector {
	return &Detector{
		cfg:          cfg,
		sensorStates: make(map[string]*SensorState),
		cooldown:     5 * time.Minute,
	}
}

func (d *Detector) CheckThresholds(data *models.SensorData) ThresholdResult {
	if data.Temperature >= d.cfg.TemperatureError {
		return ThresholdResult{
			IsAnomaly: true,
			AlertType: "temperature",
			Value:     data.Temperature,
			Threshold: d.cfg.TemperatureError,
		}
	}
	if data.Vibration >= d.cfg.VibrationError {
		return ThresholdResult{
			IsAnomaly: true,
			AlertType: "vibration",
			Value:     data.Vibration,
			Threshold: d.cfg.VibrationError,
		}
	}
	if data.Voltage >= d.cfg.VoltageErrorHigh || data.Voltage <= d.cfg.VoltageErrorLow {
		threshold := d.cfg.VoltageErrorHigh
		if data.Voltage < 220 {
			threshold = d.cfg.VoltageErrorLow
		}
		return ThresholdResult{
			IsAnomaly: true,
			AlertType: "voltage",
			Value:     data.Voltage,
			Threshold: threshold,
		}
	}
	return ThresholdResult{
		IsAnomaly: false,
	}
}

func (d *Detector) ProcessData(data *models.SensorData) *models.AlertRecord {
	key := fmt.Sprintf("%s-%s", data.Workshop, data.SensorId)
	result := d.CheckThresholds(data)

	d.mu.Lock()
	defer d.mu.Unlock()

	state, exists := d.sensorStates[key]
	if !exists {
		state = &SensorState{
			Window: make([]ThresholdResult, 0, d.cfg.AnomalyThreshold),
		}
		d.sensorStates[key] = state
	}

	state.Window = append(state.Window, result)
	if len(state.Window) > d.cfg.AnomalyThreshold {
		state.Window = state.Window[1:]
	}

	if result.IsAnomaly {
		state.ConsecutiveErrors++
	} else {
		state.ConsecutiveErrors = 0
		state.IsAlerting = false
	}

	consecutiveCount := d.countConsecutiveAnomalies(state.Window)

	if consecutiveCount >= d.cfg.AnomalyThreshold {
		if !state.IsAlerting && time.Since(state.LastAlertTime) > d.cooldown {
			alertId := fmt.Sprintf("alert-%s-%d", key, time.Now().UnixNano())
			alert := &models.AlertRecord{
				AlertId:          alertId,
				Timestamp:        time.Now().UTC(),
				Workshop:         data.Workshop,
				SensorId:         data.SensorId,
				AlertType:        result.AlertType,
				CurrentValue:     result.Value,
				Threshold:        result.Threshold,
				ConsecutiveCount: consecutiveCount,
				Triggered:        true,
			}

			state.IsAlerting = true
			state.LastAlertTime = time.Now()
			state.LastAlertType = result.AlertType

			go d.sendWebhook(alert)

			return alert
		}
	}

	return nil
}

func (d *Detector) countConsecutiveAnomalies(window []ThresholdResult) int {
	count := 0
	for i := len(window) - 1; i >= 0; i-- {
		if window[i].IsAnomaly {
			count++
		} else {
			break
		}
	}
	return count
}

func (d *Detector) GetSensorStatus(workshop, sensorId string) *models.SensorDataWithStatus {
	key := fmt.Sprintf("%s-%s", workshop, sensorId)

	d.mu.RLock()
	defer d.mu.RUnlock()

	state, exists := d.sensorStates[key]
	if !exists {
		return nil
	}

	consecutiveCount := d.countConsecutiveAnomalies(state.Window)

	status := &models.SensorDataWithStatus{
		ConsecutiveErrors: consecutiveCount,
		IsAlerting:        state.IsAlerting,
	}

	if state.IsAlerting {
		status.AlertType = state.LastAlertType
	}

	return status
}

func (d *Detector) EnrichSensorData(data *models.SensorData) *models.SensorDataWithStatus {
	status := d.GetSensorStatus(data.Workshop, data.SensorId)
	if status == nil {
		return &models.SensorDataWithStatus{
			Workshop:          data.Workshop,
			SensorId:          data.SensorId,
			Temperature:       data.Temperature,
			Vibration:         data.Vibration,
			Voltage:           data.Voltage,
			Timestamp:         data.Timestamp,
			ConsecutiveErrors: 0,
			IsAlerting:        false,
		}
	}

	result := d.CheckThresholds(data)
	if result.IsAnomaly && status.ConsecutiveErrors >= d.cfg.AnomalyThreshold-1 {
		status.AlertValue = result.Value
		status.AlertThreshold = result.Threshold
	}

	status.Workshop = data.Workshop
	status.SensorId = data.SensorId
	status.Temperature = data.Temperature
	status.Vibration = data.Vibration
	status.Voltage = data.Voltage
	status.Timestamp = data.Timestamp

	return status
}

func (d *Detector) sendWebhook(alert *models.AlertRecord) {
	if d.cfg.WebhookURL == "" {
		return
	}

	payload := models.WebhookPayload{
		AlertId:          alert.AlertId,
		Timestamp:        alert.Timestamp,
		Workshop:         alert.Workshop,
		SensorId:         alert.SensorId,
		AlertType:        alert.AlertType,
		CurrentValue:     alert.CurrentValue,
		Threshold:        alert.Threshold,
		ConsecutiveCount: alert.ConsecutiveCount,
		Message: fmt.Sprintf("ALERT: %s/%s %s anomaly detected - value: %.2f, threshold: %.2f, consecutive: %d",
			alert.Workshop, alert.SensorId, alert.AlertType, alert.CurrentValue, alert.Threshold, alert.ConsecutiveCount),
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		fmt.Printf("Failed to marshal webhook payload: %v\n", err)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST", d.cfg.WebhookURL, bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("Failed to create webhook request: %v\n", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Failed to send webhook: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		fmt.Printf("Webhook sent successfully for alert %s\n", alert.AlertId)
	} else {
		fmt.Printf("Webhook returned status %d for alert %s\n", resp.StatusCode, alert.AlertId)
	}
}

func (d *Detector) GetAnomalyThreshold() int {
	return d.cfg.AnomalyThreshold
}
