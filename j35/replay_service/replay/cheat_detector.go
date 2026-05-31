package replay

import (
	"encoding/json"
	"math"
	"sort"

	kafkaPkg "replay_service/kafka"
)

type ViolationType string

const (
	ViolationSkillFrequency  ViolationType = "skill_frequency_anomaly"
	ViolationMovementSpeed   ViolationType = "movement_speed_anomaly"
	ViolationReactionTime    ViolationType = "reaction_time_anomaly"
	ViolationTargetLock      ViolationType = "target_lock_anomaly"
	ViolationOperationPattern ViolationType = "operation_pattern_anomaly"
)

type CheatViolation struct {
	PlayerID   string        `json:"player_id"`
	Violation  ViolationType `json:"violation_type"`
	Severity   int           `json:"severity"`
	Timestamp  int64         `json:"timestamp"`
	Evidence   string        `json:"evidence"`
	ExtraData  interface{}   `json:"extra_data,omitempty"`
}

type CheatReport struct {
	BattleID     string           `json:"battle_id"`
	PlayerID     string           `json:"player_id"`
	Violations   []CheatViolation `json:"violations"`
	TotalScore   float64          `json:"total_score"`
	IsCheating   bool             `json:"is_cheating"`
}

type CheatDetector struct {
	MaxMovementSpeed    float64
	MinReactionTimeMs   int64
	CheatScoreThreshold float64
}

type CheatDetectorConfig struct {
	MaxMovementSpeed    float64
	MinReactionTimeMs   int64
	CheatScoreThreshold float64
}

func NewCheatDetector(cfg CheatDetectorConfig) *CheatDetector {
	return &CheatDetector{
		MaxMovementSpeed:    cfg.MaxMovementSpeed,
		MinReactionTimeMs:   cfg.MinReactionTimeMs,
		CheatScoreThreshold: cfg.CheatScoreThreshold,
	}
}

func DefaultCheatDetector() *CheatDetector {
	return &CheatDetector{
		MaxMovementSpeed:    10.0,
		MinReactionTimeMs:   50,
		CheatScoreThreshold: 25.0,
	}
}

func (cd *CheatDetector) AnalyzeReplay(session *ReplaySession) []CheatReport {
	playerEvents := cd.groupEventsByPlayer(session.Events)

	var reports []CheatReport
	for playerID, events := range playerEvents {
		report := cd.analyzePlayer(session.BattleID, playerID, events)
		reports = append(reports, report)
	}

	return reports
}

func (cd *CheatDetector) groupEventsByPlayer(events []ReplayEvent) map[string][]ReplayEvent {
	result := make(map[string][]ReplayEvent)
	for _, evt := range events {
		var playerID string
		switch evt.EventType {
		case EventTypeCombat:
			var e kafkaPkg.CombatEvent
			if json.Unmarshal(evt.RawData, &e) == nil {
				playerID = e.SourceID
			}
		case EventTypeMovement:
			var e kafkaPkg.MovementEvent
			if json.Unmarshal(evt.RawData, &e) == nil {
				playerID = e.UnitID
			}
		case EventTypeSkill:
			var e kafkaPkg.SkillEvent
			if json.Unmarshal(evt.RawData, &e) == nil {
				playerID = e.CasterID
			}
		case EventTypeBuff:
			var e kafkaPkg.BuffEvent
			if json.Unmarshal(evt.RawData, &e) == nil {
				playerID = e.UnitID
			}
		case EventTypeDeath:
			var e kafkaPkg.DeathEvent
			if json.Unmarshal(evt.RawData, &e) == nil {
				playerID = e.UnitID
			}
		}
		if playerID != "" {
			result[playerID] = append(result[playerID], evt)
		}
	}
	return result
}

func (cd *CheatDetector) analyzePlayer(battleID, playerID string, events []ReplayEvent) CheatReport {
	report := CheatReport{
		BattleID: battleID,
		PlayerID: playerID,
	}

	report.Violations = append(report.Violations, cd.detectSkillFrequency(playerID, events)...)
	report.Violations = append(report.Violations, cd.detectMovementSpeed(playerID, events)...)
	report.Violations = append(report.Violations, cd.detectReactionTime(playerID, events)...)
	report.Violations = append(report.Violations, cd.detectTargetLock(playerID, events)...)
	report.Violations = append(report.Violations, cd.detectOperationPattern(playerID, events)...)

	var totalScore float64
	for _, v := range report.Violations {
		totalScore += float64(v.Severity)
	}
	report.TotalScore = totalScore
	report.IsCheating = totalScore > cd.CheatScoreThreshold

	return report
}

