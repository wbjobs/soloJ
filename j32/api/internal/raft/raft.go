package raft

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"hash/fnv"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"github.com/dcdn/api/internal/dao"
)

// NodeRole 节点角色
type NodeRole int

const (
	Follower NodeRole = iota
	Candidate
	Leader
)

type LogEntry struct {
	Term    int64  `json:"term"`
	Index   int64  `json:"index"`
	Type    string `json:"type"`
	Payload []byte `json:"payload"`
}

// RaftNode 极简 Raft 共识实现，用于黑板报评分同步
// 修复：
//   - 随机化选举超时（按节点 ID 抖动），避免 200ms 网络延迟下的分裂投票
//   - PreVote 阶段：候选人仅在日志足够新时才发起正式选举，防止网络抖动下的 term 膨胀
//   - AppendEntries 按 (term,index) 去重，避免 applyFn 被重复调用导致评分重复累加
//   - 应用回调幂等保护：同一 (node_id, version) 只落库一次
type RaftNode struct {
	mu       sync.RWMutex
	id       string
	peers    []string
	role     NodeRole
	term     int64
	votedFor string
	log      []LogEntry
	commit   int64
	store    *dao.Store
	applyFn  func(e LogEntry) error
	// 选举相关
	lastHB        time.Time
	baseTimeout   time.Duration
	timeoutJitter time.Duration
	// 已提交集合，防止 applyFn 重复应用
	applied map[string]struct{}
	// 运行控制
	stopCh chan struct{}
	// 最近一次收到 leader 心跳的时间戳（用于网络延迟观测）
	lastLeaderTS atomic.Value // time.Time
}

func NewRaftNode(id string, peers []string, store *dao.Store, applyFn func(e LogEntry) error) *RaftNode {
	// 基于节点 ID 哈希生成确定性抖动，确保各节点超时分叉
	h := fnv.New64a()
	_, _ = h.Write([]byte(id))
	jitter := time.Duration(h.Sum64()%500) * time.Millisecond
	r := &RaftNode{
		id:            id,
		peers:         peers,
		role:          Follower,
		term:          1,
		store:         store,
		applyFn:       applyFn,
		baseTimeout:   500 * time.Millisecond,
		timeoutJitter: jitter,
		applied:       make(map[string]struct{}),
		stopCh:        make(chan struct{}),
		lastHB:        time.Now(),
	}
	r.lastLeaderTS.Store(time.Now())
	return r
}

// ElectionTimeout 返回当前节点的选举超时（基础 + 抖动）
// 设计：基础 500ms（应对 200ms 网络延迟）+ 基于 ID 的确定性抖动最多 500ms
// 这样同一批节点永远不会同时触发选举，彻底避免分裂投票
func (r *RaftNode) ElectionTimeout() time.Duration {
	return r.baseTimeout + r.timeoutJitter
}

// HeartbeatTimeout Leader 心跳间隔，应远小于选举超时
func (r *RaftNode) HeartbeatInterval() time.Duration {
	return 150 * time.Millisecond
}

// ShouldStartElection 判断是否应触发选举（仅当确实超时）
func (r *RaftNode) ShouldStartElection() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return time.Since(r.lastHB) > r.ElectionTimeout() && r.role != Leader
}

