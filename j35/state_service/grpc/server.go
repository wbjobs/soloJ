package grpc

import (
	"context"
	"fmt"
	"io"
	"math"
	"net"
	"os"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/status"

	"state_service/ecs"
	"state_service/kafka"
	"state_service/store"
)

const (
	MaxReorderBufferSize = 60
)

type PendingUpdate struct {
	SequenceNumber uint64
	FrameNumber  uint64
	Update       *StateUpdate
	ReceivedAt   time.Time
}

type PlayerConnection struct {
	PlayerID         string
	EntityID         ecs.EntityID
	Stream           StateService_SubscribeStateServer
	Active           atomic.Bool
	LastAckedFrame   uint64
	LastSentSequence uint64
	ExpectedSequence uint64

	reorderMu     sync.Mutex
	reorderBuffer []*PendingUpdate
}

type StateServer struct {
	UnimplementedStateServiceServer

	world       *ecs.World
	redisStore  *store.RedisStore
	cassStore   *store.CassandraStore
	stateSync   *StateSync
	kafkaProd   *kafka.BattleEventProducer

	mu         sync.RWMutex
	players    map[string]*PlayerConnection
	entityMap  map[ecs.EntityID]string

	grpcServer         *grpc.Server
	playerSeq          atomic.Uint64
	globalSequence     atomic.Uint64
	battleID           string
}

type ServerConfig struct {
	ListenAddr  string
	RedisStore  *store.RedisStore
	CassStore   *store.CassandraStore
	World       *ecs.World
	KafkaBroker string
}

func NewStateServer(cfg ServerConfig) *StateServer {
	s := &StateServer{
		world:      cfg.World,
		redisStore: cfg.RedisStore,
		cassStore:  cfg.CassStore,
		players:    make(map[string]*PlayerConnection, 256),
		entityMap:  make(map[ecs.EntityID]string, 256),
		battleID:   fmt.Sprintf("battle_%d", time.Now().UnixMilli()),
	}

	if cfg.KafkaBroker != "" && os.Getenv("KAFKA_ENABLED") == "true" {
		brokers := strings.Split(cfg.KafkaBroker, ",")
		prod, err := kafka.NewBattleEventProducer(brokers)
		if err != nil {
			fmt.Printf("Kafka producer init failed: %v, continuing without kafka\n", err)
		} else {
			s.kafkaProd = prod
			fmt.Printf("Kafka producer connected to %s\n", cfg.KafkaBroker)
		}
	}

	s.stateSync = NewStateSync(cfg.World, cfg.RedisStore, cfg.CassStore)

	cfg.World.SetOnEntityRemove(func(id ecs.EntityID) {
		s.mu.Lock()
		if playerID, ok := s.entityMap[id]; ok {
			delete(s.players, playerID)
			delete(s.entityMap, id)
		}
		s.mu.Unlock()
	})

	kaParams := keepalive.ServerParameters{
		MaxConnectionIdle:     30 * time.Second,
		MaxConnectionAge:      5 * time.Minute,
		MaxConnectionAgeGrace: 10 * time.Second,
		Time:                  10 * time.Second,
		Timeout:               3 * time.Second,
	}

	s.grpcServer = grpc.NewServer(
		grpc.MaxRecvMsgSize(4*1024*1024),
		grpc.MaxSendMsgSize(4*1024*1024),
		grpc.KeepaliveParams(kaParams),
		grpc.KeepaliveEnforcementPolicy(keepalive.EnforcementPolicy{
			MinTime:             5 * time.Second,
			PermitWithoutStream: true,
		}),
	)

	RegisterStateServiceServer(s.grpcServer, s)

	return s
}

func (s *StateServer) nextSequence() uint64 {
	return s.globalSequence.Add(1)
}

func (pc *PlayerConnection) addToReorderBuffer(update *PendingUpdate) bool {
	pc.reorderMu.Lock()
	defer pc.reorderMu.Unlock()

	if update.SequenceNumber < pc.ExpectedSequence {
		return false
	}

	for _, existing := range pc.reorderBuffer {
		if existing.SequenceNumber == update.SequenceNumber {
			return false
		}
	}

	pc.reorderBuffer = append(pc.reorderBuffer, update)
	sort.Slice(pc.reorderBuffer, func(i, j int) bool {
		return pc.reorderBuffer[i].SequenceNumber < pc.reorderBuffer[j].SequenceNumber
	})

	if len(pc.reorderBuffer) > MaxReorderBufferSize {
		if len(pc.reorderBuffer) > 0 {
			pc.ExpectedSequence = pc.reorderBuffer[0].SequenceNumber
		}
		pc.reorderBuffer = pc.reorderBuffer[:0]
	}

	return true
}

