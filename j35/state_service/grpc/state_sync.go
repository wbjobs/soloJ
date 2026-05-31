package grpc

import (
	"encoding/json"
	"math"
	"sync"
	"time"

	"state_service/ecs"
	"state_service/store"
)

const (
	FieldPosX       uint32 = 0
	FieldPosY       uint32 = 1
	FieldPosZ       uint32 = 2
	FieldHeading    uint32 = 3
	FieldHP         uint32 = 4
	FieldMaxHP      uint32 = 5
	FieldShield     uint32 = 6
	FieldDead       uint32 = 7
	FieldTeamID     uint32 = 8
	FieldAttack     uint32 = 9
	FieldDefense    uint32 = 10
	FieldCritRate   uint32 = 11
	FieldDodgeRate  uint32 = 12
)

type EntityState struct {
	EntityId    uint64
	PositionX   float64
	PositionY   float64
	PositionZ   float64
	Heading     float64
	Hp          float64
	MaxHp       float64
	Shield      float64
	IsDead      bool
	TeamId      int32
	AttackPower float64
	Defense     float64
	CritRate    float64
	DodgeRate   float64
}

type StateUpdate struct {
	SequenceNumber uint64
	FrameNumber  uint64
	IsSnapshot   bool
	Entities     []*EntityState
	Deltas       []*FieldDelta
}

type FieldDelta struct {
	EntityId  uint64
	FieldName uint32
	OldValue  []byte
	NewValue  []byte
}

type entityCache struct {
	positionX   float64
	positionY   float64
	positionZ   float64
	heading     float64
	hp          float64
	maxHP       float64
	shield      float64
	dead        bool
	teamID      int32
	attackPower float64
	defense     float64
	critRate    float64
	dodgeRate   float64
}

type StateSync struct {
	world      *ecs.World
	redisStore *store.RedisStore
	cassStore  *store.CassandraStore

	mu      sync.RWMutex
	caches  map[ecs.EntityID]*entityCache
	lastSnap *ecs.WorldSnapshot
}

func NewStateSync(world *ecs.World, redis *store.RedisStore, cass *store.CassandraStore) *StateSync {
	return &StateSync{
		world:      world,
		redisStore: redis,
		cassStore:  cass,
		caches:     make(map[ecs.EntityID]*entityCache, 256),
	}
}

func (ss *StateSync) OnFrameTick() {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	entities := ss.world.AllEntities()
	for _, id := range entities {
		ss.updateCache(id)
	}
}

func (ss *StateSync) updateCache(id ecs.EntityID) {
	cache, exists := ss.caches[id]
	if !exists {
		cache = &entityCache{}
		ss.caches[id] = cache
	}

	if pos, ok := ss.world.GetPosition(id); ok {
		cache.positionX = pos.X
		cache.positionY = pos.Y
		cache.positionZ = pos.Z
		cache.heading = pos.Heading
	}
	if hp, ok := ss.world.GetHealth(id); ok {
		cache.hp = hp.HP
		cache.maxHP = hp.MaxHP
		cache.shield = hp.Shield
		cache.dead = hp.Dead
	}
	if team, ok := ss.world.GetTeam(id); ok {
		cache.teamID = team.TeamID
	}
	if combat, ok := ss.world.GetCombat(id); ok {
		cache.attackPower = combat.AttackPower
		cache.defense = combat.Defense
		cache.critRate = combat.CritRate
		cache.dodgeRate = combat.DodgeRate
	}
}

func (ss *StateSync) BuildDeltaUpdate(playerID string, entityID ecs.EntityID, lastFrame uint64, sequence uint64) *StateUpdate {
	frame := ss.world.FrameNumber()

	if frame-lastFrame >= 60 || lastFrame == 0 {
		update := ss.buildFullSnapshot(frame)
		update.SequenceNumber = sequence
		return update
	}

	update := ss.buildDelta(frame, entityID)
	if update != nil {
		update.SequenceNumber = sequence
	}
	return update
}

