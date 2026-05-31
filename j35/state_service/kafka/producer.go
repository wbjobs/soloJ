package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"
)

type BattleEventProducer struct {
	writers map[string]*kafka.Writer
	brokers []string
	mu      sync.Mutex

	combatBuf    []kafka.Message
	movementBuf  []kafka.Message
	skillBuf     []kafka.Message
	buffBuf      []kafka.Message
	deathBuf     []kafka.Message
	bufMu        sync.Mutex
	stopCh       chan struct{}
	flushCh      chan struct{}
	done         chan struct{}
}

type CombatEventMsg struct {
	BattleID    string  `json:"battle_id"`
	FrameNumber uint64  `json:"frame_number"`
	Timestamp   int64   `json:"timestamp"`
	AttackerID  string  `json:"attacker_id"`
	DefenderID  string  `json:"defender_id"`
	SkillID     string  `json:"skill_id"`
	Damage      float64 `json:"damage"`
	IsCrit      bool    `json:"is_crit"`
	IsBlocked   bool    `json:"is_blocked"`
	IsDodged    bool    `json:"is_dodged"`
	HPRemaining float64 `json:"hp_remaining"`
}

type MovementEventMsg struct {
	BattleID    string  `json:"battle_id"`
	FrameNumber uint64  `json:"frame_number"`
	Timestamp   int64   `json:"timestamp"`
	PlayerID    string  `json:"player_id"`
	PosX        float64 `json:"pos_x"`
	PosY        float64 `json:"pos_y"`
	PosZ        float64 `json:"pos_z"`
	Heading     float64 `json:"heading"`
	Speed       float64 `json:"speed"`
}

type SkillEventMsg struct {
	BattleID    string  `json:"battle_id"`
	FrameNumber uint64  `json:"frame_number"`
	Timestamp   int64   `json:"timestamp"`
	CasterID    string  `json:"caster_id"`
	SkillID     string  `json:"skill_id"`
	SkillType   int32   `json:"skill_type"`
	OriginX     float64 `json:"origin_x"`
	OriginY     float64 `json:"origin_y"`
	DirectionX  float64 `json:"direction_x"`
	DirectionY  float64 `json:"direction_y"`
}

type BuffEventMsg struct {
	BattleID    string  `json:"battle_id"`
	FrameNumber uint64  `json:"frame_number"`
	Timestamp   int64   `json:"timestamp"`
	TargetID    string  `json:"target_id"`
	BuffID      string  `json:"buff_id"`
	Stacks      int32   `json:"stacks"`
	Duration    float64 `json:"duration"`
	IsAdd       bool    `json:"is_add"`
}

type DeathEventMsg struct {
	BattleID    string `json:"battle_id"`
	FrameNumber uint64 `json:"frame_number"`
	Timestamp   int64  `json:"timestamp"`
	PlayerID    string `json:"player_id"`
	KillerID    string `json:"killer_id"`
	IsRespawn   bool   `json:"is_respawn"`
}

func NewBattleEventProducer(brokers []string) (*BattleEventProducer, error) {
	p := &BattleEventProducer{
		brokers: brokers,
		writers: make(map[string]*kafka.Writer),
		combatBuf:   make([]kafka.Message, 0, 100),
		movementBuf: make([]kafka.Message, 0, 100),
		skillBuf:    make([]kafka.Message, 0, 100),
		buffBuf:     make([]kafka.Message, 0, 100),
		deathBuf:    make([]kafka.Message, 0, 100),
		stopCh:      make(chan struct{}),
		flushCh:     make(chan struct{}, 1),
		done:        make(chan struct{}),
	}

	topics := []string{"combat-events", "movement-events", "skill-events", "buff-events", "death-events"}
	for _, topic := range topics {
		p.writers[topic] = &kafka.Writer{
			Addr:         kafka.TCP(brokers...),
			Topic:        topic,
			Balancer:     &kafka.HashBalancer{},
			BatchSize:    100,
			BatchTimeout: 100 * time.Millisecond,
			Compression:  kafka.Lz4,
			MaxAttempts:  3,
		}
	}

	go p.flushLoop()

	return p, nil
}

