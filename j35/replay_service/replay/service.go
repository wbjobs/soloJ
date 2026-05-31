package replay

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"sync"
	"time"

	kafkaPkg "replay_service/kafka"
)

type ReplaySpeed float64

const (
	Speed1x ReplaySpeed = 1.0
	Speed2x ReplaySpeed = 2.0
	Speed4x ReplaySpeed = 4.0
	Speed8x ReplaySpeed = 8.0
)

type ReplayEventType string

const (
	EventTypeCombat   ReplayEventType = "combat"
	EventTypeMovement ReplayEventType = "movement"
	EventTypeSkill    ReplayEventType = "skill"
	EventTypeBuff     ReplayEventType = "buff"
	EventTypeDeath    ReplayEventType = "death"
)

type ReplayEvent struct {
	EventType ReplayEventType `json:"event_type"`
	Timestamp int64           `json:"timestamp"`
	RawData   json.RawMessage `json:"raw_data"`
}

type ReplaySession struct {
	ID          string
	BattleID    string
	FromTime    int64
	ToTime      int64
	Speed       ReplaySpeed
	Events      []ReplayEvent
	EventCh     chan ReplayEvent
	pauseCh     chan struct{}
	resumeCh    chan struct{}
	jumpCh      chan int64
	cancelCtx   context.Context
	cancelFunc  context.CancelFunc
	mu          sync.Mutex
	paused      bool
	currentIdx  int
	currentTime int64
}

func (s *ReplaySession) SetSpeed(speed ReplaySpeed) {
	s.mu.Lock()
	s.Speed = speed
	s.mu.Unlock()
}

func (s *ReplaySession) Pause() {
	s.mu.Lock()
	if !s.paused {
		s.paused = true
		s.mu.Unlock()
		s.pauseCh <- struct{}{}
		return
	}
	s.mu.Unlock()
}

func (s *ReplaySession) Resume() {
	s.mu.Lock()
	if s.paused {
		s.paused = false
		s.mu.Unlock()
		s.resumeCh <- struct{}{}
		return
	}
	s.mu.Unlock()
}

func (s *ReplaySession) JumpTo(timestampMs int64) {
	s.mu.Lock()
	idx := sort.Search(len(s.Events), func(i int) bool {
		return s.Events[i].Timestamp >= timestampMs
	})
	s.currentIdx = idx
	s.currentTime = timestampMs
	s.mu.Unlock()
	s.jumpCh <- timestampMs
}

func (s *ReplaySession) Close() {
	s.cancelFunc()
}

type ReplayService struct {
	consumer *kafkaPkg.BattleEventConsumer
	sessions map[string]*ReplaySession
	mu       sync.RWMutex
}

func NewReplayService(consumer *kafkaPkg.BattleEventConsumer) *ReplayService {
	return &ReplayService{
		consumer: consumer,
		sessions: make(map[string]*ReplaySession),
	}
}

func (rs *ReplayService) StartReplay(battleID string, fromTime, toTime int64) (*ReplaySession, error) {
	events, err := rs.collectEvents(battleID, fromTime, toTime)
	if err != nil {
		return nil, fmt.Errorf("collect events: %w", err)
	}

	sort.Slice(events, func(i, j int) bool {
		return events[i].Timestamp < events[j].Timestamp
	})

	ctx, cancel := context.WithCancel(context.Background())

	session := &ReplaySession{
		ID:         fmt.Sprintf("%s-%d", battleID, fromTime),
		BattleID:   battleID,
		FromTime:   fromTime,
		ToTime:     toTime,
		Speed:      Speed1x,
		Events:     events,
		EventCh:    make(chan ReplayEvent, 256),
		pauseCh:    make(chan struct{}, 1),
		resumeCh:   make(chan struct{}, 1),
		jumpCh:     make(chan int64, 1),
		cancelCtx:  ctx,
		cancelFunc: cancel,
	}

	rs.mu.Lock()
	rs.sessions[session.ID] = session
	rs.mu.Unlock()

	go session.play()

	return session, nil
}