func (pc *PlayerConnection) drainReorderBuffer() []*PendingUpdate {
	pc.reorderMu.Lock()
	defer pc.reorderMu.Unlock()

	var ready []*PendingUpdate
	for len(pc.reorderBuffer) > 0 && pc.reorderBuffer[0].SequenceNumber == pc.ExpectedSequence {
		ready = append(ready, pc.reorderBuffer[0])
		pc.ExpectedSequence++
		pc.reorderBuffer = pc.reorderBuffer[1:]
	}

	return ready
}

func (s *StateServer) Start(addr string) error {
	lis, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("listen failed: %w", err)
	}
	fmt.Printf("gRPC server listening on %s\n", addr)
	return s.grpcServer.Serve(lis)
}

func (s *StateServer) Stop() {
	if s.kafkaProd != nil {
		s.kafkaProd.Close()
	}
	s.grpcServer.GracefulStop()
}

func (s *StateServer) PlayerOnline(ctx context.Context, req *PlayerOnlineRequest) (*PlayerOnlineResponse, error) {
	s.mu.Lock()
	if _, exists := s.players[req.PlayerId]; exists {
		s.mu.Unlock()
		return nil, status.Errorf(codes.AlreadyExists, "player %s already online", req.PlayerId)
	}

	entityID := s.world.CreateEntity()

	conn := &PlayerConnection{
		PlayerID: req.PlayerId,
		EntityID: entityID,
	}
	conn.Active.Store(true)

	s.players[req.PlayerId] = conn
	s.entityMap[entityID] = req.PlayerId
	s.mu.Unlock()

	s.world.AddPosition(entityID, &ecs.PositionComponent{
		X: req.PositionX,
		Y: req.PositionY,
		Z: req.PositionZ,
	})
	s.world.AddHealth(entityID, &ecs.HealthComponent{
		HP:    req.Hp,
		MaxHP: req.MaxHp,
	})
	s.world.AddTeam(entityID, &ecs.TeamComponent{
		TeamID: req.TeamId,
	})
	s.world.AddCombat(entityID, &ecs.CombatComponent{
		AttackPower: req.AttackPower,
		Defense:     req.Defense,
		CritRate:    req.CritRate,
		DodgeRate:   req.DodgeRate,
	})
	s.world.AddBuff(entityID, &ecs.BuffComponent{})
	s.world.AddSkill(entityID, &ecs.SkillComponent{})

	s.redisStore.SetKey(
		fmt.Sprintf("player:online:%s", req.PlayerId),
		fmt.Sprintf("%d", entityID),
		30*time.Minute,
	)

	return &PlayerOnlineResponse{
		EntityId: uint64(entityID),
		Success:  true,
	}, nil
}

func (s *StateServer) PlayerOffline(ctx context.Context, req *PlayerOfflineRequest) (*PlayerOfflineResponse, error) {
	s.mu.Lock()
	conn, exists := s.players[req.PlayerId]
	if !exists {
		s.mu.Unlock()
		return nil, status.Errorf(codes.NotFound, "player %s not online", req.PlayerId)
	}
	conn.Active.Store(false)
	delete(s.players, req.PlayerId)
	delete(s.entityMap, conn.EntityID)
	s.mu.Unlock()

	s.world.RemoveEntity(conn.EntityID)

	s.redisStore.DeletePlayerState(req.PlayerId)
	s.redisStore.SetKey(
		fmt.Sprintf("player:offline:%s", req.PlayerId),
		fmt.Sprintf("%d", time.Now().Unix()),
		5*time.Minute,
	)

	return &PlayerOfflineResponse{Success: true}, nil
}

