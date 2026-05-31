package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"state_service/ecs"
)

type RedisStore struct {
	client *redis.Client
	ctx    context.Context
	ttl    time.Duration
}

type RedisConfig struct {
	Addr     string
	Password string
	DB       int
	TTL      time.Duration
}

func NewRedisStore(cfg RedisConfig) (*RedisStore, error) {
	client := redis.NewClient(&redis.Options{
		Addr:         cfg.Addr,
		Password:     cfg.Password,
		DB:           cfg.DB,
		PoolSize:     64,
		MinIdleConns: 16,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}

	ttl := cfg.TTL
	if ttl == 0 {
		ttl = 30 * time.Minute
	}

	return &RedisStore{
		client: client,
		ctx:    ctx,
		ttl:    ttl,
	}, nil
}

func (r *RedisStore) Close() error {
	return r.client.Close()
}

func (r *RedisStore) playerKey(playerID string) string {
	return fmt.Sprintf("player:%s", playerID)
}

func (r *RedisStore) SavePlayerState(playerID string, entityID ecs.EntityID, world *ecs.World) error {
	pipe := r.client.Pipeline()

	key := r.playerKey(playerID)
	fields := map[string]interface{}{
		"entity_id": strconv.FormatUint(uint64(entityID), 10),
		"timestamp": time.Now().UnixMilli(),
	}

	if pos, ok := world.GetPosition(entityID); ok {
		data, _ := json.Marshal(pos)
		fields["position"] = string(data)
	}
	if hp, ok := world.GetHealth(entityID); ok {
		data, _ := json.Marshal(hp)
		fields["health"] = string(data)
	}
	if buff, ok := world.GetBuff(entityID); ok {
		data, _ := json.Marshal(buff)
		fields["buff"] = string(data)
	}
	if skill, ok := world.GetSkill(entityID); ok {
		data, _ := json.Marshal(skill)
		fields["skill"] = string(data)
	}
	if team, ok := world.GetTeam(entityID); ok {
		data, _ := json.Marshal(team)
		fields["team"] = string(data)
	}
	if combat, ok := world.GetCombat(entityID); ok {
		data, _ := json.Marshal(combat)
		fields["combat"] = string(data)
	}

	pipe.HSet(r.ctx, key, fields)
	pipe.Expire(r.ctx, key, r.ttl)

	_, err := pipe.Exec(r.ctx)
	return err
}

func (r *RedisStore) SavePlayerStatesBatch(states map[string]ecs.EntityID, world *ecs.World) error {
	pipe := r.client.Pipeline()

	for playerID, entityID := range states {
		key := r.playerKey(playerID)
		fields := map[string]interface{}{
			"entity_id": strconv.FormatUint(uint64(entityID), 10),
			"timestamp": time.Now().UnixMilli(),
		}

		if pos, ok := world.GetPosition(entityID); ok {
			data, _ := json.Marshal(pos)
			fields["position"] = string(data)
		}
		if hp, ok := world.GetHealth(entityID); ok {
			data, _ := json.Marshal(hp)
			fields["health"] = string(data)
		}
		if buff, ok := world.GetBuff(entityID); ok {
			data, _ := json.Marshal(buff)
			fields["buff"] = string(data)
		}
		if skill, ok := world.GetSkill(entityID); ok {
			data, _ := json.Marshal(skill)
			fields["skill"] = string(data)
		}
		if team, ok := world.GetTeam(entityID); ok {
			data, _ := json.Marshal(team)
			fields["team"] = string(data)
		}
		if combat, ok := world.GetCombat(entityID); ok {
			data, _ := json.Marshal(combat)
			fields["combat"] = string(data)
		}

		pipe.HSet(r.ctx, key, fields)
		pipe.Expire(r.ctx, key, r.ttl)
	}

	_, err := pipe.Exec(r.ctx)
	return err
}

func (r *RedisStore) LoadPlayerState(playerID string) (map[string]string, error) {
	key := r.playerKey(playerID)
	result, err := r.client.HGetAll(r.ctx, key).Result()
	if err != nil {
		return nil, err
	}
	if len(result) == 0 {
		return nil, fmt.Errorf("player %s not found in redis", playerID)
	}
	return result, nil
}

func (r *RedisStore) DeletePlayerState(playerID string) error {
	key := r.playerKey(playerID)
	return r.client.Del(r.ctx, key).Err()
}

func (r *RedisStore) RefreshTTL(playerID string) error {
	key := r.playerKey(playerID)
	return r.client.Expire(r.ctx, key, r.ttl).Err()
}

func (r *RedisStore) Publish(channel string, message interface{}) error {
	return r.client.Publish(r.ctx, channel, message).Err()
}

func (r *RedisStore) Subscribe(channels ...string) *redis.PubSub {
	return r.client.Subscribe(r.ctx, channels...)
}

func (r *RedisStore) SetKey(key string, value interface{}, ttl time.Duration) error {
	return r.client.Set(r.ctx, key, value, ttl).Err()
}

func (r *RedisStore) GetKey(key string) (string, error) {
	return r.client.Get(r.ctx, key).Result()
}

func (r *RedisStore) IncrementCounter(key string) (int64, error) {
	return r.client.Incr(r.ctx, key).Result()
}

func (r *RedisStore) SetBattleKey(battleID string, data interface{}) error {
	key := fmt.Sprintf("battle:%s", battleID)
	return r.client.Set(r.ctx, key, data, 2*time.Hour).Err()
}