func (p *BattleEventProducer) flushLoop() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			p.flushAll()
		case <-p.flushCh:
			p.flushAll()
		case <-p.stopCh:
			p.flushAll()
			close(p.done)
			return
		}
	}
}

func (p *BattleEventProducer) flushAll() {
	p.flushBuffer("combat-events", &p.combatBuf)
	p.flushBuffer("movement-events", &p.movementBuf)
	p.flushBuffer("skill-events", &p.skillBuf)
	p.flushBuffer("buff-events", &p.buffBuf)
	p.flushBuffer("death-events", &p.deathBuf)
}

func (p *BattleEventProducer) flushBuffer(topic string, buf *[]kafka.Message) {
	p.bufMu.Lock()
	if len(*buf) == 0 {
		p.bufMu.Unlock()
		return
	}
	pending := *buf
	*buf = make([]kafka.Message, 0, 100)
	p.bufMu.Unlock()

	w, ok := p.writers[topic]
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := w.WriteMessages(ctx, pending...); err != nil {
		fmt.Printf("kafka write error topic=%s: %v\n", topic, err)
	}
}

func (p *BattleEventProducer) enqueue(topic string, key string, value interface{}) {
	data, err := json.Marshal(value)
	if err != nil {
		return
	}
	msg := kafka.Message{
		Key:   []byte(key),
		Value: data,
	}

	p.bufMu.Lock()
	switch topic {
	case "combat-events":
		p.combatBuf = append(p.combatBuf, msg)
		if len(p.combatBuf) >= 100 {
			select { case p.flushCh <- struct{}{}: default: }
		}
	case "movement-events":
		p.movementBuf = append(p.movementBuf, msg)
		if len(p.movementBuf) >= 100 {
			select { case p.flushCh <- struct{}{}: default: }
		}
	case "skill-events":
		p.skillBuf = append(p.skillBuf, msg)
		if len(p.skillBuf) >= 100 {
			select { case p.flushCh <- struct{}{}: default: }
		}
	case "buff-events":
		p.buffBuf = append(p.buffBuf, msg)
		if len(p.buffBuf) >= 100 {
			select { case p.flushCh <- struct{}{}: default: }
		}
	case "death-events":
		p.deathBuf = append(p.deathBuf, msg)
		if len(p.deathBuf) >= 100 {
			select { case p.flushCh <- struct{}{}: default: }
		}
	}
	p.bufMu.Unlock()
}

func (p *BattleEventProducer) PublishCombatEvent(event CombatEventMsg) {
	key := event.BattleID
	p.enqueue("combat-events", key, event)
}

func (p *BattleEventProducer) PublishMovementEvent(event MovementEventMsg) {
	key := fmt.Sprintf("%s:%s", event.BattleID, event.PlayerID)
	p.enqueue("movement-events", key, event)
}

func (p *BattleEventProducer) PublishSkillEvent(event SkillEventMsg) {
	key := fmt.Sprintf("%s:%s", event.BattleID, event.CasterID)
	p.enqueue("skill-events", key, event)
}

func (p *BattleEventProducer) PublishBuffEvent(event BuffEventMsg) {
	key := fmt.Sprintf("%s:%s", event.BattleID, event.TargetID)
	p.enqueue("buff-events", key, event)
}

func (p *BattleEventProducer) PublishDeathEvent(event DeathEventMsg) {
	key := fmt.Sprintf("%s:%s", event.BattleID, event.PlayerID)
	p.enqueue("death-events", key, event)
}

func (p *BattleEventProducer) Close() {
	close(p.stopCh)
	<-p.done

	for _, w := range p.writers {
		w.Close()
	}
}
