package influxdb

import (
	"context"
	"fmt"
	"sync"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api/write"
	"iot-monitor/backend/config"
	"iot-monitor/backend/internal/models"
)

const maxQueryRetries = 3
const queryRetryDelay = 100 * time.Millisecond

type Client struct {
	client       influxdb2.Client
	cfg          *config.Config
	writeAPI     influxdb2.WriteAPIBlocking
	writeAPIMu   sync.Mutex
	latestCache  map[string]map[string]*models.SensorDataWithStatus
	cacheTime    time.Time
	cacheMu      sync.RWMutex
	cacheTTL     time.Duration
}

func NewClient(cfg *config.Config) *Client {
	options := influxdb2.DefaultOptions().
		SetPrecision(time.Millisecond).
		SetHTTPRequestTimeout(30 * time.Second)

	client := influxdb2.NewClientWithOptions(
		cfg.InfluxDBURL,
		cfg.InfluxDBToken,
		options,
	)

	writeAPI := client.WriteAPIBlocking(cfg.InfluxDBOrg, cfg.InfluxDBBucket)

	return &Client{
		client:      client,
		cfg:         cfg,
		writeAPI:    writeAPI,
		latestCache: make(map[string]map[string]*models.SensorDataWithStatus),
		cacheTTL:    500 * time.Millisecond,
	}
}

func (c *Client) Close() {
	c.writeAPIMu.Lock()
	defer c.writeAPIMu.Unlock()
	c.client.Close()
}

func (c *Client) WriteData(ctx context.Context, data *models.SensorData) error {
	if data.Timestamp.IsZero() {
		data.Timestamp = time.Now().UTC()
	}

	point := write.NewPointWithMeasurement("sensor_data").
		AddTag("workshop", data.Workshop).
		AddTag("sensorId", data.SensorId).
		AddField("temperature", data.Temperature).
		AddField("vibration", data.Vibration).
		AddField("voltage", data.Voltage).
		SetTimestamp(data.Timestamp)

	c.writeAPIMu.Lock()
	defer c.writeAPIMu.Unlock()

	var err error
	for i := 0; i < maxQueryRetries; i++ {
		err = c.writeAPI.WritePoint(ctx, point)
		if err == nil {
			c.invalidateCache()
			return nil
		}
		time.Sleep(queryRetryDelay)
	}
	return fmt.Errorf("write failed after %d retries: %w", maxQueryRetries, err)
}

func (c *Client) WriteBatch(ctx context.Context, data []models.SensorData) error {
	points := make([]*write.Point, len(data))
	now := time.Now().UTC()
	for i, d := range data {
		if d.Timestamp.IsZero() {
			d.Timestamp = now
		}
		points[i] = write.NewPointWithMeasurement("sensor_data").
			AddTag("workshop", d.Workshop).
			AddTag("sensorId", d.SensorId).
			AddField("temperature", d.Temperature).
			AddField("vibration", d.Vibration).
			AddField("voltage", d.Voltage).
			SetTimestamp(d.Timestamp)
	}

	c.writeAPIMu.Lock()
	defer c.writeAPIMu.Unlock()

	var err error
	for i := 0; i < maxQueryRetries; i++ {
		err = c.writeAPI.WritePoints(ctx, points)
		if err == nil {
			c.invalidateCache()
			return nil
		}
		time.Sleep(queryRetryDelay)
	}
	return fmt.Errorf("batch write failed after %d retries: %w", maxQueryRetries, err)
}

