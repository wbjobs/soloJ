package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"
)

type CombatEventType string

const (
	CombatEventDamage  CombatEventType = "damage"
	CombatEventHeal    CombatEventType = "heal"
	CombatEventBlock   CombatEventType = "block"
	CombatEventDodge   CombatEventType = "dodge"
)

type CombatEvent struct {
	BattleID   string          `json:"battle_id"`
	EventType  CombatEventType `json:"event_type"`
	SourceID   string          `json:"source_id"`
	TargetID   string          `json:"target_id"`
	SkillID    uint32          `json:"skill_id"`
	Amount     int32           `json:"amount"`
	IsCrit     bool            `json:"is_crit"`
	HPRemaining int32          `json:"hp_remaining"`
	Timestamp  int64           `json:"timestamp"`
	FrameNumber uint64         `json:"frame_number"`
}

type MovementEvent struct {
	BattleID    string  `json:"battle_id"`
	UnitID      string  `json:"unit_id"`
	X           float64 `json:"x"`
	Y           float64 `json:"y"`
	Z           float64 `json:"z"`
	Heading     float64 `json:"heading"`
	VelocityX   float64 `json:"velocity_x"`
	VelocityY   float64 `json:"velocity_y"`
	VelocityZ   float64 `json:"velocity_z"`
	Timestamp   int64   `json:"timestamp"`
	FrameNumber uint64  `json:"frame_number"`
}

type SkillEvent struct {
	BattleID    string  `json:"battle_id"`
	CasterID    string  `json:"caster_id"`
	SkillID     uint32  `json:"skill_id"`
	TargetID    string  `json:"target_id"`
	OriginX     float64 `json:"origin_x"`
	OriginY     float64 `json:"origin_y"`
	OriginZ     float64 `json:"origin_z"`
	DirectionX  float64 `json:"direction_x"`
	DirectionY  float64 `json:"direction_y"`
	DirectionZ  float64 `json:"direction_z"`
	CD          int64   `json:"cd_ms"`
	Timestamp   int64   `json:"timestamp"`
	FrameNumber uint64  `json:"frame_number"`
}

type BuffEvent struct {
	BattleID    string `json:"battle_id"`
	UnitID      string `json:"unit_id"`
	BuffID      uint32 `json:"buff_id"`
	Action      string `json:"action"`
	Stacks      int32  `json:"stacks"`
	Duration    int64  `json:"duration_ms"`
	Timestamp   int64  `json:"timestamp"`
	FrameNumber uint64 `json:"frame_number"`
}

type DeathEvent struct {
	BattleID    string `json:"battle_id"`
	UnitID      string `json:"unit_id"`
	KillerID    string `json:"killer_id"`
	IsRevive    bool   `json:"is_revive"`
	Timestamp   int64  `json:"timestamp"`
	FrameNumber uint64 `json:"frame_number"`
}

type bufferedMessage struct {
	topic string
	key   string
	value []byte
}

type BattleEventProducer struct {
	writers map[string]*kafka.Writer
	batchMu sync.Mutex
	batch   []bufferedMessage
	stopCh  chan struct{}
	doneCh  chan struct{}
}

type ProducerConfig struct {
	Brokers []string
}

func NewBattleEventProducer(cfg ProducerConfig) *BattleEventProducer {
	topics := []string{
		"combat-events",
		"movement-events",
		"skill-events",
		"buff-events",
		"death-events",
	}

	writers := make(map[string]*kafka.Writer, len(topics))
	for _, topic := range topics {
		writers[topic] = &kafka.Writer{
			Addr:         kafka.TCP(cfg.Brokers...),
			Topic:        topic,
			Balancer:     &kafka.HashBalancer{},
			BatchTimeout: 100 * time.Millisecond,
			BatchSize:    100,
			RequiredAcks: kafka.RequireAll,
			Async:        true,
		}
	}

	p := &BattleEventProducer{
		writers: writers,
		batch:   make([]bufferedMessage, 0, 256),
		stopCh:  make(chan struct{}),
		doneCh:  make(chan struct{}),
	}

	go p.flushLoop()

	return p
}

func (p *BattleEventProducer) flushLoop() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	defer close(p.doneCh)

	for {
		select {
		case <-ticker.C:
			p.flush()
		case <-p.stopCh:
			p.flush()
			return
		}
	}
}

func (p *BattleEventProducer) flush() {
	p.batchMu.Lock()
	msgs := p.batch
	p.batch = make([]bufferedMessage, 0, 256)
	p.batchMu.Unlock()

	if len(msgs) == 0 {
		return
	}

	grouped := make(map[string][]kafka.Message)
	for _, m := range msgs {
		grouped[m.topic] = append(grouped[m.topic], kafka.Message{
			Key:   []byte(m.key),
			Value: m.value,
		})
	}

	for topic, messages := range grouped {
		writer, ok := p.writers[topic]
		if !ok {
			continue
		}
		if err := writer.WriteMessages(context.Background(), messages...); err != nil {
			fmt.Printf("kafka write error on topic %s: %v\n", topic, err)
		}
	}
}

func (p *BattleEventProducer) enqueue(topic, key string, value []byte) {
	p.batchMu.Lock()
	p.batch = append(p.batch, bufferedMessage{topic: topic, key: key, value: value})
	shouldFlush := len(p.batch) >= 100
	p.batchMu.Unlock()

	if shouldFlush {
		p.flush()
	}
}

func (p *BattleEventProducer) PublishCombatEvent(event CombatEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal combat event: %w", err)
	}
	p.enqueue("combat-events", event.BattleID, data)
	return nil
}

func (p *BattleEventProducer) PublishMovementEvent(event MovementEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal movement event: %w", err)
	}
	p.enqueue("movement-events", event.BattleID, data)
	return nil
}

func (p *BattleEventProducer) PublishSkillEvent(event SkillEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal skill event: %w", err)
	}
	p.enqueue("skill-events", event.BattleID, data)
	return nil
}

func (p *BattleEventProducer) PublishBuffEvent(event BuffEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal buff event: %w", err)
	}
	p.enqueue("buff-events", event.BattleID, data)
	return nil
}

func (p *BattleEventProducer) PublishDeathEvent(event DeathEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal death event: %w", err)
	}
	p.enqueue("death-events", event.BattleID, data)
	return nil
}

func (p *BattleEventProducer) Close() error {
	close(p.stopCh)
	<-p.doneCh

	var firstErr error
	for _, w := range p.writers {
		if err := w.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
}

func PartitionForKey(key string, numPartitions int) int {
	h := fnv.New32a()
	h.Write([]byte(key))
	return int(h.Sum32()) % numPartitions
}
