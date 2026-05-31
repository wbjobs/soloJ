package grpc

import (
	"context"
)

type PlayerOnlineRequest struct {
	PlayerId    string
	PositionX   float64
	PositionY   float64
	PositionZ   float64
	Hp          float64
	MaxHp       float64
	TeamId      int32
	AttackPower float64
	Defense     float64
	CritRate    float64
	DodgeRate   float64
}

type PlayerOnlineResponse struct {
	EntityId uint64
	Success  bool
}

type PlayerOfflineRequest struct {
	PlayerId string
}

type PlayerOfflineResponse struct {
	Success bool
}

type UpdatePositionRequest struct {
	PlayerId string
	X        float64
	Y        float64
	Z        float64
	Heading  float64
}

type UpdatePositionResponse struct {
	Success bool
}

type ApplyDamageRequest struct {
	AttackerPlayerId string
	TargetPlayerId   string
	SkillId          string
	Damage           float64
	IsCrit           bool
}

type ApplyDamageResponse struct {
	DamageDealt     float64
	HpRemaining     float64
	ShieldRemaining float64
	IsDead          bool
}

type ApplyHealRequest struct {
	PlayerId string
	Amount   float64
}

type ApplyHealResponse struct {
	HealAmount float64
	HpRemaining float64
}

type AddBuffRequest struct {
	PlayerId string
	BuffId   string
	Duration float64
	Stacks   int32
	Value    float64
}

type AddBuffResponse struct {
	Success bool
}

type UseSkillRequest struct {
	PlayerId string
	SkillId  string
}

type UseSkillResponse struct {
	Success bool
}

type GetStateRequest struct {
	PlayerId string
}

type GetStateResponse struct {
	EntityId    uint64
	FrameNumber uint64
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

type SubscribeStateRequest struct {
	PlayerId string
}

type GetSnapshotRequest struct {
	BattleId string
}

type SnapshotResponse struct {
	FrameNumber uint64
	Entities    []*EntityState
}

type StateServiceServer interface {
	PlayerOnline(ctx context.Context, req *PlayerOnlineRequest) (*PlayerOnlineResponse, error)
	PlayerOffline(ctx context.Context, req *PlayerOfflineRequest) (*PlayerOfflineResponse, error)
	UpdatePosition(ctx context.Context, req *UpdatePositionRequest) (*UpdatePositionResponse, error)
	ApplyDamage(ctx context.Context, req *ApplyDamageRequest) (*ApplyDamageResponse, error)
	ApplyHeal(ctx context.Context, req *ApplyHealRequest) (*ApplyHealResponse, error)
	AddBuff(ctx context.Context, req *AddBuffRequest) (*AddBuffResponse, error)
	UseSkill(ctx context.Context, req *UseSkillRequest) (*UseSkillResponse, error)
	GetState(ctx context.Context, req *GetStateRequest) (*GetStateResponse, error)
	SubscribeState(req *SubscribeStateRequest, stream StateService_SubscribeStateServer) error
	GetSnapshot(ctx context.Context, req *GetSnapshotRequest) (*SnapshotResponse, error)
}

type UnimplementedStateServiceServer struct{}

func (UnimplementedStateServiceServer) PlayerOnline(context.Context, *PlayerOnlineRequest) (*PlayerOnlineResponse, error) {
	return nil, nil
}
func (UnimplementedStateServiceServer) PlayerOffline(context.Context, *PlayerOfflineRequest) (*PlayerOfflineResponse, error) {
	return nil, nil
}
func (UnimplementedStateServiceServer) UpdatePosition(context.Context, *UpdatePositionRequest) (*UpdatePositionResponse, error) {
	return nil, nil
}
func (UnimplementedStateServiceServer) ApplyDamage(context.Context, *ApplyDamageRequest) (*ApplyDamageResponse, error) {
	return nil, nil
}
func (UnimplementedStateServiceServer) ApplyHeal(context.Context, *ApplyHealRequest) (*ApplyHealResponse, error) {
	return nil, nil
}
func (UnimplementedStateServiceServer) AddBuff(context.Context, *AddBuffRequest) (*AddBuffResponse, error) {
	return nil, nil
}
func (UnimplementedStateServiceServer) UseSkill(context.Context, *UseSkillRequest) (*UseSkillResponse, error) {
	return nil, nil
}
func (UnimplementedStateServiceServer) GetState(context.Context, *GetStateRequest) (*GetStateResponse, error) {
	return nil, nil
}
func (UnimplementedStateServiceServer) SubscribeState(*SubscribeStateRequest, StateService_SubscribeStateServer) error {
	return nil
}
func (UnimplementedStateServiceServer) GetSnapshot(context.Context, *GetSnapshotRequest) (*SnapshotResponse, error) {
	return nil, nil
}

type StateService_SubscribeStateServer interface {
	Send(*StateUpdate) error
	Context() context.Context
}

func RegisterStateServiceServer(srv interface{}, impl StateServiceServer) {
}
