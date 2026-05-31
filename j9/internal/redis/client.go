package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
)

var ctx = context.Background()

type Client struct {
	*redis.Client
	workerID string
}

func NewClient(addr string, password string, db int, workerID string) *Client {
	rdb := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           db,
		PoolSize:     20,
		MinIdleConns: 5,
		MaxConnAge:   30 * time.Minute,
		PoolTimeout:  5 * time.Second,
		IdleTimeout:  10 * time.Minute,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	})
	return &Client{
		Client:   rdb,
		workerID: workerID,
	}
}

func (c *Client) GetPoolStats() *redis.PoolStats {
	return c.Client.PoolStats()
}

func (c *Client) Close() error {
	return c.Client.Close()
}

func (c *Client) Ping() error {
	return c.Client.Ping(ctx).Err()
}

func (c *Client) PushToQueue(queue string, taskID string) error {
	return c.RPush(ctx, fmt.Sprintf("dtask:queue:%s", queue), taskID).Err()
}

func (c *Client) PopFromQueue(queue string, timeout time.Duration) (string, error) {
	result, err := c.BLPop(ctx, timeout, fmt.Sprintf("dtask:queue:%s", queue)).Result()
	if err != nil {
		return "", err
	}
	if len(result) < 2 {
		return "", fmt.Errorf("invalid result from queue")
	}
	return result[1], nil
}

func (c *Client) MoveToProcessing(queue string, taskID string, ttl time.Duration) error {
	pipe := c.Pipeline()
	now := time.Now().Unix()
	processingKey := fmt.Sprintf("dtask:processing:%s", c.workerID)
	
	pipe.ZAdd(ctx, processingKey, &redis.Z{
		Score:  float64(now),
		Member: taskID,
	})
	pipe.Expire(ctx, processingKey, ttl)
	
	_, err := pipe.Exec(ctx)
	return err
}

func (c *Client) RemoveFromProcessing(taskID string) error {
	processingKey := fmt.Sprintf("dtask:processing:%s", c.workerID)
	return c.ZRem(ctx, processingKey, taskID).Err()
}

func (c *Client) ReclaimExpiredTasks(timeout time.Duration) ([]string, error) {
	var reclaimed []string
	cursor := uint64(0)
	
	for {
		var keys []string
		var err error
		keys, cursor, err = c.Scan(ctx, cursor, "dtask:processing:*", 100).Result()
		if err != nil {
			return reclaimed, err
		}
		
		for _, key := range keys {
			cutoff := float64(time.Now().Add(-timeout).Unix())
			tasks, err := c.ZRangeByScore(ctx, key, &redis.ZRangeBy{
				Min: "-inf",
				Max: fmt.Sprintf("%f", cutoff),
			}).Result()
			if err != nil {
				continue
			}
			
			for _, taskID := range tasks {
				taskData, err := c.GetTask(taskID)
				if err != nil {
					continue
				}
				
				var t struct {
					Queue string `json:"queue"`
				}
				if err := json.Unmarshal([]byte(taskData), &t); err != nil {
					continue
				}
				
				pipe := c.Pipeline()
				pipe.ZRem(ctx, key, taskID)
				pipe.LPush(ctx, fmt.Sprintf("dtask:queue:%s", t.Queue), taskID)
				if _, err := pipe.Exec(ctx); err == nil {
					reclaimed = append(reclaimed, taskID)
				}
			}
		}
		
		if cursor == 0 {
			break
		}
	}
	
	return reclaimed, nil
}

func (c *Client) SetTask(key string, value string) error {
	return c.Set(ctx, fmt.Sprintf("dtask:task:%s", key), value, 0).Err()
}

func (c *Client) GetTask(key string) (string, error) {
	return c.Get(ctx, fmt.Sprintf("dtask:task:%s", key)).Result()
}

func (c *Client) TaskExists(key string) (bool, error) {
	result, err := c.Exists(ctx, fmt.Sprintf("dtask:task:%s", key)).Result()
	if err != nil {
		return false, err
	}
	return result > 0, nil
}

func (c *Client) RefreshHeartbeat(ttl time.Duration) error {
	processingKey := fmt.Sprintf("dtask:processing:%s", c.workerID)
	return c.Expire(ctx, processingKey, ttl).Err()
}

func (c *Client) AddToPendingQueue(taskID string) error {
	return c.SAdd(ctx, "dtask:pending", taskID).Err()
}

func (c *Client) RemoveFromPendingQueue(taskID string) error {
	return c.SRem(ctx, "dtask:pending", taskID).Err()
}

func (c *Client) GetPendingTasks() ([]string, error) {
	return c.SMembers(ctx, "dtask:pending").Result()
}

func (c *Client) AddDependentTask(depTaskID string, taskID string) error {
	return c.SAdd(ctx, fmt.Sprintf("dtask:dependents:%s", depTaskID), taskID).Err()
}

func (c *Client) GetDependentTasks(taskID string) ([]string, error) {
	return c.SMembers(ctx, fmt.Sprintf("dtask:dependents:%s", taskID)).Result()
}
