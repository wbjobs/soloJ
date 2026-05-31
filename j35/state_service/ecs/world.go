package ecs

import (
	"fmt"
	"sync"
	"sync/atomic"
)

type EntityID uint64

type System interface {
	Update(world *World, dt float64)
}

type ComponentMask uint64

const (
	MaskPosition ComponentMask = 1 << iota
	MaskHealth
	MaskBuff
	MaskSkill
	MaskTeam
	MaskCombat
)

type World struct {
	mu             sync.RWMutex
	nextEntityID   atomic.Uint64
	entities       map[EntityID]ComponentMask
	positions      map[EntityID]*PositionComponent
	healths        map[EntityID]*HealthComponent
	buffComps      map[EntityID]*BuffComponent
	skillComps     map[EntityID]*SkillComponent
	teams          map[EntityID]*TeamComponent
	combats        map[EntityID]*CombatComponent
	systems        []System
	systemOrder    []int
	deleted        []EntityID
	frameNumber    uint64
	onEntityRemove func(EntityID)
}

func NewWorld() *World {
	return &World{
		entities:   make(map[EntityID]ComponentMask, 2048),
		positions:  make(map[EntityID]*PositionComponent, 2048),
		healths:    make(map[EntityID]*HealthComponent, 2048),
		buffComps:  make(map[EntityID]*BuffComponent, 2048),
		skillComps: make(map[EntityID]*SkillComponent, 2048),
		teams:      make(map[EntityID]*TeamComponent, 2048),
		combats:    make(map[EntityID]*CombatComponent, 2048),
	}
}

func (w *World) SetOnEntityRemove(fn func(EntityID)) {
	w.onEntityRemove = fn
}

func (w *World) CreateEntity() EntityID {
	id := EntityID(w.nextEntityID.Add(1))
	w.mu.Lock()
	w.entities[id] = 0
	w.mu.Unlock()
	return id
}

func (w *World) RemoveEntity(id EntityID) {
	w.mu.Lock()
	w.deleted = append(w.deleted, id)
	w.mu.Unlock()
}

func (w *World) processDeleted() {
	for _, id := range w.deleted {
		mask, ok := w.entities[id]
		if !ok {
			continue
		}
		if mask&MaskPosition != 0 {
			delete(w.positions, id)
		}
		if mask&MaskHealth != 0 {
			delete(w.healths, id)
		}
		if mask&MaskBuff != 0 {
			delete(w.buffComps, id)
		}
		if mask&MaskSkill != 0 {
			delete(w.skillComps, id)
		}
		if mask&MaskTeam != 0 {
			delete(w.teams, id)
		}
		if mask&MaskCombat != 0 {
			delete(w.combats, id)
		}
		delete(w.entities, id)
		if w.onEntityRemove != nil {
			w.onEntityRemove(id)
		}
	}
	w.deleted = w.deleted[:0]
}

func (w *World) AddPosition(id EntityID, comp *PositionComponent) {
	w.mu.Lock()
	w.positions[id] = comp
	w.entities[id] |= MaskPosition
	w.mu.Unlock()
}

func (w *World) AddHealth(id EntityID, comp *HealthComponent) {
	w.mu.Lock()
	w.healths[id] = comp
	w.entities[id] |= MaskHealth
	w.mu.Unlock()
}

func (w *World) AddBuff(id EntityID, comp *BuffComponent) {
	w.mu.Lock()
	w.buffComps[id] = comp
	w.entities[id] |= MaskBuff
	w.mu.Unlock()
}

func (w *World) AddSkill(id EntityID, comp *SkillComponent) {
	w.mu.Lock()
	w.skillComps[id] = comp
	w.entities[id] |= MaskSkill
	w.mu.Unlock()
}

func (w *World) AddTeam(id EntityID, comp *TeamComponent) {
	w.mu.Lock()
	w.teams[id] = comp
	w.entities[id] |= MaskTeam
	w.mu.Unlock()
}

func (w *World) AddCombat(id EntityID, comp *CombatComponent) {
	w.mu.Lock()
	w.combats[id] = comp
	w.entities[id] |= MaskCombat
	w.mu.Unlock()
}

