package config

import (
	"os"
	"strconv"
)

type Config struct {
	InfluxDBToken         string
	InfluxDBOrg           string
	InfluxDBBucket        string
	InfluxDBURL           string
	BackendPort           string
	WebhookURL            string
	AnomalyThreshold      int
	TemperatureWarning    float64
	TemperatureError      float64
	VibrationWarning      float64
	VibrationError        float64
	VoltageWarningHigh    float64
	VoltageWarningLow     float64
	VoltageErrorHigh      float64
	VoltageErrorLow       float64
}

func Load() *Config {
	return &Config{
		InfluxDBToken:         getEnv("INFLUXDB_TOKEN", ""),
		InfluxDBOrg:           getEnv("INFLUXDB_ORG", ""),
		InfluxDBBucket:        getEnv("INFLUXDB_BUCKET", ""),
		InfluxDBURL:           getEnv("INFLUXDB_URL", "http://localhost:8086"),
		BackendPort:           getEnv("BACKEND_PORT", "8080"),
		WebhookURL:            getEnv("WEBHOOK_URL", ""),
		AnomalyThreshold:      getEnvInt("ANOMALY_THRESHOLD", 5),
		TemperatureWarning:    getEnvFloat("TEMPERATURE_WARNING", 40.0),
		TemperatureError:      getEnvFloat("TEMPERATURE_ERROR", 50.0),
		VibrationWarning:      getEnvFloat("VIBRATION_WARNING", 100.0),
		VibrationError:        getEnvFloat("VIBRATION_ERROR", 150.0),
		VoltageWarningHigh:    getEnvFloat("VOLTAGE_WARNING_HIGH", 240.0),
		VoltageWarningLow:     getEnvFloat("VOLTAGE_WARNING_LOW", 200.0),
		VoltageErrorHigh:      getEnvFloat("VOLTAGE_ERROR_HIGH", 250.0),
		VoltageErrorLow:       getEnvFloat("VOLTAGE_ERROR_LOW", 190.0),
	}
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func getEnvInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return defaultValue
	}
	return parsed
}

func getEnvFloat(key string, defaultValue float64) float64 {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return defaultValue
	}
	return parsed
}