func (ss *StateSync) buildFullSnapshot(frame uint64) *StateUpdate {
	snapshot := ss.world.Snapshot()
	update := &StateUpdate{
		FrameNumber: frame,
		IsSnapshot:  true,
		Entities:    make([]*EntityState, 0, len(snapshot.Positions)),
	}

	for id, pos := range snapshot.Positions {
		state := &EntityState{
			EntityId:  uint64(id),
			PositionX: pos.X,
			PositionY: pos.Y,
			PositionZ: pos.Z,
			Heading:   pos.Heading,
		}
		if hp, ok := snapshot.Healths[id]; ok {
			state.Hp = hp.HP
			state.MaxHp = hp.MaxHP
			state.Shield = hp.Shield
			state.IsDead = hp.Dead
		}
		if team, ok := snapshot.Teams[id]; ok {
			state.TeamId = team.TeamID
		}
		if combat, ok := snapshot.Combats[id]; ok {
			state.AttackPower = combat.AttackPower
			state.Defense = combat.Defense
			state.CritRate = combat.CritRate
			state.DodgeRate = combat.DodgeRate
		}
		update.Entities = append(update.Entities, state)
	}

	ss.mu.Lock()
	ss.lastSnap = snapshot
	ss.mu.Unlock()

	return update
}

func (ss *StateSync) buildDelta(frame uint64, focusEntity ecs.EntityID) *StateUpdate {
	ss.mu.RLock()
	cache, exists := ss.caches[focusEntity]
	ss.mu.RUnlock()

	if !exists {
		return ss.buildFullSnapshot(frame)
	}

	var deltas []*FieldDelta

	if pos, ok := ss.world.GetPosition(focusEntity); ok {
		deltas = appendDelta(deltas, uint64(focusEntity), FieldPosX, cache.positionX, pos.X)
		deltas = appendDelta(deltas, uint64(focusEntity), FieldPosY, cache.positionY, pos.Y)
		deltas = appendDelta(deltas, uint64(focusEntity), FieldPosZ, cache.positionZ, pos.Z)
		deltas = appendDelta(deltas, uint64(focusEntity), FieldHeading, cache.heading, pos.Heading)
	}
	if hp, ok := ss.world.GetHealth(focusEntity); ok {
		deltas = appendDelta(deltas, uint64(focusEntity), FieldHP, cache.hp, hp.HP)
		deltas = appendDelta(deltas, uint64(focusEntity), FieldMaxHP, cache.maxHP, hp.MaxHP)
		deltas = appendDelta(deltas, uint64(focusEntity), FieldShield, cache.shield, hp.Shield)
		if cache.dead != hp.Dead {
			deltas = append(deltas, &FieldDelta{
				EntityId:  uint64(focusEntity),
				FieldName: FieldDead,
				NewValue:  boolToBytes(hp.Dead),
			})
		}
	}
	if team, ok := ss.world.GetTeam(focusEntity); ok {
		deltas = appendDelta(deltas, uint64(focusEntity), FieldTeamID, float64(cache.teamID), float64(team.TeamID))
	}
	if combat, ok := ss.world.GetCombat(focusEntity); ok {
		deltas = appendDelta(deltas, uint64(focusEntity), FieldAttack, cache.attackPower, combat.AttackPower)
		deltas = appendDelta(deltas, uint64(focusEntity), FieldDefense, cache.defense, combat.Defense)
		deltas = appendDelta(deltas, uint64(focusEntity), FieldCritRate, cache.critRate, combat.CritRate)
		deltas = appendDelta(deltas, uint64(focusEntity), FieldDodgeRate, cache.dodgeRate, combat.DodgeRate)
	}

	if len(deltas) == 0 {
		return nil
	}

	return &StateUpdate{
		FrameNumber: frame,
		IsSnapshot:  false,
		Deltas:      deltas,
	}
}

