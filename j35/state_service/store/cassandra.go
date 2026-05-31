package store

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gocql/gocql"

	"state_service/ecs"
)

type CassandraConfig struct {
	Hosts       []string
	Keyspace    string
	Consistency string
}

type BattleLog struct {
	BattleID    gocql.UUID
	FrameNumber int
	Timestamp   int64
	PlayerID    string
	EventType   string
	EventData   string
}

type PlayerSnapshot struct {
	PlayerID      string
	SnapshotTime  int64
	BattleID      gocql.UUID
	FrameNumber   int
	PositionX     float64
	PositionY     float64
	PositionZ     float64
	Heading       float64
	HP            float64
	MaxHP         float64
	Shield        float64
	TeamID        int
	CombatAttack  float64
	CombatDefense float64
	CritRate      float64
	DodgeRate     float64
	BuffData      string
	SkillData     string
}

type CombatEvent struct {
	BattleID       gocql.UUID
	EventID        gocql.UUID
	FrameNumber    int
	Timestamp      int64
	AttackerID     string
	DefenderID     string
	SkillID        string
	Damage         float64
	IsCrit         bool
	IsDodge        bool
	HPRemaining    float64
	ShieldRemaining float64
}

type CassandraStore struct {
	session   *gocql.Session
	batchMu   sync.Mutex
	batch     []*BattleLog
	snapMu    sync.Mutex
	snapBatch []*PlayerSnapshot
	eventMu   sync.Mutex
	eventBatch []*CombatEvent
	flushCh   chan struct{}
	done      chan struct{}
}

func NewCassandraStore(cfg CassandraConfig) (*CassandraStore, error) {
	cluster := gocql.NewCluster(cfg.Hosts...)
	cluster.Timeout = 10 * time.Second
	cluster.Consistency = gocql.Quorum
	if cfg.Consistency == "one" {
		cluster.Consistency = gocql.One
	}
	cluster.RetryPolicy = &gocql.ExponentialBackoffRetryPolicy{
		NumRetries: 3,
		Min:        100 * time.Millisecond,
		Max:        5 * time.Second,
	}

	tmpSession, err := cluster.CreateSession()
	if err != nil {
		return nil, fmt.Errorf("cassandra connect failed: %w", err)
	}

	for _, cql := range SchemaCQLs {
		if err := tmpSession.Query(cql).Exec(); err != nil {
			tmpSession.Close()
			return nil, fmt.Errorf("schema init failed: %w", err)
		}
	}
	tmpSession.Close()

	cluster.Keyspace = "state_service"
	session, err := cluster.CreateSession()
	if err != nil {
		return nil, fmt.Errorf("cassandra keyspace session failed: %w", err)
	}

	store := &CassandraStore{
		session:    session,
		batch:      make([]*BattleLog, 0, 100),
		snapBatch:  make([]*PlayerSnapshot, 0, 100),
		eventBatch: make([]*CombatEvent, 0, 100),
		flushCh:    make(chan struct{}, 1),
		done:       make(chan struct{}),
	}

	go store.flushLoop()

	return store, nil
}

func (c *CassandraStore) flushLoop() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			c.flushAll()
		case <-c.flushCh:
			c.flushAll()
		case <-c.done:
			c.flushAll()
			return
		}
	}
}

func (c *CassandraStore) flushAll() {
	c.flushBattleLogs()
	c.flushPlayerSnapshots()
	c.flushCombatEvents()
}

func (c *CassandraStore) flushBattleLogs() {
	c.batchMu.Lock()
	if len(c.batch) == 0 {
		c.batchMu.Unlock()
		return
	}
	pending := c.batch
	c.batch = make([]*BattleLog, 0, 100)
	c.batchMu.Unlock()

	batch := c.session.NewBatch(gocql.UnloggedBatch)
	for _, log := range pending {
		batch.Query(
			`INSERT INTO battle_logs (battle_id, frame_number, timestamp, player_id, event_type, event_data) VALUES (?, ?, ?, ?, ?, ?)`,
			log.BattleID, log.FrameNumber, log.Timestamp, log.PlayerID, log.EventType, log.EventData,
		)
	}
	if err := c.session.ExecuteBatch(batch); err != nil {
		fmt.Printf("cassandra battle_logs batch write error: %v\n", err)
	}
}