func (w *World) GetPosition(id EntityID) (*PositionComponent, bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	c, ok := w.positions[id]
	return c, ok
}

func (w *World) GetHealth(id EntityID) (*HealthComponent, bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	c, ok := w.healths[id]
	return c, ok
}

func (w *World) GetBuff(id EntityID) (*BuffComponent, bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	c, ok := w.buffComps[id]
	return c, ok
}

func (w *World) GetSkill(id EntityID) (*SkillComponent, bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	c, ok := w.skillComps[id]
	return c, ok
}

func (w *World) GetTeam(id EntityID) (*TeamComponent, bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	c, ok := w.teams[id]
	return c, ok
}

func (w *World) GetCombat(id EntityID) (*CombatComponent, bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	c, ok := w.combats[id]
	return c, ok
}

func (w *World) HasComponents(id EntityID, mask ComponentMask) bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	m, ok := w.entities[id]
	return ok && (m&mask) == mask
}

func (w *World) RegisterSystem(sys System) {
	w.systems = append(w.systems, sys)
	w.systemOrder = append(w.systemOrder, len(w.systems)-1)
}

func (w *World) Update(dt float64) {
	w.frameNumber++
	for _, idx := range w.systemOrder {
		w.systems[idx].Update(w, dt)
	}
	w.mu.Lock()
	w.processDeleted()
	w.mu.Unlock()
}

func (w *World) FrameNumber() uint64 {
	return w.frameNumber
}

func (w *World) EntityCount() int {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return len(w.entities)
}

func (w *World) ForEachWith(mask ComponentMask, fn func(id EntityID)) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	for id, m := range w.entities {
		if (m & mask) == mask {
			fn(id)
		}
	}
}

func (w *World) AllEntities() []EntityID {
	w.mu.RLock()
	defer w.mu.RUnlock()
	result := make([]EntityID, 0, len(w.entities))
	for id := range w.entities {
		result = append(result, id)
	}
	return result
}

func (w *World) Snapshot() *WorldSnapshot {
	w.mu.RLock()
	defer w.mu.RUnlock()

	snap := &WorldSnapshot{
		FrameNumber: w.frameNumber,
		Positions:   make(map[EntityID]PositionComponent, len(w.positions)),
		Healths:     make(map[EntityID]HealthComponent, len(w.healths)),
		Buffs:       make(map[EntityID]BuffComponent, len(w.buffComps)),
		Skills:      make(map[EntityID]SkillComponent, len(w.skillComps)),
		Teams:       make(map[EntityID]TeamComponent, len(w.teams)),
		Combats:     make(map[EntityID]CombatComponent, len(w.combats)),
	}

	for id, c := range w.positions {
		snap.Positions[id] = *c
	}
	for id, c := range w.healths {
		snap.Healths[id] = *c
	}
	for id, c := range w.buffComps {
		snap.Buffs[id] = *c
	}
	for id, c := range w.skillComps {
		snap.Skills[id] = *c
	}
	for id, c := range w.teams {
		snap.Teams[id] = *c
	}
	for id, c := range w.combats {
		snap.Combats[id] = *c
	}

	return snap
}

type WorldSnapshot struct {
	FrameNumber uint64
	Positions   map[EntityID]PositionComponent
	Healths     map[EntityID]HealthComponent
	Buffs       map[EntityID]BuffComponent
	Skills      map[EntityID]SkillComponent
	Teams       map[EntityID]TeamComponent
	Combats     map[EntityID]CombatComponent
}

func (w *World) GetEntityMask(id EntityID) (ComponentMask, bool) {
	w.mu.RLock()
	defer w.mu.RUnlock()
	m, ok := w.entities[id]
	return m, ok
}

func (w *World) ValidateEntity(id EntityID) error {
	w.mu.RLock()
	defer w.mu.RUnlock()
	if _, ok := w.entities[id]; !ok {
		return fmt.Errorf("entity %d not found", id)
	}
	return nil
}
