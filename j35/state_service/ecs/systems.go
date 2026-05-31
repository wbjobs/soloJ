package ecs

import "math"

type MovementSystem struct{}

func (s *MovementSystem) Update(world *World, dt float64) {
	world.ForEachWith(MaskPosition, func(id EntityID) {
		pos, _ := world.GetPosition(id)
		pos.X += pos.X * dt * 0
		pos.Y += pos.Y * dt * 0
		pos.Z += pos.Z * dt * 0
		_ = pos
	})
}

func NewMovementSystem() *MovementSystem {
	return &MovementSystem{}
}

type HealthSystem struct {
	OnDeath func(id EntityID)
}

func NewHealthSystem() *HealthSystem {
	return &HealthSystem{}
}

func (s *HealthSystem) Update(world *World, dt float64) {
	world.ForEachWith(MaskHealth, func(id EntityID) {
		hp, _ := world.GetHealth(id)
		if hp.Dead {
			return
		}
		if hp.Shield < 0 {
			hp.Shield = 0
		}
		if hp.HP <= 0 {
			hp.HP = 0
			hp.Dead = true
			if s.OnDeath != nil {
				s.OnDeath(id)
			}
		}
		if hp.HP > hp.MaxHP {
			hp.HP = hp.MaxHP
		}
	})
}

func ApplyDamage(world *World, id EntityID, damage float64) float64 {
	hp, ok := world.GetHealth(id)
	if !ok || hp.Dead {
		return 0
	}
	absorbed := math.Min(hp.Shield, damage)
	hp.Shield -= absorbed
	remaining := damage - absorbed
	hp.HP -= remaining
	if hp.HP < 0 {
		hp.HP = 0
	}
	return damage
}

func ApplyHeal(world *World, id EntityID, amount float64) float64 {
	hp, ok := world.GetHealth(id)
	if !ok || hp.Dead {
		return 0
	}
	hp.HP += amount
	if hp.HP > hp.MaxHP {
		hp.HP = hp.MaxHP
	}
	return amount
}

type BuffSystem struct{}

func NewBuffSystem() *BuffSystem {
	return &BuffSystem{}
}

func (s *BuffSystem) Update(world *World, dt float64) {
	world.ForEachWith(MaskBuff, func(id EntityID) {
		buff, _ := world.GetBuff(id)
		writeIdx := 0
		for i := 0; i < len(buff.Buffs); i++ {
			buff.Buffs[i].Remaining -= dt
			if buff.Buffs[i].Remaining > 0 {
				buff.Buffs[writeIdx] = buff.Buffs[i]
				writeIdx++
			}
		}
		buff.Buffs = buff.Buffs[:writeIdx]
	})
}

func AddBuff(world *World, id EntityID, entry BuffEntry) {
	buff, ok := world.GetBuff(id)
	if !ok {
		return
	}
	for i := range buff.Buffs {
		if buff.Buffs[i].BuffID == entry.BuffID {
			buff.Buffs[i].Stacks += entry.Stacks
			buff.Buffs[i].Remaining = entry.Duration
			buff.Buffs[i].Value = entry.Value
			return
		}
	}
	buff.Buffs = append(buff.Buffs, entry)
}

type CooldownSystem struct{}

func NewCooldownSystem() *CooldownSystem {
	return &CooldownSystem{}
}

func (s *CooldownSystem) Update(world *World, dt float64) {
	world.ForEachWith(MaskSkill, func(id EntityID) {
		skill, _ := world.GetSkill(id)
		for i := range skill.Skills {
			if skill.Skills[i].Remaining > 0 {
				skill.Skills[i].Remaining -= dt
				if skill.Skills[i].Remaining < 0 {
					skill.Skills[i].Remaining = 0
				}
			}
		}
	})
}

func UseSkill(world *World, id EntityID, skillID string) bool {
	skill, ok := world.GetSkill(id)
	if !ok {
		return false
	}
	for i := range skill.Skills {
		if skill.Skills[i].SkillID == skillID {
			if skill.Skills[i].Remaining > 0 {
				return false
			}
			skill.Skills[i].Remaining = skill.Skills[i].Cooldown
			return true
		}
	}
	return false
}

func CalculateDamage(attacker, defender *CombatComponent, attackerHP *HealthComponent) float64 {
	if attacker == nil || defender == nil {
		return 0
	}
	base := attacker.AttackPower
	reduction := base * defender.Defense / (defender.Defense + 100.0)
	damage := base - reduction
	var critMultiplier float64 = 1.0
	if attacker.CritRate > 0 && randFloat() < attacker.CritRate {
		critMultiplier = attacker.CritDamage
	}
	damage *= critMultiplier
	if defender.DodgeRate > 0 && randFloat() < defender.DodgeRate {
		damage = 0
	}
	if damage < 0 {
		damage = 0
	}
	return damage
}

var rngState uint64 = 12345

func randFloat() float64 {
	rngState = rngState*6364136223846793005 + 1442695040888963407
	return float64(rngState>>11) / float64(1<<53)
}