func (cd *CheatDetector) detectSkillFrequency(playerID string, events []ReplayEvent) []CheatViolation {
	skillEvents := cd.filterByType(events, EventTypeSkill)
	if len(skillEvents) < 2 {
		return nil
	}

	type skillCast struct {
		skillID   uint32
		timestamp int64
		cd        int64
	}

	var casts []skillCast
	for _, evt := range skillEvents {
		var e kafkaPkg.SkillEvent
		if json.Unmarshal(evt.RawData, &e) != nil {
			continue
		}
		casts = append(casts, skillCast{skillID: e.SkillID, timestamp: e.Timestamp, cd: e.CD})
	}

	skillLastCast := make(map[uint32]int64)
	var violations []CheatViolation

	for _, c := range casts {
		lastTs, exists := skillLastCast[c.skillID]
		if !exists {
			skillLastCast[c.skillID] = c.timestamp
			continue
		}

		cdMs := c.cd
		if cdMs <= 0 {
			cdMs = 1000
		}

		elapsed := c.timestamp - lastTs
		if elapsed < cdMs {
			severity := cd.calcSkillSeverity(cdMs, elapsed)
			violations = append(violations, CheatViolation{
				PlayerID:  playerID,
				Violation: ViolationSkillFrequency,
				Severity:  severity,
				Timestamp: c.timestamp,
				Evidence:  "skill cast during cooldown",
				ExtraData: map[string]interface{}{
					"skill_id":    c.skillID,
					"cd_ms":       cdMs,
					"elapsed_ms":  elapsed,
					"violation_ms": cdMs - elapsed,
				},
			})
		}
		skillLastCast[c.skillID] = c.timestamp
	}

	return violations
}

func (cd *CheatDetector) calcSkillSeverity(cdMs, elapsed int64) int {
	ratio := float64(elapsed) / float64(cdMs)
	switch {
	case ratio < 0.1:
		return 10
	case ratio < 0.3:
		return 8
	case ratio < 0.5:
		return 6
	case ratio < 0.7:
		return 4
	case ratio < 0.9:
		return 2
	default:
		return 1
	}
}

func (cd *CheatDetector) detectMovementSpeed(playerID string, events []ReplayEvent) []CheatViolation {
	movements := cd.filterByType(events, EventTypeMovement)
	if len(movements) < 2 {
		return nil
	}

	var violations []CheatViolation

	for i := 1; i < len(movements); i++ {
		var prev, curr kafkaPkg.MovementEvent
		if json.Unmarshal(movements[i-1].RawData, &prev) != nil {
			continue
		}
		if json.Unmarshal(movements[i].RawData, &curr) != nil {
			continue
		}

		dx := curr.X - prev.X
		dy := curr.Y - prev.Y
		dz := curr.Z - prev.Z
		distance := math.Sqrt(dx*dx + dy*dy + dz*dz)

		dtMs := curr.Timestamp - prev.Timestamp
		if dtMs <= 0 {
			continue
		}
		dtSec := float64(dtMs) / 1000.0
		speed := distance / dtSec

		maxSpeed := cd.MaxMovementSpeed
		if maxSpeed <= 0 {
			maxSpeed = 10.0
		}

		if speed > maxSpeed*3 {
			severity := cd.calcSpeedSeverity(maxSpeed, speed)
			violations = append(violations, CheatViolation{
				PlayerID:  playerID,
				Violation: ViolationMovementSpeed,
				Severity:  severity,
				Timestamp: curr.Timestamp,
				Evidence:  "movement speed exceeds 3x maximum",
				ExtraData: map[string]interface{}{
					"speed":      speed,
					"max_speed":  maxSpeed,
					"ratio":      speed / maxSpeed,
					"distance":   distance,
					"delta_ms":   dtMs,
				},
			})
		}
	}

	return violations
}

func (cd *CheatDetector) calcSpeedSeverity(maxSpeed, actualSpeed float64) int {
	ratio := actualSpeed / maxSpeed
	switch {
	case ratio > 10:
		return 10
	case ratio > 7:
		return 8
	case ratio > 5:
		return 6
	case ratio > 4:
		return 4
	default:
		return 3
	}
}

func (cd *CheatDetector) detectReactionTime(playerID string, events []ReplayEvent) []CheatViolation {
	combatEvents := cd.filterByType(events, EventTypeCombat)
	skillEvents := cd.filterByType(events, EventTypeSkill)

	if len(combatEvents) == 0 || len(skillEvents) == 0 {
		return nil
	}

	var violations []CheatViolation
	minReaction := cd.MinReactionTimeMs
	if minReaction <= 0 {
		minReaction = 50
	}

	for _, skillEvt := range skillEvents {
		var skill kafkaPkg.SkillEvent
		if json.Unmarshal(skillEvt.RawData, &skill) != nil {
			continue
		}

		for _, combatEvt := range combatEvents {
			var combat kafkaPkg.CombatEvent
			if json.Unmarshal(combatEvt.RawData, &combat) != nil {
				continue
			}

			if combat.TargetID != skill.CasterID {
				continue
			}

			dt := skill.Timestamp - combat.Timestamp
			if dt > 0 && dt < minReaction {
				severity := cd.calcReactionSeverity(minReaction, dt)
				violations = append(violations, CheatViolation{
					PlayerID:  playerID,
					Violation: ViolationReactionTime,
					Severity:  severity,
					Timestamp: skill.Timestamp,
					Evidence:  "reaction time below human limit",
					ExtraData: map[string]interface{}{
						"reaction_ms":     dt,
						"min_expected_ms": minReaction,
					},
				})
			}
		}
	}

	return violations
}