func (c *CassandraStore) flushPlayerSnapshots() {
	c.snapMu.Lock()
	if len(c.snapBatch) == 0 {
		c.snapMu.Unlock()
		return
	}
	pending := c.snapBatch
	c.snapBatch = make([]*PlayerSnapshot, 0, 100)
	c.snapMu.Unlock()

	batch := c.session.NewBatch(gocql.UnloggedBatch)
	for _, s := range pending {
		batch.Query(
			`INSERT INTO player_snapshots (player_id, snapshot_time, battle_id, frame_number, position_x, position_y, position_z, heading, hp, max_hp, shield, team_id, combat_attack, combat_defense, combat_crit_rate, combat_dodge_rate, buff_data, skill_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			s.PlayerID, s.SnapshotTime, s.BattleID, s.FrameNumber,
			s.PositionX, s.PositionY, s.PositionZ, s.Heading,
			s.HP, s.MaxHP, s.Shield, s.TeamID,
			s.CombatAttack, s.CombatDefense, s.CritRate, s.DodgeRate,
			s.BuffData, s.SkillData,
		)
	}
	if err := c.session.ExecuteBatch(batch); err != nil {
		fmt.Printf("cassandra player_snapshots batch write error: %v\n", err)
	}
}

func (c *CassandraStore) flushCombatEvents() {
	c.eventMu.Lock()
	if len(c.eventBatch) == 0 {
		c.eventMu.Unlock()
		return
	}
	pending := c.eventBatch
	c.eventBatch = make([]*CombatEvent, 0, 100)
	c.eventMu.Unlock()

	batch := c.session.NewBatch(gocql.UnloggedBatch)
	for _, e := range pending {
		batch.Query(
			`INSERT INTO combat_events (battle_id, event_id, frame_number, timestamp, attacker_id, defender_id, skill_id, damage, is_crit, is_dodge, hp_remaining, shield_remaining) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			e.BattleID, e.EventID, e.FrameNumber, e.Timestamp,
			e.AttackerID, e.DefenderID, e.SkillID,
			e.Damage, e.IsCrit, e.IsDodge,
			e.HPRemaining, e.ShieldRemaining,
		)
	}
	if err := c.session.ExecuteBatch(batch); err != nil {
		fmt.Printf("cassandra combat_events batch write error: %v\n", err)
	}
}

func (c *CassandraStore) WriteBattleLog(log *BattleLog) {
	c.batchMu.Lock()
	c.batch = append(c.batch, log)
	shouldFlush := len(c.batch) >= 100
	c.batchMu.Unlock()
	if shouldFlush {
		select {
		case c.flushCh <- struct{}{}:
		default:
		}
	}
}

func (c *CassandraStore) WritePlayerSnapshot(snap *PlayerSnapshot) {
	c.snapMu.Lock()
	c.snapBatch = append(c.snapBatch, snap)
	shouldFlush := len(c.snapBatch) >= 100
	c.snapMu.Unlock()
	if shouldFlush {
		select {
		case c.flushCh <- struct{}{}:
		default:
		}
	}
}

func (c *CassandraStore) WriteCombatEvent(event *CombatEvent) {
	c.eventMu.Lock()
	c.eventBatch = append(c.eventBatch, event)
	shouldFlush := len(c.eventBatch) >= 100
	c.eventMu.Unlock()
	if shouldFlush {
		select {
		case c.flushCh <- struct{}{}:
		default:
		}
	}
}