func appendDelta(deltas []*FieldDelta, entityID uint64, field uint32, oldVal, newVal float64) []*FieldDelta {
	if math.Abs(newVal-oldVal) > 0.001 {
		return append(deltas, &FieldDelta{
			EntityId:  entityID,
			FieldName: field,
			OldValue:  float64ToBytes(oldVal),
			NewValue:  float64ToBytes(newVal),
		})
	}
	return deltas
}

func (ss *StateSync) BuildFrameBroadcast(sequence uint64) *StateUpdate {
	frame := ss.world.FrameNumber()

	var update *StateUpdate
	if frame%60 == 0 {
		update = ss.buildFullSnapshot(frame)
	} else {
		entities := ss.world.AllEntities()
		var deltas []*FieldDelta

		ss.mu.RLock()
		defer ss.mu.RUnlock()

		for _, id := range entities {
			cache, exists := ss.caches[id]
			if !exists {
				continue
			}

			if pos, ok := ss.world.GetPosition(id); ok {
				deltas = appendDelta(deltas, uint64(id), FieldPosX, cache.positionX, pos.X)
				deltas = appendDelta(deltas, uint64(id), FieldPosY, cache.positionY, pos.Y)
				deltas = appendDelta(deltas, uint64(id), FieldPosZ, cache.positionZ, pos.Z)
				deltas = appendDelta(deltas, uint64(id), FieldHeading, cache.heading, pos.Heading)
			}
			if hp, ok := ss.world.GetHealth(id); ok {
				deltas = appendDelta(deltas, uint64(id), FieldHP, cache.hp, hp.HP)
				deltas = appendDelta(deltas, uint64(id), FieldShield, cache.shield, hp.Shield)
				if cache.dead != hp.Dead {
					deltas = append(deltas, &FieldDelta{
						EntityId:  uint64(id),
						FieldName: FieldDead,
						NewValue:  boolToBytes(hp.Dead),
					})
				}
			}
		}

		if len(deltas) == 0 {
			return nil
		}

		update = &StateUpdate{
			FrameNumber: frame,
			IsSnapshot:  false,
			Deltas:      deltas,
		}
	}

	if update != nil {
		update.SequenceNumber = sequence
	}
	return update
}

func (ss *StateSync) PersistSnapshot(battleID string) {
	if ss.cassStore == nil {
		return
	}

	snapshot := ss.world.Snapshot()
	frame := ss.world.FrameNumber()

	for id := range snapshot.Positions {
		playerID := ""
		ss.mu.RLock()
		ss.mu.RUnlock()
		_ = playerID

		var bid [16]byte
		copy(bid[:], []byte(battleID)[:min(16, len(battleID))])

		ss.cassStore.SnapshotPlayer(playerID, bid, int(frame), id, ss.world)
	}
}

func CompressDeltas(deltas []*FieldDelta) []byte {
	if len(deltas) == 0 {
		return nil
	}

	type compactDelta struct {
		EntityID  uint64 `json:"e"`
		Field     uint32 `json:"f"`
		NewValue  []byte `json:"v"`
	}

	compacts := make([]compactDelta, 0, len(deltas))
	for _, d := range deltas {
		compacts = append(compacts, compactDelta{
			EntityID: d.EntityId,
			Field:    d.FieldName,
			NewValue: d.NewValue,
		})
	}

	data, _ := json.Marshal(compacts)
	return data
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func float64ToBytes(v float64) []byte {
	bits := math.Float64bits(v)
	return []byte{
		byte(bits >> 56), byte(bits >> 48), byte(bits >> 40), byte(bits >> 32),
		byte(bits >> 24), byte(bits >> 16), byte(bits >> 8), byte(bits),
	}
}

func boolToBytes(v bool) []byte {
	if v {
		return []byte{1}
	}
	return []byte{0}
}

func (ss *StateSync) RemoveEntity(id ecs.EntityID) {
	ss.mu.Lock()
	delete(ss.caches, id)
	ss.mu.Unlock()
}

func init() {
	_ = time.Now
	_ = json.Marshal
}