func (cd *CheatDetector) calcReactionSeverity(minMs, actualMs int64) int {
	ratio := float64(actualMs) / float64(minMs)
	switch {
	case ratio < 0.2:
		return 10
	case ratio < 0.4:
		return 8
	case ratio < 0.6:
		return 6
	case ratio < 0.8:
		return 4
	default:
		return 2
	}
}

func (cd *CheatDetector) detectTargetLock(playerID string, events []ReplayEvent) []CheatViolation {
	skillEvents := cd.filterByType(events, EventTypeSkill)
	if len(skillEvents) < 3 {
		return nil
	}

	var violations []CheatViolation

	type targetLock struct {
		targetID  string
		timestamp int64
		skillID   uint32
	}

	var locks []targetLock
	for _, evt := range skillEvents {
		var e kafkaPkg.SkillEvent
		if json.Unmarshal(evt.RawData, &e) != nil {
			continue
		}
		if e.TargetID != "" {
			locks = append(locks, targetLock{targetID: e.TargetID, timestamp: e.Timestamp, skillID: e.SkillID})
		}
	}

	if len(locks) < 3 {
		return nil
	}

	invisibleCount := 0
	for i := 1; i < len(locks); i++ {
		dt := locks[i].timestamp - locks[i-1].timestamp
		if dt < 100 && locks[i].targetID != locks[i-1].targetID {
			invisibleCount++
		}
	}

	if invisibleCount >= 3 {
		severity := 5 + invisibleCount
		if severity > 10 {
			severity = 10
		}
		violations = append(violations, CheatViolation{
			PlayerID:  playerID,
			Violation: ViolationTargetLock,
			Severity:  severity,
			Timestamp: locks[0].timestamp,
			Evidence:  "rapidly locking unseen targets",
			ExtraData: map[string]interface{}{
				"invisible_locks": invisibleCount,
				"total_locks":     len(locks),
			},
		})
	}

	return violations
}

func (cd *CheatDetector) detectOperationPattern(playerID string, events []ReplayEvent) []CheatViolation {
	skillEvents := cd.filterByType(events, EventTypeSkill)
	if len(skillEvents) < 10 {
		return nil
	}

	var intervals []float64
	for i := 1; i < len(skillEvents); i++ {
		var prev, curr kafkaPkg.SkillEvent
		if json.Unmarshal(skillEvents[i-1].RawData, &prev) != nil {
			continue
		}
		if json.Unmarshal(skillEvents[i].RawData, &curr) != nil {
			continue
		}
		interval := float64(curr.Timestamp - prev.Timestamp)
		if interval > 0 {
			intervals = append(intervals, interval)
		}
	}

	if len(intervals) < 5 {
		return nil
	}

	variance := calcVariance(intervals)
	mean := calcMean(intervals)

	if mean == 0 {
		return nil
	}

	cv := math.Sqrt(variance) / mean

	var violations []CheatViolation

	if cv < 0.05 {
		severity := 8
		violations = append(violations, CheatViolation{
			PlayerID:  playerID,
			Violation: ViolationOperationPattern,
			Severity:  severity,
			Timestamp: skillEvents[0].Timestamp,
			Evidence:  "extremely low variance in operation intervals (script-like)",
			ExtraData: map[string]interface{}{
				"cv":           cv,
				"mean_ms":      mean,
				"variance":     variance,
				"sample_count": len(intervals),
			},
		})
	} else if cv < 0.1 {
		severity := 5
		violations = append(violations, CheatViolation{
			PlayerID:  playerID,
			Violation: ViolationOperationPattern,
			Severity:  severity,
			Timestamp: skillEvents[0].Timestamp,
			Evidence:  "low variance in operation intervals (possible script)",
			ExtraData: map[string]interface{}{
				"cv":           cv,
				"mean_ms":      mean,
				"variance":     variance,
				"sample_count": len(intervals),
			},
		})
	}

	return violations
}

func (cd *CheatDetector) filterByType(events []ReplayEvent, eventType ReplayEventType) []ReplayEvent {
	var result []ReplayEvent
	for _, e := range events {
		if e.EventType == eventType {
			result = append(result, e)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Timestamp < result[j].Timestamp
	})
	return result
}

func calcMean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	var sum float64
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func calcVariance(values []float64) float64 {
	if len(values) < 2 {
		return 0
	}
	mean := calcMean(values)
	var sum float64
	for _, v := range values {
		diff := v - mean
		sum += diff * diff
	}
	return sum / float64(len(values)-1)
}