func (c *CassandraStore) SnapshotPlayer(playerID string, battleID gocql.UUID, frameNumber int, entityID ecs.EntityID, world *ecs.World) {
	snap := &PlayerSnapshot{
		PlayerID:     playerID,
		SnapshotTime: time.Now().UnixMilli(),
		BattleID:     battleID,
		FrameNumber:  frameNumber,
	}

	if pos, ok := world.GetPosition(entityID); ok {
		snap.PositionX = pos.X
		snap.PositionY = pos.Y
		snap.PositionZ = pos.Z
		snap.Heading = pos.Heading
	}
	if hp, ok := world.GetHealth(entityID); ok {
		snap.HP = hp.HP
		snap.MaxHP = hp.MaxHP
		snap.Shield = hp.Shield
	}
	if team, ok := world.GetTeam(entityID); ok {
		snap.TeamID = int(team.TeamID)
	}
	if combat, ok := world.GetCombat(entityID); ok {
		snap.CombatAttack = combat.AttackPower
		snap.CombatDefense = combat.Defense
		snap.CritRate = combat.CritRate
		snap.DodgeRate = combat.DodgeRate
	}
	if buff, ok := world.GetBuff(entityID); ok {
		data, _ := json.Marshal(buff.Buffs)
		snap.BuffData = string(data)
	}
	if skill, ok := world.GetSkill(entityID); ok {
		data, _ := json.Marshal(skill.Skills)
		snap.SkillData = string(data)
	}

	c.WritePlayerSnapshot(snap)
}

func (c *CassandraStore) QueryBattleLogs(battleID gocql.UUID, fromFrame, toFrame int) ([]*BattleLog, error) {
	query := `SELECT battle_id, frame_number, timestamp, player_id, event_type, event_data FROM battle_logs WHERE battle_id = ? AND frame_number >= ? AND frame_number <= ?`
	iter := c.session.Query(query, battleID, fromFrame, toFrame).Iter()

	var logs []*BattleLog
	var log BattleLog
	for iter.Scan(&log.BattleID, &log.FrameNumber, &log.Timestamp, &log.PlayerID, &log.EventType, &log.EventData) {
		logCopy := log
		logs = append(logs, &logCopy)
	}
	if err := iter.Close(); err != nil {
		return nil, err
	}
	return logs, nil
}

func (c *CassandraStore) QueryPlayerSnapshots(playerID string, fromTime, toTime int64) ([]*PlayerSnapshot, error) {
	query := `SELECT player_id, snapshot_time, battle_id, frame_number, position_x, position_y, position_z, heading, hp, max_hp, shield, team_id, combat_attack, combat_defense, combat_crit_rate, combat_dodge_rate, buff_data, skill_data FROM player_snapshots WHERE player_id = ? AND snapshot_time >= ? AND snapshot_time <= ?`
	iter := c.session.Query(query, playerID, fromTime, toTime).Iter()

	var snaps []*PlayerSnapshot
	var s PlayerSnapshot
	for iter.Scan(&s.PlayerID, &s.SnapshotTime, &s.BattleID, &s.FrameNumber, &s.PositionX, &s.PositionY, &s.PositionZ, &s.Heading, &s.HP, &s.MaxHP, &s.Shield, &s.TeamID, &s.CombatAttack, &s.CombatDefense, &s.CritRate, &s.DodgeRate, &s.BuffData, &s.SkillData) {
		sCopy := s
		snaps = append(snaps, &sCopy)
	}
	if err := iter.Close(); err != nil {
		return nil, err
	}
	return snaps, nil
}

func (c *CassandraStore) QueryCombatEvents(battleID gocql.UUID) ([]*CombatEvent, error) {
	query := `SELECT battle_id, event_id, frame_number, timestamp, attacker_id, defender_id, skill_id, damage, is_crit, is_dodge, hp_remaining, shield_remaining FROM combat_events WHERE battle_id = ?`
	iter := c.session.Query(query, battleID).Iter()

	var events []*CombatEvent
	var e CombatEvent
	for iter.Scan(&e.BattleID, &e.EventID, &e.FrameNumber, &e.Timestamp, &e.AttackerID, &e.DefenderID, &e.SkillID, &e.Damage, &e.IsCrit, &e.IsDodge, &e.HPRemaining, &e.ShieldRemaining) {
		eCopy := e
		events = append(events, &eCopy)
	}
	if err := iter.Close(); err != nil {
		return nil, err
	}
	return events, nil
}

func (c *CassandraStore) Close() {
	close(c.done)
	c.session.Close()
}
