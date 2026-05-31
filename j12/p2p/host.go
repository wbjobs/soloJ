package p2p

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/fcnet/func-compute/config"
	"github.com/fcnet/func-compute/types"
	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/network"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/protocol"
	"github.com/libp2p/go-libp2p/p2p/discovery/mdns"
	"github.com/libp2p/go-libp2p/p2p/protocol/ping"
	"go.uber.org/zap"
)

const (
	ProtocolHeartbeat protocol.ID = "/fcnet/heartbeat/1.0.0"
	ProtocolTask      protocol.ID = "/fcnet/task/1.0.0"
	ProtocolResult    protocol.ID = "/fcnet/result/1.0.0"
	ProtocolFuncInfo  protocol.ID = "/fcnet/funcinfo/1.0.0"
)

type NodeHost struct {
	host.Host
	cfg          *config.P2PConfig
	logger       *zap.Logger
	ctx          context.Context
	cancel       context.CancelFunc
	nodes        map[peer.ID]*types.NodeInfo
	nodesMutex   sync.RWMutex
	functions    map[types.FunctionID][]peer.ID
	funcMutex    sync.RWMutex
	pingService  *ping.PingService
	mdnsService  mdns.Service
	onNewNode    func(peer.ID)
	onNodeLeave  func(peer.ID)
	onHeartbeat  func(peer.ID, *types.NodeInfo)
	taskHandler  func(peer.ID, *types.Task)
	statusHandler func(peer.ID, *TaskStatusPayload)
}