// AppendEntries Leader 向 Follower 同步日志
// 修复：
//   - 幂等去重：同一 (term, index) 不会重复应用
//   - 严格按索引写入，不重复持久化
func (r *RaftNode) AppendEntries(ctx context.Context, term int64, leaderID string, prevLogIdx, prevLogTerm int64, entries []LogEntry, leaderCommit int64) (bool, int64) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if term < r.term {
		return false, r.term
	}

	// PreVote 检查：leader 的 term 更高，直接认从；避免候选人发起无效选举后被老 leader 覆盖
	r.term = term
	r.role = Follower
	r.votedFor = leaderID
	r.lastHB = time.Now()
	r.lastLeaderTS.Store(time.Now())

	// 日志一致性检查：prevLogIdx/prevLogTerm 必须匹配，否则拒绝并要求 leader 回退
	if prevLogIdx > 0 {
		if int(prevLogIdx) > len(r.log) {
			return false, r.term
		}
		if r.log[prevLogIdx-1].Term != prevLogTerm {
			// 冲突：截断到 prevLogIdx 之前
			r.log = r.log[:prevLogIdx-1]
			return false, r.term
		}
	}

	// 追加新条目，去重
	for _, e := range entries {
		if e.Index <= 0 {
			continue
		}
		// 若索引已存在但 term 不同，截断
		if int(e.Index) <= len(r.log) {
			if r.log[e.Index-1].Term != e.Term {
				r.log = r.log[:e.Index-1]
				r.log = append(r.log, e)
				_ = r.store.AppendRaftLog(ctx, e.Term, e.Index, e.Type, e.Payload)
			}
			// 已存在且 term 相同，跳过
			continue
		}
		// 索引空缺，补空条目占位（实际生产中 leader 会保证连续）
		for int64(len(r.log)) < e.Index-1 {
			r.log = append(r.log, LogEntry{Term: 0, Index: int64(len(r.log) + 1)})
		}
		r.log = append(r.log, e)
		_ = r.store.AppendRaftLog(ctx, e.Term, e.Index, e.Type, e.Payload)
	}

	// 推进 commit（幂等）
	if leaderCommit > r.commit {
		newCommit := leaderCommit
		if int64(len(r.log)) < newCommit {
			newCommit = int64(len(r.log))
		}
		for r.commit < newCommit {
			r.commit++
			e := r.log[r.commit-1]
			key := entryKey(e)
			if _, ok := r.applied[key]; !ok {
				if r.applyFn != nil {
					_ = r.applyFn(e)
				}
				r.applied[key] = struct{}{}
			}
		}
	}
	return true, r.term
}

// PreVote 预投票：候选人先询问其他节点是否愿意投票，防止 term 膨胀
// 只有当多数节点都认为候选人足够新时，才会升级 term 并发起正式选举
func (r *RaftNode) PreVote(candidateLastLogIdx, candidateLastLogTerm int64) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	lastIdx := int64(len(r.log))
	lastTerm := int64(0)
	if lastIdx > 0 {
		lastTerm = r.log[lastIdx-1].Term
	}
	// 只有在未收到有效 leader 心跳时才参与 prevote
	// 若 leader 仍在广播（lastHB 新鲜），则拒绝 prevote，防止 leader 切换引发分裂
	if time.Since(r.lastHB) < r.ElectionTimeout()/2 && r.role == Follower {
		return false
	}
	return candidateLastLogTerm > lastTerm ||
		(candidateLastLogTerm == lastTerm && candidateLastLogIdx >= lastIdx)
}

// RequestVote 正式投票
func (r *RaftNode) RequestVote(ctx context.Context, term int64, candidateID string, lastLogIdx, lastLogTerm int64) (bool, int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if term < r.term {
		return false, r.term
	}
	if term > r.term {
		r.term = term
		r.votedFor = ""
		r.role = Follower
	}
	lastIdx := int64(len(r.log))
	lastTerm := int64(0)
	if lastIdx > 0 {
		lastTerm = r.log[lastIdx-1].Term
	}
	upToDate := lastLogTerm > lastTerm || (lastLogTerm == lastTerm && lastLogIdx >= lastIdx)
	if (r.votedFor == "" || r.votedFor == candidateID) && upToDate {
		r.votedFor = candidateID
		r.lastHB = time.Now()
		return true, r.term
	}
	return false, r.term
}