func (c *Client) QueryLatest(ctx context.Context) (map[string]map[string]*models.SensorDataWithStatus, error) {
	c.cacheMu.RLock()
	if time.Since(c.cacheTime) < c.cacheTTL && len(c.latestCache) > 0 {
		cached := make(map[string]map[string]*models.SensorDataWithStatus)
		for k, v := range c.latestCache {
			sensors := make(map[string]*models.SensorDataWithStatus)
			for sk, sv := range v {
				cp := *sv
				sensors[sk] = &cp
			}
			cached[k] = sensors
		}
		c.cacheMu.RUnlock()
		return cached, nil
	}
	c.cacheMu.RUnlock()

	fluxQuery := `
		from(bucket: "` + c.cfg.InfluxDBBucket + `")
			|> range(start: -6h)
			|> filter(fn: (r) => r._measurement == "sensor_data")
			|> keep(columns: ["_time", "_measurement", "_field", "_value", "workshop", "sensorId"])
			|> group(columns: ["workshop", "sensorId"])
			|> sort(columns: ["_time"], desc: true)
			|> limit(n: 1)
			|> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
			|> keep(columns: ["_time", "workshop", "sensorId", "temperature", "vibration", "voltage"])
	`

	var result *influxdb2.QueryTableResult
	var err error

	for i := 0; i < maxQueryRetries; i++ {
		queryAPI := c.client.QueryAPI(c.cfg.InfluxDBOrg)
		result, err = queryAPI.Query(ctx, fluxQuery)
		if err == nil {
			break
		}
		if i < maxQueryRetries-1 {
			time.Sleep(queryRetryDelay)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("query error after %d retries: %w", maxQueryRetries, err)
	}

	latestData := make(map[string]map[string]*models.SensorDataWithStatus)

	for result.Next() {
		record := result.Record()

		workshop, ok := record.ValueByKey("workshop").(string)
		if !ok || workshop == "" {
			continue
		}
		sensorId, ok := record.ValueByKey("sensorId").(string)
		if !ok || sensorId == "" {
			continue
		}

		sensorData := &models.SensorDataWithStatus{
			Workshop:  workshop,
			SensorId:  sensorId,
			Timestamp: record.Time().UTC(),
		}

		if temp, ok := record.ValueByKey("temperature").(float64); ok {
			sensorData.Temperature = temp
		} else {
			continue
		}
		if vib, ok := record.ValueByKey("vibration").(float64); ok {
			sensorData.Vibration = vib
		} else {
			continue
		}
		if volt, ok := record.ValueByKey("voltage").(float64); ok {
			sensorData.Voltage = volt
		} else {
			continue
		}

		if _, exists := latestData[workshop]; !exists {
			latestData[workshop] = make(map[string]*models.SensorDataWithStatus)
		}
		latestData[workshop][sensorId] = sensorData
	}

	if result.Err() != nil {
		return nil, fmt.Errorf("result iteration error: %w", result.Err())
	}

	c.cacheMu.Lock()
	c.latestCache = make(map[string]map[string]*models.SensorDataWithStatus)
	for k, v := range latestData {
		sensors := make(map[string]*models.SensorDataWithStatus)
		for sk, sv := range v {
			cp := *sv
			sensors[sk] = &cp
		}
		c.latestCache[k] = sensors
	}
	c.cacheTime = time.Now()
	c.cacheMu.Unlock()

	return latestData, nil
}

func (c *Client) QueryHistory(ctx context.Context, workshop, sensorId string, hours int) ([]*models.SensorData, error) {
	fluxQuery := fmt.Sprintf(`
		from(bucket: "%s")
			|> range(start: -%dh, stop: now())
			|> filter(fn: (r) => r._measurement == "sensor_data")
			|> filter(fn: (r) => r.workshop == "%s")
			|> filter(fn: (r) => r.sensorId == "%s")
			|> keep(columns: ["_time", "_field", "_value"])
			|> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")
			|> keep(columns: ["_time", "temperature", "vibration", "voltage"])
			|> sort(columns: ["_time"])
	`, c.cfg.InfluxDBBucket, hours, workshop, sensorId)

	var result *influxdb2.QueryTableResult
	var err error

	for i := 0; i < maxQueryRetries; i++ {
		queryAPI := c.client.QueryAPI(c.cfg.InfluxDBOrg)
		result, err = queryAPI.Query(ctx, fluxQuery)
		if err == nil {
			break
		}
		if i < maxQueryRetries-1 {
			time.Sleep(queryRetryDelay)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("query error after %d retries: %w", maxQueryRetries, err)
	}

	var historyData []*models.SensorData

	for result.Next() {
		record := result.Record()

		sensorData := &models.SensorData{
			Workshop:  workshop,
			SensorId:  sensorId,
			Timestamp: record.Time().UTC(),
		}

		if temp, ok := record.ValueByKey("temperature").(float64); ok {
			sensorData.Temperature = temp
		} else {
			continue
		}
		if vib, ok := record.ValueByKey("vibration").(float64); ok {
			sensorData.Vibration = vib
		} else {
			continue
		}
		if volt, ok := record.ValueByKey("voltage").(float64); ok {
			sensorData.Voltage = volt
		} else {
			continue
		}

		historyData = append(historyData, sensorData)
	}

	if result.Err() != nil {
		return nil, fmt.Errorf("result iteration error: %w", result.Err())
	}

	return historyData, nil
}

func (c *Client) GetWorkshops(ctx context.Context) ([]string, error) {
	fluxQuery := `
		from(bucket: "` + c.cfg.InfluxDBBucket + `")
			|> range(start: -30d)
			|> filter(fn: (r) => r._measurement == "sensor_data")
			|> keep(columns: ["workshop"])
			|> distinct(column: "workshop")
			|> group()
	`

	var result *influxdb2.QueryTableResult
	var err error

	for i := 0; i < maxQueryRetries; i++ {
		queryAPI := c.client.QueryAPI(c.cfg.InfluxDBOrg)
		result, err = queryAPI.Query(ctx, fluxQuery)
		if err == nil {
			break
		}
		if i < maxQueryRetries-1 {
			time.Sleep(queryRetryDelay)
		}
	}
	if err != nil {
		return nil, fmt.Errorf("query error after %d retries: %w", maxQueryRetries, err)
	}

	var workshops []string
	seen := make(map[string]bool)

	for result.Next() {
		record := result.Record()
		if value, ok := record.ValueByKey("workshop").(string); ok {
			if value != "" && !seen[value] {
				seen[value] = true
				workshops = append(workshops, value)
			}
		}
	}

	if result.Err() != nil {
		return nil, fmt.Errorf("result iteration error: %w", result.Err())
	}

	return workshops, nil
}

func (c *Client) invalidateCache() {
	c.cacheMu.Lock()
	defer c.cacheMu.Unlock()
	c.latestCache = make(map[string]map[string]*models.SensorDataWithStatus)
	c.cacheTime = time.Time{}
}
