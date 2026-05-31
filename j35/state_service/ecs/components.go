package ecs

type PositionComponent struct {
	X       float64
	Y       float64
	Z       float64
	Heading float64
}

type HealthComponent struct {
	HP     float64
	MaxHP  float64
	Shield float64
	Dead   bool
}

type BuffEntry struct {
	BuffID    string
	Duration  float64
	Remaining float64
	Stacks    int32
	Value     float64
}

type BuffComponent struct {
	Buffs []BuffEntry
}

type SkillEntry struct {
	SkillID   string
	Cooldown  float64
	Remaining float64
	Level     int32
}

type SkillComponent struct {
	Skills []SkillEntry
}

type TeamComponent struct {
	TeamID int32
}

type CombatComponent struct {
	AttackPower  float64
	Defense      float64
	CritRate     float64
	DodgeRate    float64
	CritDamage   float64
}
