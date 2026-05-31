package scheduler

import (
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"
)

// WeightAction 表示健康度评分公式中的权重系数组合
// avail_w + bw_w + uptime_w 归一化后应等于 1.0
type WeightAction struct {
	AvailW  float64 `json:"avail_w"`
	BWW     float64 `json:"bw_w"`
	UptimeW float64 `json:"uptime_w"`
}

// 预定义动作空间：覆盖不同偏好方向的 5 组权重
var Actions = []WeightAction{
	{AvailW: 0.5, BWW: 0.3, UptimeW: 0.2}, // 默认均衡
	{AvailW: 0.7, BWW: 0.2, UptimeW: 0.1}, // 偏好可用性
	{AvailW: 0.2, BWW: 0.7, UptimeW: 0.1}, // 偏好带宽贡献
	{AvailW: 0.2, BWW: 0.1, UptimeW: 0.7}, // 偏好在线时长稳定性
	{AvailW: 0.33, BWW: 0.34, UptimeW: 0.33}, // 完全均匀
}

// State 表示 Q-learning 的状态空间
// 离散化：Elo 分桶 + 区域匹配 + 带宽利用率分桶
type State struct {
	EloBucket  int  `json:"elo_bucket"`  // 0: <800, 1: 800-1200, 2: 1200-1600, 3: >1600
	RegionMatch bool `json:"region_match"` // 客户端是否与节点同区域
	BWBucket   int  `json:"bw_bucket"`    // 0: <30%, 1: 30-70%, 2: >70%
}

func (s State) Key() string {
	rm := 0
	if s.RegionMatch {
		rm = 1
	}
	return fmt.Sprintf("%d:%d:%d", s.EloBucket, rm, s.BWBucket)
}

// QTable Q 值表：state_key -> action_index -> Q 值
type QTable map[string][]float64

// QLearning 基于强化学习的自适应权重调节模型
// 状态 = (Elo分桶, 区域匹配, 带宽分桶)
// 动作 = 权重系数组合
// 奖励 = 基于文件下载速度和节点响应时间
type QLearning struct {
	mu        sync.RWMutex
	table     QTable
	alpha     float64 // 学习率
	gamma     float64 // 折扣因子
	epsilon   float64 // 探索率
	rng       *rand.Rand
	lastState State
	lastAction int
	// 用于计算 reward 的最近 N 次反馈
	recentRewards []float64
	maxHistory   int
}

func NewQLearning() *QLearning {
	return &QLearning{
		table:     make(QTable),
		alpha:     0.1,
		gamma:     0.9,
		epsilon:   0.15,
		rng:       rand.New(rand.NewSource(time.Now().UnixNano())),
		recentRewards: make([]float64, 0, 100),
		maxHistory: 100,
	}
}

// DiscretizeState 将连续值映射到离散状态空间
func DiscretizeState(elo float64, regionMatch bool, bwUtil float64) State {
	eb := 0
	switch {
	case elo < 800:
		eb = 0
	case elo < 1200:
		eb = 1
	case elo < 1600:
		eb = 2
	default:
		eb = 3
	}
	bb := 0
	switch {
	case bwUtil < 0.3:
		bb = 0
	case bwUtil < 0.7:
		bb = 1
	default:
		bb = 2
	}
	return State{EloBucket: eb, RegionMatch: regionMatch, BWBucket: bb}
}

// ChooseAction ε-贪心策略选择动作
func (q *QLearning) ChooseAction(state State) (int, WeightAction) {
	q.mu.Lock()
	defer q.mu.Unlock()

	key := state.Key()
	if _, ok := q.table[key]; !ok {
		q.table[key] = make([]float64, len(Actions))
	}

	var actionIdx int
	if q.rng.Float64() < q.epsilon {
		actionIdx = q.rng.Intn(len(Actions))
	} else {
		actionIdx = bestAction(q.table[key])
	}

	q.lastState = state
	q.lastAction = actionIdx
	return actionIdx, Actions[actionIdx]
}

// Update 根据奖励信号更新 Q 值
func (q *QLearning) Update(reward float64, nextState State) {
	q.mu.Lock()
	defer q.mu.Unlock()

	sk := q.lastState.Key()
	if _, ok := q.table[sk]; !ok {
		q.table[sk] = make([]float64, len(Actions))
	}
	nk := nextState.Key()
	if _, ok := q.table[nk]; !ok {
		q.table[nk] = make([]float64, len(Actions))
	}

	maxNext := maxFloat(q.table[nk])
	oldQ := q.table[sk][q.lastAction]
	q.table[sk][q.lastAction] = oldQ + q.alpha*(reward+q.gamma*maxNext-oldQ)

	q.recentRewards = append(q.recentRewards, reward)
	if len(q.recentRewards) > q.maxHistory {
		q.recentRewards = q.recentRewards[q.maxHistory/2:]
	}
}

// ComputeReward 根据调度结果反馈计算奖励值
// 下载速度越高、响应时间越短 → 奖励越高
// reward ∈ [-1, 1]
func ComputeReward(downloadSpeedMbps, responseTimeMs, expectedSpeedMbps, expectedLatMs float64) float64 {
	speedRatio := downloadSpeedMbps / maxF(expectedSpeedMbps, 1.0)
	latRatio := expectedLatMs / maxF(responseTimeMs, 1.0)
	reward := 0.5*clampF(speedRatio-1.0, -1, 1) + 0.5*clampF(latRatio-1.0, -1, 1)
	return clampF(reward, -1, 1)
}

// CurrentWeights 获取当前策略推荐的权重
func (q *QLearning) CurrentWeights() WeightAction {
	q.mu.RLock()
	defer q.mu.RUnlock()
	sk := q.lastState.Key()
	if qs, ok := q.table[sk]; ok {
		idx := bestAction(qs)
		return Actions[idx]
	}
	return Actions[0]
}

// AvgReward 返回最近的平均奖励（用于可解释性）
func (q *QLearning) AvgReward() float64 {
	q.mu.RLock()
	defer q.mu.RUnlock()
	if len(q.recentRewards) == 0 {
		return 0
	}
	sum := 0.0
	for _, r := range q.recentRewards {
		sum += r
	}
	return sum / float64(len(q.recentRewards))
}

// Epsilon 返回当前探索率
func (q *QLearning) Epsilon() float64 {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return q.epsilon
}

// DecayEpsilon 衰减探索率
func (q *QLearning) DecayEpsilon(factor float64) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.epsilon = math.Max(q.epsilon*factor, 0.01)
}

// Snapshot 导出 Q 表（用于持久化）
func (q *QLearning) Snapshot() ([]byte, error) {
	q.mu.RLock()
	defer q.mu.RUnlock()
	return json.Marshal(q.table)
}

// LoadSnapshot 从持久化数据恢复 Q 表
func (q *QLearning) LoadSnapshot(data []byte) error {
	q.mu.Lock()
	defer q.mu.Unlock()
	return json.Unmarshal(data, &q.table)
}

func bestAction(qs []float64) int {
	best := 0
	for i := 1; i < len(qs); i++ {
		if qs[i] > qs[best] {
			best = i
		}
	}
	return best
}

func maxFloat(xs []float64) float64 {
	m := 0.0
	for i, x := range xs {
		if i == 0 || x > m {
			m = x
		}
	}
	return m
}

func maxF(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func clampF(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