func (s *StateServer) UpdatePosition(ctx context.Context, req *UpdatePositionRequest) (*UpdatePositionResponse, error) {
	s.mu.RLock()
	conn, exists := s.players[req.PlayerId]
	s.mu.RUnlock()
	if !exists {
		return nil, status.Errorf(codes.NotFound, "player %s not online", req.PlayerId)
	}

	pos, ok := s.world.GetPosition(conn.EntityID)
	if !ok {
		return nil, status.Errorf(codes.NotFound, "position component not found")
	}

	pos.X = req.X
	pos.Y = req.Y
	pos.Z = req.Z
	pos.Heading = req.Heading

	return &UpdatePositionResponse{Success: true}, nil
}

func (s *StateServer) ApplyDamage(ctx context.Context, req *ApplyDamageRequest) (*ApplyDamageResponse, error) {
	s.mu.RLock()
	targetConn, exists := s.players[req.TargetPlayerId]
	s.mu.RUnlock()
	if !exists {
		return nil, status.Errorf(codes.NotFound, "target player %s not online", req.TargetPlayerId)
	}

	damage := ecs.ApplyDamage(s.world, targetConn.EntityID, req.Damage)

	hp, _ := s.world.GetHealth(targetConn.EntityID)

	if s.cassStore != nil {
		s.cassStore.WriteCombatEvent(&store.CombatEvent{
			EventID:     timeNowUUID(),
			FrameNumber: int(s.world.FrameNumber()),
			Timestamp:   time.Now().UnixMilli(),
			AttackerID:  req.AttackerPlayerId,
			DefenderID:  req.TargetPlayerId,
			SkillID:     req.SkillId,
			Damage:      damage,
			IsCrit:      req.IsCrit,
			HPRemaining: hp.HP,
			ShieldRemaining: hp.Shield,
		})
	}

	if s.kafkaProd != nil {
		s.kafkaProd.PublishCombatEvent(kafka.CombatEventMsg{
			BattleID:    s.battleID,
			FrameNumber: s.world.FrameNumber(),
			Timestamp:   time.Now().UnixMilli(),
			AttackerID:  req.AttackerPlayerId,
			DefenderID:  req.TargetPlayerId,
			SkillID:     req.SkillId,
			Damage:      damage,
			IsCrit:      req.IsCrit,
			IsBlocked:   req.IsBlocked,
			HPRemaining: hp.HP,
		})

		if hp.Dead {
			s.kafkaProd.PublishDeathEvent(kafka.DeathEventMsg{
				BattleID:    s.battleID,
				FrameNumber: s.world.FrameNumber(),
				Timestamp:   time.Now().UnixMilli(),
				PlayerID:    req.TargetPlayerId,
				KillerID:    req.AttackerPlayerId,
			})
		}
	}

	return &ApplyDamageResponse{
		DamageDealt:  damage,
		HpRemaining:  hp.HP,
		ShieldRemaining: hp.Shield,
		IsDead:       hp.Dead,
	}, nil
}

func (s *StateServer) ApplyHeal(ctx context.Context, req *ApplyHealRequest) (*ApplyHealResponse, error) {
	s.mu.RLock()
	conn, exists := s.players[req.PlayerId]
	s.mu.RUnlock()
	if !exists {
		return nil, status.Errorf(codes.NotFound, "player %s not online", req.PlayerId)
	}

	healed := ecs.ApplyHeal(s.world, conn.EntityID, req.Amount)
	hp, _ := s.world.GetHealth(conn.EntityID)

	return &ApplyHealResponse{
		HealAmount:  healed,
		HpRemaining: hp.HP,
	}, nil
}

func (s *StateServer) AddBuff(ctx context.Context, req *AddBuffRequest) (*AddBuffResponse, error) {
	s.mu.RLock()
	conn, exists := s.players[req.PlayerId]
	s.mu.RUnlock()
	if !exists {
		return nil, status.Errorf(codes.NotFound, "player %s not online", req.PlayerId)
	}

	ecs.AddBuff(s.world, conn.EntityID, ecs.BuffEntry{
		BuffID:    req.BuffId,
		Duration:  req.Duration,
		Remaining: req.Duration,
		Stacks:    int32(req.Stacks),
		Value:     req.Value,
	})

	return &AddBuffResponse{Success: true}, nil
}