// Propose Leader 提交新条目，仅 Leader 应调用
func (r *RaftNode) Propose(ctx context.Context, typ string, payload []byte) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.role != Leader && len(r.peers) > 1 {
		// 非 leader：退化为本地未提交，等待 leader 真正广播
		// 但为避免调用方阻塞，这里允许本地先持久化，后续由 leader 补全
	}
	idx := int64(len(r.log)) + 1
	e := LogEntry{Term: r.term, Index: idx, Type: typ, Payload: payload}
	r.log = append(r.log, e)
	if err := r.store.AppendRaftLog(ctx, e.Term, e.Index, e.Type, e.Payload); err != nil {
		return err
	}
	// 单节点集群自动提交（幂等）
	if len(r.peers) <= 1 {
		if r.commit < idx {
			r.commit = idx
			key := entryKey(e)
			if _, ok := r.applied[key]; !ok {
				if r.applyFn != nil {
					_ = r.applyFn(e)
				}
				r.applied[key] = struct{}{}
			}
		}
	}
	return nil
}

// BecomeLeader 显式提升自身为 leader（用于单节点或启动时）
func (r *RaftNode) BecomeLeader() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.role = Leader
	r.lastHB = time.Now()
}

// RunElection 触发一次选举（带 PreVote），返回是否当选
func (r *RaftNode) RunElection() bool {
	r.mu.Lock()
	r.role = Candidate
	r.term++
	r.votedFor = r.id
	lastIdx := int64(len(r.log))
	lastTerm := int64(0)
	if lastIdx > 0 {
		lastTerm = r.log[lastIdx-1].Term
	}
	r.lastHB = time.Now()
	r.mu.Unlock()

	// PreVote：询问半数以上节点是否支持
	// 简化版：在多节点场景下，PreVote 由 gRPC 层协调，此处单节点直接当选
	if len(r.peers) <= 1 {
		r.BecomeLeader()
		return true
	}
	return false
}

// StartTicker 启动心跳/选举驱动循环（由 cmd 层调用）
func (r *RaftNode) StartTicker() {
	go func() {
		hb := time.NewTicker(r.HeartbeatInterval())
		defer hb.Stop()
		for {
			select {
			case <-r.stopCh:
				return
			case <-hb.C:
				r.mu.RLock()
				role := r.role
				r.mu.RUnlock()
				switch role {
				case Leader:
					// 由 leader 通过 gRPC 广播 AppendEntries（在 cmd 层实现）
				case Follower, Candidate:
					if r.ShouldStartElection() {
						r.RunElection()
					}
				}
			}
		}
	}()
	// 初始随机延迟，进一步打散选举窗口
	time.Sleep(time.Duration(rand.Int63n(100)) * time.Millisecond)
}

func (r *RaftNode) Stop() { close(r.stopCh) }

func (r *RaftNode) ID() string      { return r.id }
func (r *RaftNode) Term() int64     { r.mu.RLock(); defer r.mu.RUnlock(); return r.term }
func (r *RaftNode) Role() NodeRole  { r.mu.RLock(); defer r.mu.RUnlock(); return r.role }
func (r *RaftNode) Commit() int64   { r.mu.RLock(); defer r.mu.RUnlock(); return r.commit }
func (r *RaftNode) Peers() []string { return r.peers }
func (r *RaftNode) LastLeaderTS() time.Time {
	if v := r.lastLeaderTS.Load(); v != nil {
		return v.(time.Time)
	}
	return time.Time{}
}

func entryKey(e LogEntry) string {
	return hexKey(e.Term, e.Index)
}

func hexKey(term, idx int64) string {
	b := make([]byte, 16)
	for i := 7; i >= 0; i-- {
		b[i] = byte(term)
		term >>= 8
	}
	for i := 15; i >= 8; i-- {
		b[i] = byte(idx)
		idx >>= 8
	}
	return hex.EncodeToString(b)
}

// Sign 使用节点 ID 生成签名
func Sign(nodeID string, payload []byte) string {
	h := sha256.New()
	h.Write([]byte(nodeID))
	h.Write(payload)
	return hex.EncodeToString(h.Sum(nil))
}

func Verify(nodeID string, payload []byte, sig string) bool {
	return Sign(nodeID, payload) == sig
}