func NewNodeHost(cfg *config.P2PConfig, logger *zap.Logger) (*NodeHost, error) {
	priv, _, err := crypto.GenerateKeyPairWithReader(crypto.RSA, 2048, rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("generate key pair: %w", err)
	}

	listenAddr := fmt.Sprintf("/ip4/0.0.0.0/tcp/%d", cfg.ListenPort)
	h, err := libp2p.New(
		libp2p.Identity(priv),
		libp2p.ListenAddrStrings(listenAddr),
		libp2p.EnableNATService(),
	)
	if err != nil {
		return nil, fmt.Errorf("create libp2p host: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	nh := &NodeHost{
		Host:      h,
		cfg:       cfg,
		logger:    logger,
		ctx:       ctx,
		cancel:    cancel,
		nodes:     make(map[peer.ID]*types.NodeInfo),
		functions: make(map[types.FunctionID][]peer.ID),
	}

	nh.pingService = ping.NewPingService(h)
	nh.setupStreamHandlers()

	if cfg.EnableMDNS {
		if err := nh.setupMDNS(); err != nil {
			logger.Warn("failed to setup mDNS", zap.Error(err))
		}
	}

	h.Network().Notify(&network.NotifyBundle{
		DisconnectedF: func(n network.Network, conn network.Conn) {
			nh.handlePeerDisconnect(conn.RemotePeer())
		},
	})

	return nh, nil
}

func (nh *NodeHost) setupStreamHandlers() {
	nh.SetStreamHandler(ProtocolHeartbeat, nh.handleHeartbeatStream)
}

func (nh *NodeHost) setupMDNS() error {
	nh.mdnsService = mdns.NewMdnsService(nh.Host, "fcnet-func-compute", &mdnsNotifee{nh: nh})
	return nh.mdnsService.Start()
}

type mdnsNotifee struct {
	nh *NodeHost
}

func (m *mdnsNotifee) HandlePeerFound(pi peer.AddrInfo) {
	m.nh.logger.Info("peer found via mDNS", zap.String("peer", pi.ID.String()))
	if err := m.nh.Connect(m.nh.ctx, pi); err != nil {
		m.nh.logger.Warn("failed to connect to peer", zap.String("peer", pi.ID.String()), zap.Error(err))
	}
}

func (nh *NodeHost) StartHeartbeat(nodeInfo *types.NodeInfo) {
	ticker := time.NewTicker(nh.cfg.HeartbeatInterval)
	go func() {
		for {
			select {
			case <-nh.ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				nh.broadcastHeartbeat(nodeInfo)
			}
		}
	}()
}

func (nh *NodeHost) broadcastHeartbeat(nodeInfo *types.NodeInfo) {
	nh.nodesMutex.RLock()
	peers := make([]peer.ID, 0, len(nh.nodes))
	for p := range nh.nodes {
		peers = append(peers, p)
	}
	nh.nodesMutex.RUnlock()

	for _, p := range peers {
		go func(peerID peer.ID) {
			if err := nh.sendHeartbeat(peerID, nodeInfo); err != nil {
				nh.logger.Debug("failed to send heartbeat", zap.String("peer", peerID.String()), zap.Error(err))
			}
		}(p)
	}
}

func (nh *NodeHost) sendHeartbeat(peerID peer.ID, nodeInfo *types.NodeInfo) error {
	s, err := nh.NewStream(nh.ctx, peerID, ProtocolHeartbeat)
	if err != nil {
		return err
	}
	defer s.Close()

	encoder := json.NewEncoder(s)
	return encoder.Encode(nodeInfo)
}

func (nh *NodeHost) handleHeartbeatStream(s network.Stream) {
	defer s.Close()

	var nodeInfo types.NodeInfo
	decoder := json.NewDecoder(s)
	if err := decoder.Decode(&nodeInfo); err != nil {
		nh.logger.Warn("failed to decode heartbeat", zap.Error(err))
		return
	}

	peerID := s.Conn().RemotePeer()
	nodeInfo.ID = peerID
	nodeInfo.LastHeartbeat = time.Now()

	nh.nodesMutex.Lock()
	nh.nodes[peerID] = &nodeInfo
	nh.nodesMutex.Unlock()

	nh.funcMutex.Lock()
	for _, fid := range nodeInfo.Functions {
		if !containsPeer(nh.functions[fid], peerID) {
			nh.functions[fid] = append(nh.functions[fid], peerID)
		}
	}
	nh.funcMutex.Unlock()

	if nh.onHeartbeat != nil {
		nh.onHeartbeat(peerID, &nodeInfo)
	}
}

func containsPeer(peers []peer.ID, p peer.ID) bool {
	for _, existing := range peers {
		if existing == p {
			return true
		}
	}
	return false
}

func (nh *NodeHost) handlePeerDisconnect(peerID peer.ID) {
	nh.logger.Info("peer disconnected", zap.String("peer", peerID.String()))
	
	nh.nodesMutex.Lock()
	if node, ok := nh.nodes[peerID]; ok {
		node.Status = types.NodeStatusOffline
	}
	nh.nodesMutex.Unlock()

	if nh.onNodeLeave != nil {
		nh.onNodeLeave(peerID)
	}
}

func (nh *NodeHost) GetNodeInfo(peerID peer.ID) (*types.NodeInfo, bool) {
	nh.nodesMutex.RLock()
	defer nh.nodesMutex.RUnlock()
	node, ok := nh.nodes[peerID]
	return node, ok
}

func (nh *NodeHost) GetAllNodes() map[peer.ID]*types.NodeInfo {
	nh.nodesMutex.RLock()
	defer nh.nodesMutex.RUnlock()
	result := make(map[peer.ID]*types.NodeInfo)
	for k, v := range nh.nodes {
		result[k] = v
	}
	return result
}

func (nh *NodeHost) GetFunctionProviders(fid types.FunctionID) []peer.ID {
	nh.funcMutex.RLock()
	defer nh.funcMutex.RUnlock()
	peers := nh.functions[fid]
	result := make([]peer.ID, len(peers))
	copy(result, peers)
	return result
}

func (nh *NodeHost) RegisterFunction(fid types.FunctionID) {
	nh.funcMutex.Lock()
	defer nh.funcMutex.Unlock()
	if !containsPeer(nh.functions[fid], nh.ID()) {
		nh.functions[fid] = append(nh.functions[fid], nh.ID())
	}
}

func (nh *NodeHost) SetOnNewNodeHandler(f func(peer.ID)) {
	nh.onNewNode = f
}

func (nh *NodeHost) SetOnNodeLeaveHandler(f func(peer.ID)) {
	nh.onNodeLeave = f
}

func (nh *NodeHost) SetOnHeartbeatHandler(f func(peer.ID, *types.NodeInfo)) {
	nh.onHeartbeat = f
}

func (nh *NodeHost) getTaskHandler() func(peer.ID, *types.Task) {
	return nh.taskHandler
}

func (nh *NodeHost) getStatusHandler() func(peer.ID, *TaskStatusPayload) {
	return nh.statusHandler
}

func (nh *NodeHost) SetTaskHandler(handler func(peer.ID, *types.Task)) {
	nh.taskHandler = handler
	nh.SetStreamHandler(ProtocolTask, nh.handleTaskStream)
}

func (nh *NodeHost) handleTaskStream(s network.Stream) {
	defer s.Close()

	var msg Message
	decoder := json.NewDecoder(s)
	if err := decoder.Decode(&msg); err != nil {
		if err.Error() != "EOF" {
			nh.logger.Warn("failed to decode task message", zap.Error(err))
		}
		return
	}

	switch msg.Type {
	case MsgTypeTaskSubmit:
		var payload TaskSubmitPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			nh.logger.Warn("failed to unmarshal task payload", zap.Error(err))
			return
		}
		peerID := s.Conn().RemotePeer()
		if nh.taskHandler != nil {
			nh.taskHandler(peerID, payload.Task)
		}

	case MsgTypeTaskStatus:
		var payload TaskStatusPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			nh.logger.Warn("failed to unmarshal status payload", zap.Error(err))
			return
		}
		peerID := s.Conn().RemotePeer()
		if nh.statusHandler != nil {
			nh.statusHandler(peerID, &payload)
		}

	case MsgTypeStatusQuery:
		var payload StatusQueryPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			nh.logger.Warn("failed to unmarshal query payload", zap.Error(err))
			return
		}

		status, result, found := nh.handleStatusQuery(payload.TaskID)
		response := StatusResponsePayload{
			TaskID: payload.TaskID,
			Status: status,
			Result: result,
			Found:  found,
		}

		encoder := json.NewEncoder(s)
		if err := encoder.Encode(Message{
			Type:    MsgTypeStatusResponse,
			Payload: mustMarshal(response),
		}); err != nil {
			nh.logger.Warn("failed to send response", zap.Error(err))
		}
	}
}

