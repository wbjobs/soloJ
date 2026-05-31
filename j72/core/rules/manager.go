package rules

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"modbus-fuzzer/core"
)

type MutationType int

const (
	TypeUnknown MutationType = iota
	TypeInvalidFunctionCode
	TypeInvalidDataLength
	TypeOverflowData
	TypeInvalidProtocolID
	TypeInvalidUnitID
	TypeBoundaryValue
	TypeMalformedPacket
	TypeFuzzyBytes
	TypeReversedBytes
	TypeCustom
)

var MutationTypeStrings = map[string]MutationType{
	"invalid_function_code": TypeInvalidFunctionCode,
	"invalid_data_length": TypeInvalidDataLength,
	"overflow_data":     TypeOverflowData,
	"invalid_protocol_id": TypeInvalidProtocolID,
	"invalid_unit_id":  TypeInvalidUnitID,
	"boundary_value": TypeBoundaryValue,
	"malformed_packet": TypeMalformedPacket,
	"fuzzy_bytes":    TypeFuzzyBytes,
	"reversed_bytes": TypeReversedBytes,
	"custom":          TypeCustom,
}

func (m MutationType) String() string {
	for k, v := range MutationTypeStrings {
		if v == m {
			return k
		}
	}
	return "unknown"
}

func ParseMutationType(s string) MutationType {
	if v, ok := MutationTypeStrings[s]; ok {
		return v
	}
	return TypeUnknown
}

func (m MutationType) MarshalJSON() ([]byte, error) {
	return json.Marshal(m.String())
}

func (m *MutationType) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	*m = ParseMutationType(s)
	return nil
}

type MutationRule struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Type        MutationType      `json:"type"`
	Weight      int               `json:"weight"`
	Enabled     bool              `json:"enabled"`
	Parameters  map[string]string `json:"parameters"`
	CreatedAt   int64             `json:"created_at"`
	UpdatedAt   int64             `json:"updated_at"`
}

func (r *MutationRule) Validate() error {
	if r.ID == "" {
		return fmt.Errorf("rule id is required")
	}
	if r.Name == "" {
		return fmt.Errorf("rule name is required")
	}
	if r.Type == TypeUnknown {
		return fmt.Errorf("invalid mutation type")
	}
	if r.Weight < 0 || r.Weight > 100 {
		return fmt.Errorf("weight must be between 0 and 100")
	}
	return nil
}

type RuleManager struct {
	rules   map[string]*MutationRule
	mu    sync.RWMutex
	updates chan *MutationRule
}

func NewRuleManager() *RuleManager {
	return &RuleManager{
		rules:   make(map[string]*MutationRule),
		updates: make(chan *MutationRule, 100),
	}
}

func (rm *RuleManager) AddRule(rule *MutationRule) error {
	if err := rule.Validate(); err != nil {
		return err
	}

	rm.mu.Lock()
	defer rm.mu.Unlock()

	now := time.Now().Unix()
	if rule.CreatedAt == 0 {
		rule.CreatedAt = now
	}
	rule.UpdatedAt = now

	rm.rules[rule.ID] = rule

	select {
	case rm.updates <- rule:
	default:
	}

	return nil
}

func (rm *RuleManager) UpdateRule(rule *MutationRule) error {
	if err := rule.Validate(); err != nil {
		return err
	}

	rm.mu.Lock()
	defer rm.mu.Unlock()

	existing, ok := rm.rules[rule.ID]
	if !ok {
		return fmt.Errorf("rule %s not found", rule.ID)
	}

	rule.CreatedAt = existing.CreatedAt
	rule.UpdatedAt = time.Now().Unix()
	rm.rules[rule.ID] = rule

	select {
	case rm.updates <- rule:
	default:
	}

	return nil
}

func (rm *RuleManager) DeleteRule(id string) error {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if _, ok := rm.rules[id]; !ok {
		return fmt.Errorf("rule %s not found", id)
	}

	delete(rm.rules, id)
	return nil
}

func (rm *RuleManager) GetRule(id string) (*MutationRule, bool) {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	rule, ok := rm.rules[id]
	return rule, ok
}

func (rm *RuleManager) GetAllRules() []*MutationRule {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	rules := make([]*MutationRule, 0, len(rm.rules))
	for _, rule := range rm.rules {
		rules = append(rules, rule)
	}
	return rules
}

func (rm *RuleManager) GetEnabledRules() []*MutationRule {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	rules := make([]*MutationRule, 0)
	for _, rule := range rm.rules {
		if rule.Enabled {
			rules = append(rules, rule)
		}
	}
	return rules
}

func (rm *RuleManager) RuleUpdates() <-chan *MutationRule {
	return rm.updates
}

func (rm *RuleManager) SelectRandomRule() *MutationRule {
	rules := rm.GetEnabledRules()
	if len(rules) == 0 {
		return nil
	}

	totalWeight := 0
	for _, r := range rules {
		totalWeight += r.Weight
	}

	if totalWeight == 0 {
		return rules[core.RandomInt(0, len(rules))]
	}

	rand := core.RandomInt(0, totalWeight)
	current := 0
	for _, r := range rules {
		current += r.Weight
		if current > rand {
			return r
		}
	}

	return rules[len(rules)-1]
}

func (rm *RuleManager) ApplyRule(packet *core.ModbusPacket, rule *MutationRule) *core.ModbusPacket {
	if rule == nil {
		return packet
	}

	switch rule.Type {
	case TypeInvalidFunctionCode:
		packet.FunctionCode = byte(core.RandomInt(0, 255))

	case TypeInvalidDataLength:
		minLen := 0
		maxLen := 255
		if minStr, ok := rule.Parameters["min_length"]; ok {
			fmt.Sscanf(minStr, "%d", &minLen)
		}
		if maxStr, ok := rule.Parameters["max_length"]; ok {
			fmt.Sscanf(maxStr, "%d", &maxLen)
		}
		packet.Data = make([]byte, core.RandomInt(minLen, maxLen+1))

	case TypeOverflowData:
		length := 1000
		if lenStr, ok := rule.Parameters["length"]; ok {
			fmt.Sscanf(lenStr, "%d", &length)
		}
		packet.Data = make([]byte, length)
		for i := range packet.Data {
			packet.Data[i] = 0xFF
		}

	case TypeInvalidProtocolID:
		packet.ProtocolID = uint16(core.RandomInt(1, 65535))

	case TypeInvalidUnitID:
		packet.UnitID = byte(core.RandomInt(0, 255))

	case TypeBoundaryValue:
		if len(packet.Data) >= 4 {
			packet.Data[0] = 0xFF
			packet.Data[1] = 0xFF
			packet.Data[2] = 0x00
			packet.Data[3] = 0x00
		}

	case TypeMalformedPacket:
		packet.Data = make([]byte, core.RandomInt(0, 200))
		for i := range packet.Data {
			packet.Data[i] = byte(core.RandomInt(0, 256))
		}

	case TypeFuzzyBytes:
		for i := range packet.Data {
			if core.RandomInt(0, 100) < 30 {
				packet.Data[i] = byte(core.RandomInt(0, 256))
			}
		}

	case TypeReversedBytes:
		for i, j := 0, len(packet.Data)-1; i < j; i, j = i+1, j-1 {
			packet.Data[i], packet.Data[j] = packet.Data[j], packet.Data[i]
		}

	case TypeCustom:
		if customData, ok := rule.Parameters["data"]; ok {
			packet.Data = []byte(customData)
		}
	}

	packet.Serialize()
	return packet
}
