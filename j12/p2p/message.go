package p2p

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"time"

	"github.com/fcnet/func-compute/types"
	"github.com/libp2p/go-libp2p/core/network"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/protocol"
	"go.uber.org/zap"
)

type MessageType string

const (
	MsgTypeTaskSubmit    MessageType = "task_submit"
	MsgTypeTaskResult    MessageType = "task_result"
	MsgTypeTaskRequest   MessageType = "task_request"
	MsgTypeTaskStatus    MessageType = "task_status"
	MsgTypeStatusQuery   MessageType = "status_query"
	MsgTypeStatusResponse MessageType = "status_response"
	MsgTypeFuncRegister  MessageType = "func_register"
	MsgTypeFuncQuery     MessageType = "func_query"
	MsgTypeFuncResponse  MessageType = "func_response"
)

type Message struct {
	Type    MessageType     `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type TaskSubmitPayload struct {
	Task *types.Task `json:"task"`
}

type TaskResultPayload struct {
	Result *types.TaskResult `json:"result"`
}

type FuncRegisterPayload struct {
	Function *types.FunctionSpec `json:"function"`
	NodeID   peer.ID             `json:"node_id"`
}

type FuncQueryPayload struct {
	FunctionID types.FunctionID `json:"function_id"`
}

type FuncResponsePayload struct {
	Function  *types.FunctionSpec `json:"function,omitempty"`
	Providers []peer.ID           `json:"providers"`
	Exists    bool                `json:"exists"`
}

type TaskStatusPayload struct {
	TaskID     types.TaskID     `json:"task_id"`
	Status     types.TaskStatus `json:"status"`
	Result     *types.TaskResult `json:"result,omitempty"`
	UpdatedAt  time.Time        `json:"updated_at"`
}

type StatusQueryPayload struct {
	TaskID types.TaskID `json:"task_id"`
}

type StatusResponsePayload struct {
	TaskID     types.TaskID      `json:"task_id"`
	Status     types.TaskStatus  `json:"status"`
	Result     *types.TaskResult `json:"result,omitempty"`
	Found      bool              `json:"found"`
}

func (nh *NodeHost) SendTask(ctx context.Context, peerID peer.ID, task *types.Task) error {
	payload := TaskSubmitPayload{Task: task}
	return nh.sendMessage(ctx, peerID, ProtocolTask, MsgTypeTaskSubmit, payload)
}

func (nh *NodeHost) SendResult(ctx context.Context, peerID peer.ID, result *types.TaskResult) error {
	payload := TaskResultPayload{Result: result}
	return nh.sendMessage(ctx, peerID, ProtocolResult, MsgTypeTaskResult, payload)
}

func (nh *NodeHost) sendMessage(ctx context.Context, peerID peer.ID, proto protocol.ID, msgType MessageType, payload interface{}) error {
	s, err := nh.NewStream(ctx, peerID, proto)
	if err != nil {
		return fmt.Errorf("create stream: %w", err)
	}
	defer s.Close()

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	msg := Message{
		Type:    msgType,
		Payload: payloadBytes,
	}

	encoder := json.NewEncoder(s)
	if err := encoder.Encode(msg); err != nil {
		return fmt.Errorf("encode message: %w", err)
	}

	return nil
}

func (nh *NodeHost) SetResultHandler(handler func(peer.ID, *types.TaskResult)) {
	nh.SetStreamHandler(ProtocolResult, func(s network.Stream) {
		defer s.Close()

		var msg Message
		decoder := json.NewDecoder(s)
		if err := decoder.Decode(&msg); err != nil {
			if err != io.EOF {
				nh.logger.Warn("failed to decode result message", zap.Error(err))
			}
			return
		}

		if msg.Type != MsgTypeTaskResult {
			nh.logger.Warn("unexpected message type", zap.String("type", string(msg.Type)))
			return
		}

		var payload TaskResultPayload
		if err := json.Unmarshal(msg.Payload, &payload); err != nil {
			nh.logger.Warn("failed to unmarshal result payload", zap.Error(err))
			return
		}

		peerID := s.Conn().RemotePeer()
		handler(peerID, payload.Result)
	})
}

func (nh *NodeHost) BroadcastTask(task *types.Task, providers []peer.ID) error {
	var lastErr error
	for _, p := range providers {
		go func(peerID peer.ID) {
			ctx, cancel := context.WithTimeout(nh.ctx, 10*time.Second)
			defer cancel()
			if err := nh.SendTask(ctx, peerID, task); err != nil {
				nh.logger.Debug("failed to send task", zap.String("peer", peerID.String()), zap.Error(err))
				lastErr = err
			}
		}(p)
	}
	return lastErr
}

func (nh *NodeHost) BroadcastTaskStatus(taskID types.TaskID, status types.TaskStatus, result *types.TaskResult) {
	nodes := nh.GetAllNodes()
	for peerID := range nodes {
		go func(p peer.ID) {
			ctx, cancel := context.WithTimeout(nh.ctx, 5*time.Second)
			defer cancel()

			payload := TaskStatusPayload{
				TaskID:    taskID,
				Status:    status,
				Result:    result,
				UpdatedAt: time.Now(),
			}

			if err := nh.sendMessage(ctx, p, ProtocolTask, MsgTypeTaskStatus, payload); err != nil {
				nh.logger.Debug("failed to broadcast status", zap.String("peer", p.String()), zap.Error(err))
			}
		}(peerID)
	}
}

func (nh *NodeHost) QueryTaskStatus(ctx context.Context, peerID peer.ID, taskID types.TaskID) (*StatusResponsePayload, error) {
	s, err := nh.NewStream(ctx, peerID, ProtocolTask)
	if err != nil {
		return nil, fmt.Errorf("create stream: %w", err)
	}
	defer s.Close()

	query := StatusQueryPayload{TaskID: taskID}
	if err := nh.sendMessage(ctx, peerID, ProtocolTask, MsgTypeStatusQuery, query); err != nil {
		return nil, fmt.Errorf("send query: %w", err)
	}

	var msg Message
	decoder := json.NewDecoder(s)
	if err := decoder.Decode(&msg); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	if msg.Type != MsgTypeStatusResponse {
		return nil, fmt.Errorf("unexpected response type: %s", msg.Type)
	}

	var response StatusResponsePayload
	if err := json.Unmarshal(msg.Payload, &response); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	return &response, nil
}

func mustMarshal(v interface{}) json.RawMessage {
	data, _ := json.Marshal(v)
	return data
}