var statusQueryHandler func(types.TaskID) (types.TaskStatus, *types.TaskResult, bool)

func (nh *NodeHost) SetStatusQueryHandler(handler func(types.TaskID) (types.TaskStatus, *types.TaskResult, bool)) {
	statusQueryHandler = handler
}

func (nh *NodeHost) handleStatusQuery(taskID types.TaskID) (types.TaskStatus, *types.TaskResult, bool) {
	if statusQueryHandler != nil {
		return statusQueryHandler(taskID)
	}
	return "", nil, false
}

func (nh *NodeHost) SetStatusHandler(handler func(peer.ID, *TaskStatusPayload)) {
	nh.statusHandler = handler
}

func (nh *NodeHost) Close() error {
	nh.cancel()
	return nh.Host.Close()
}

func (nh *NodeHost) StartHealthChecker() {
	go func() {
		ticker := time.NewTicker(nh.cfg.HeartbeatInterval)
		defer ticker.Stop()

		for {
			select {
			case <-nh.ctx.Done():
				return
			case <-ticker.C:
				nh.checkNodeHealth()
			}
		}
	}()
}

func (nh *NodeHost) checkNodeHealth() {
	nh.nodesMutex.Lock()
	defer nh.nodesMutex.Unlock()

	now := time.Now()
	for peerID, node := range nh.nodes {
		if now.Sub(node.LastHeartbeat) > nh.cfg.NodeTimeout {
			if node.Status != types.NodeStatusOffline {
				nh.logger.Info("node timed out", zap.String("peer", peerID.String()))
				node.Status = types.NodeStatusOffline
				
				nh.funcMutex.Lock()
				for fid, peers := range nh.functions {
					nh.functions[fid] = removePeer(peers, peerID)
				}
				nh.funcMutex.Unlock()

				if nh.onNodeLeave != nil {
					nh.onNodeLeave(peerID)
				}
			}
		}
	}
}

func removePeer(peers []peer.ID, p peer.ID) []peer.ID {
	result := make([]peer.ID, 0, len(peers))
	for _, existing := range peers {
		if existing != p {
			result = append(result, existing)
		}
	}
	return result
}