func (rs *ReplayService) collectEvents(battleID string, fromTime, toTime int64) ([]ReplayEvent, error) {
	topics := []struct {
		topic      string
		eventType  ReplayEventType
	}{
		{"combat-events", EventTypeCombat},
		{"movement-events", EventTypeMovement},
		{"skill-events", EventTypeSkill},
		{"buff-events", EventTypeBuff},
		{"death-events", EventTypeDeath},
	}

	var allEvents []ReplayEvent
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, t := range topics {
		wg.Add(1)
		go func(topic string, eventType ReplayEventType) {
			defer wg.Done()

			partitions, err := rs.consumer.GetPartitions(topic)
			if err != nil {
				return
			}

			for _, p := range partitions {
				msgs, err := rs.consumer.ReadMessagesInRange(context.Background(), topic, p, fromTime, toTime)
				if err != nil {
					continue
				}
				for _, msg := range msgs {
					var base struct {
						BattleID string `json:"battle_id"`
					}
					if err := json.Unmarshal(msg.Value, &base); err != nil {
						continue
					}
					if base.BattleID != battleID {
						continue
					}
					evt := ReplayEvent{
						EventType: eventType,
						RawData:   msg.Value,
					}
					if err := json.Unmarshal(msg.Value, &struct {
						Timestamp *int64 `json:"timestamp"`
					}{Timestamp: &evt.Timestamp}); err != nil {
						continue
					}
					mu.Lock()
					allEvents = append(allEvents, evt)
					mu.Unlock()
				}
			}
		}(t.topic, t.eventType)
	}

	wg.Wait()
	return allEvents, nil
}

func (s *ReplaySession) play() {
	defer close(s.EventCh)

	for {
		select {
		case <-s.cancelCtx.Done():
			return
		case <-s.pauseCh:
			select {
			case <-s.cancelCtx.Done():
				return
			case <-s.resumeCh:
			case jumpTs := <-s.jumpCh:
				s.handleJump(jumpTs)
			}
		case jumpTs := <-s.jumpCh:
			s.handleJump(jumpTs)
		default:
		}

		s.mu.Lock()
		idx := s.currentIdx
		if idx >= len(s.Events) {
			s.mu.Unlock()
			return
		}
		speed := s.Speed
		s.mu.Unlock()

		currentEvent := s.Events[idx]

		select {
		case <-s.cancelCtx.Done():
			return
		case s.EventCh <- currentEvent:
			s.mu.Lock()
			s.currentIdx++
			s.currentTime = currentEvent.Timestamp
			s.mu.Unlock()
		}

		if idx+1 < len(s.Events) {
			nextEvent := s.Events[idx+1]
			gapMs := nextEvent.Timestamp - currentEvent.Timestamp
			delayMs := time.Duration(float64(gapMs)*1000/float64(speed)) * time.Microsecond
			if delayMs > 0 {
				timer := time.NewTimer(delayMs)
				select {
				case <-timer.C:
				case <-s.cancelCtx.Done():
					timer.Stop()
					return
				case <-s.pauseCh:
					timer.Stop()
					select {
					case <-s.cancelCtx.Done():
						return
					case <-s.resumeCh:
					case jumpTs := <-s.jumpCh:
						s.handleJump(jumpTs)
					}
				case jumpTs := <-s.jumpCh:
					timer.Stop()
					s.handleJump(jumpTs)
				}
			}
		}
	}
}

func (s *ReplaySession) handleJump(targetTs int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	idx := sort.Search(len(s.Events), func(i int) bool {
		return s.Events[i].Timestamp >= targetTs
	})
	s.currentIdx = idx
	s.currentTime = targetTs
}

func (rs *ReplayService) GetSession(id string) (*ReplaySession, bool) {
	rs.mu.RLock()
	defer rs.mu.RUnlock()
	s, ok := rs.sessions[id]
	return s, ok
}

func (rs *ReplayService) RemoveSession(id string) {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	if s, ok := rs.sessions[id]; ok {
		s.Close()
		delete(rs.sessions, id)
	}
}

func (rs *ReplayService) Close() {
	rs.mu.Lock()
	defer rs.mu.Unlock()
	for id, s := range rs.sessions {
		s.Close()
		delete(rs.sessions, id)
	}
}