func (s *StateServer) UseSkill(ctx context.Context, req *UseSkillRequest) (*UseSkillResponse, error) {
	s.mu.RLock()
	conn, exists := s.players[req.PlayerId]
	s.mu.RUnlock()
	if !exists {
		return nil, status.Errorf(codes.NotFound, "player %s not online", req.PlayerId)
	}

	success := ecs.UseSkill(s.world, conn.EntityID, req.SkillId)
	return &UseSkillResponse{
		Success: success,
	}, nil
}

func (s *StateServer) GetState(ctx context.Context, req *GetStateRequest) (*GetStateResponse, error) {
	s.mu.RLock()
	conn, exists := s.players[req.PlayerId]
	s.mu.RUnlock()
	if !exists {
		return nil, status.Errorf(codes.NotFound, "player %s not online", req.PlayerId)
	}

	resp := &GetStateResponse{
		EntityId:    uint64(conn.EntityID),
		FrameNumber: s.world.FrameNumber(),
	}

	if pos, ok := s.world.GetPosition(conn.EntityID); ok {
		resp.PositionX = pos.X
		resp.PositionY = pos.Y
		resp.PositionZ = pos.Z
		resp.Heading = pos.Heading
	}
	if hp, ok := s.world.GetHealth(conn.EntityID); ok {
		resp.Hp = hp.HP
		resp.MaxHp = hp.MaxHP
		resp.Shield = hp.Shield
		resp.IsDead = hp.Dead
	}
	if team, ok := s.world.GetTeam(conn.EntityID); ok {
		resp.TeamId = team.TeamID
	}
	if combat, ok := s.world.GetCombat(conn.EntityID); ok {
		resp.AttackPower = combat.AttackPower
		resp.Defense = combat.Defense
		resp.CritRate = combat.CritRate
		resp.DodgeRate = combat.DodgeRate
	}

	return resp, nil
}

func (s *StateServer) SubscribeState(req *SubscribeStateRequest, stream StateService_SubscribeStateServer) error {
	s.mu.Lock()
	conn, exists := s.players[req.PlayerId]
	if !exists {
		s.mu.Unlock()
		return status.Errorf(codes.NotFound, "player %s not online", req.PlayerId)
	}
	conn.Stream = stream
	conn.ExpectedSequence = 1
	conn.LastAckedFrame = req.LastAckedFrame
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		if c, ok := s.players[req.PlayerId]; ok {
			c.Stream = nil
		}
		s.mu.Unlock()
	}()

	go s.processIncomingUpdates(conn, stream)

	ticker := time.NewTicker(16 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if !conn.Active.Load() {
				return nil
			}

			seq := s.nextSequence()
			update := s.stateSync.BuildDeltaUpdate(req.PlayerId, conn.EntityID, conn.LastAckedFrame, seq)
			if update == nil {
				continue
			}

			conn.LastSentSequence = seq

			if err := stream.Send(update); err != nil {
				if err == io.EOF {
					return nil
				}
				return err
			}

		case <-stream.Context().Done():
			return nil
		}
	}
}

func (s *StateServer) processIncomingUpdates(conn *PlayerConnection, stream StateService_SubscribeStateServer) {
	for {
		select {
		case <-stream.Context().Done():
			return
		default:
			msg, err := stream.Recv()
			if err != nil {
				if err == io.EOF {
					return
				}
				return
			}

			if msg == nil {
				continue
			}

			pending := &PendingUpdate{
				SequenceNumber: msg.SequenceNumber,
				FrameNumber:  msg.FrameNumber,
				Update:       msg,
				ReceivedAt:   time.Now(),
			}

			if !conn.addToReorderBuffer(pending) {
				continue
			}

			ready := conn.drainReorderBuffer()
			for _, r := range ready {
				if r.Update.FrameNumber > conn.LastAckedFrame {
					conn.LastAckedFrame = r.Update.FrameNumber
					s.applyStateUpdate(r.Update, conn)
				}
			}
		}
	}
}

func (s *StateServer) applyStateUpdate(update *StateUpdate, conn *PlayerConnection) {
	if update.IsSnapshot {
		for _, ent := range update.Entities {
			id := ecs.EntityID(ent.EntityId)
			if pos, ok := s.world.GetPosition(id); ok {
				pos.X = ent.PositionX
				pos.Y = ent.PositionY
				pos.Z = ent.PositionZ
				pos.Heading = ent.Heading
			}
			if hp, ok := s.world.GetHealth(id); ok {
				hp.HP = ent.Hp
				hp.MaxHP = ent.MaxHp
				hp.Shield = ent.Shield
				hp.Dead = ent.IsDead
			}
		}
	} else {
		for _, delta := range update.Deltas {
			id := ecs.EntityID(delta.EntityId)
			s.applyFieldDelta(id, delta)
		}
	}
}

func (s *StateServer) applyFieldDelta(entityID ecs.EntityID, delta *FieldDelta) {
	switch delta.FieldName {
	case FieldPosX:
		if pos, ok := s.world.GetPosition(entityID); ok {
			pos.X = bytesToFloat64(delta.NewValue)
		}
	case FieldPosY:
		if pos, ok := s.world.GetPosition(entityID); ok {
			pos.Y = bytesToFloat64(delta.NewValue)
		}
	case FieldPosZ:
		if pos, ok := s.world.GetPosition(entityID); ok {
			pos.Z = bytesToFloat64(delta.NewValue)
		}
	case FieldHeading:
		if pos, ok := s.world.GetPosition(entityID); ok {
			pos.Heading = bytesToFloat64(delta.NewValue)
		}
	case FieldHP:
		if hp, ok := s.world.GetHealth(entityID); ok {
			hp.HP = bytesToFloat64(delta.NewValue)
			if hp.HP <= 0 {
				hp.Dead = true
			}
		}
	case FieldShield:
		if hp, ok := s.world.GetHealth(entityID); ok {
			hp.Shield = bytesToFloat64(delta.NewValue)
		}
	case FieldDead:
		if hp, ok := s.world.GetHealth(entityID); ok {
			hp.Dead = len(delta.NewValue) > 0 && delta.NewValue[0] == 1
		}
	}
}

func bytesToFloat64(b []byte) float64 {
	if len(b) < 8 {
		return 0
	}
	var bits uint64
	for i := 0; i < 8; i++ {
		bits |= uint64(b[i]) << uint64(56-i*8)
	}
	return math.Float64frombits(bits)
}

func (s *StateServer) GetSnapshot(ctx context.Context, req *GetSnapshotRequest) (*SnapshotResponse, error) {
	snapshot := s.world.Snapshot()
	resp := &SnapshotResponse{
		FrameNumber: snapshot.FrameNumber,
		Entities:    make([]*EntityState, 0, len(snapshot.Positions)),
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	for id, pos := range snapshot.Positions {
		state := &EntityState{
			EntityId:   uint64(id),
			PositionX:  pos.X,
			PositionY:  pos.Y,
			PositionZ:  pos.Z,
			Heading:    pos.Heading,
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
		resp.Entities = append(resp.Entities, state)
	}

	return resp, nil
}

func (s *StateServer) BroadcastFrame() {
	s.stateSync.OnFrameTick()

	seq := s.nextSequence()
	update := s.stateSync.BuildFrameBroadcast(seq)
	if update == nil {
		return
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, conn := range s.players {
		if conn.Stream != nil && conn.Active.Load() {
			conn.LastSentSequence = seq
			if err := conn.Stream.Send(update); err != nil {
				conn.Active.Store(false)
			}
		}
	}
}

func (s *StateServer) Tick(dt float64) {
	s.world.Update(dt)

	if s.world.FrameNumber()%60 == 0 {
		go s.persistAllPlayers()
	}
}

func (s *StateServer) persistAllPlayers() {
	s.mu.RLock()
	states := make(map[string]ecs.EntityID, len(s.players))
	for pid, conn := range s.players {
		if conn.Active.Load() {
			states[pid] = conn.EntityID
		}
	}
	s.mu.RUnlock()

	if len(states) > 0 {
		s.redisStore.SavePlayerStatesBatch(states, s.world)
	}
}

func timeNowUUID() [16]byte {
	var uuid [16]byte
	now := time.Now().UnixNano()
	for i := 0; i < 8; i++ {
		uuid[i] = byte(now >> (i * 8))
	}
	for i := 8; i < 16; i++ {
		uuid[i] = byte(i)
	}
	uuid[6] = (uuid[6] & 0x0f) | 0x10
	uuid[8] = (uuid[8] & 0x3f) | 0x80
	return uuid
}
