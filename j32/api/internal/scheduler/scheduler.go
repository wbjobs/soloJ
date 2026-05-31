package scheduler

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
	"math"
	"math/rand"
	"sort"
	"time"

	"github.com/dcdn/api/internal/dao"
)

type Candidate struct {
	Node   dao.Node
	Score  float64
	Region int
}

// ScoreBreakdown 评分分解，用于可解释性
type ScoreBreakdown struct {
	EloRaw        float64 `json:"elo_raw"`
	EloNormalized float64 `json:"elo_normalized"`
	RegionPenalty float64 `json:"region_penalty"`
	AvailContrib  float64 `json:"avail_contrib"`
	BWContrib     float64 `json:"bw_contrib"`
	UptimeContrib float64 `json:"uptime_contrib"`
	FinalScore    float64 `json:"final_score"`
}

// CandidateExplained 带解释信息的候选节点
type CandidateExplained struct {
	NodeID      string         `json:"node_id"`
	Address     string         `json:"address"`
	Region      string         `json:"region"`
	Score       float64        `json:"score"`
	Selected    bool           `json:"selected"`
	Breakdown   ScoreBreakdown `json:"score_breakdown"`
	Reasons     []string       `json:"reasons"`
}

// ScheduleResult 调度结果（含所有候选节点的解释）
type ScheduleResult struct {
	Strategy    string              `json:"strategy"`
	Weights     WeightAction        `json:"weights_used"`
	QLEpsilon   float64            `json:"ql_epsilon,omitempty"`
	AvgReward   float64            `json:"ql_avg_reward,omitempty"`
	Candidates  []CandidateExplained `json:"candidates"`
	TS          time.Time          `json:"ts"`
}

type Scheduler struct {
	store *dao.Store
	ql    *QLearning
}

func New(s *dao.Store) *Scheduler {
	ql := NewQLearning()
	sch := &Scheduler{store: s, ql: ql}
	sch.loadQTable(context.Background())
	return sch
}

func (sch *Scheduler) QL() *QLearning { return sch.ql }

func (sch *Scheduler) loadQTable(ctx context.Context) {
	data, err := sch.store.LoadQTableSnapshot(ctx)
	if err == nil && data != "" {
		_ = sch.ql.LoadSnapshot([]byte(data))
	}
}

func (sch *Scheduler) persistQTable(ctx context.Context) {
	data, err := sch.ql.Snapshot()
	if err == nil && len(data) > 0 {
		_ = sch.store.SaveQTableSnapshot(ctx, string(data))
	}
}

// Select 根据 file_hash + 健康度 + 网络拓扑距离 进行调度
// strategy: random_weight | deterministic | adaptive
func (sch *Scheduler) Select(ctx context.Context, fileHash, clientRegion string, topK int, strategy string) (*ScheduleResult, error) {
	nodes, err := sch.store.ListOnlineNodes(ctx, 10*time.Second)
	if err != nil {
		return nil, err
	}
	scores, err := sch.store.LatestScores(ctx)
	if err != nil {
		return nil, err
	}
	if len(nodes) == 0 {
		return nil, fmt.Errorf("no online nodes")
	}
	if topK <= 0 {
		topK = 3
	}
	if topK > len(nodes) {
		topK = len(nodes)
	}

	// 确定权重
	var w WeightAction
	var actionIdx int
	if strategy == "adaptive" {
		avgElo := avgEloOf(nodes, scores)
		avgBW := avgBWOf(nodes, scores)
		st := DiscretizeState(avgElo, hasRegionMatch(nodes, clientRegion), avgBW)
		actionIdx, w = sch.ql.ChooseAction(st)
	} else {
		w = Actions[0]
		actionIdx = 0
	}

	// 用选定权重计算候选评分
	candidates := make([]Candidate, 0, len(nodes))
	breakdowns := make([]ScoreBreakdown, 0, len(nodes))
	for _, n := range nodes {
		s, ok := scores[n.ID]
		elo := 1200.0
		var avail, bwContrib, uptime float64
		if ok && s != nil {
			elo = s.Elo
			avail = s.Avail
			bwContrib = s.BWContrib
			uptime = s.Uptime
		}
		regionPenalty := 2.0
		if n.Region == clientRegion {
			regionPenalty = 0.0
		} else if regionDistance(n.Region, clientRegion) < 2 {
			regionPenalty = 1.0
		}
		eloNorm := elo / 1000.0
		regionFactor := 1.0 - 0.2*regionPenalty
		availPart := w.AvailW * avail
		bwPart := w.BWW * bwContrib
		uptimePart := w.UptimeW * uptime
		weightedHealth := availPart + bwPart + uptimePart
		finalScore := eloNorm * regionFactor * (0.4 + 0.6*weightedHealth)

		candidates = append(candidates, Candidate{Node: n, Score: finalScore, Region: int(regionPenalty)})
		breakdowns = append(breakdowns, ScoreBreakdown{
			EloRaw:        elo,
			EloNormalized: eloNorm,
			RegionPenalty: regionPenalty,
			AvailContrib:  availPart,
			BWContrib:     bwPart,
			UptimeContrib: uptimePart,
			FinalScore:    finalScore,
		})
	}

	var picked []Candidate
	switch strategy {
	case "random_weight":
		picked = weightedRandomPick(candidates, topK, fileHash)
	case "adaptive":
		picked = adaptivePick(candidates, topK, fileHash)
	case "deterministic":
		fallthrough
	default:
		picked = deterministicPick(candidates, topK, fileHash)
	}

	// 构建选中集合
	selectedSet := make(map[string]bool, len(picked))
	for _, c := range picked {
		selectedSet[c.Node.ID] = true
	}

	// 构建解释
	explained := make([]CandidateExplained, 0, len(candidates))
	for i, c := range candidates {
		reasons := buildReasons(c, breakdowns[i], selectedSet[c.Node.ID], w, topK, len(candidates))
		explained = append(explained, CandidateExplained{
			NodeID:    c.Node.ID,
			Address:   c.Node.Address,
			Region:    c.Node.Region,
			Score:     c.Score,
			Selected:  selectedSet[c.Node.ID],
			Breakdown: breakdowns[i],
			Reasons:   reasons,
		})
	}

	// 排序：选中的在前
	sort.SliceStable(explained, func(i, j int) bool {
		if explained[i].Selected != explained[j].Selected {
			return explained[i].Selected
		}
		return explained[i].Score > explained[j].Score
	})

	// 持久化日志
	ids := make([]string, 0, len(picked))
	for _, c := range picked {
		ids = append(ids, c.Node.ID)
	}
	_ = sch.store.SaveScheduleLog(ctx, &dao.ScheduleLog{
		FileHash:     fileHash,
		ClientRegion: clientRegion,
		NodeIDs:      dao.JSON(ids),
		Strategy:     strategy,
		TS:           time.Now(),
	})

	result := &ScheduleResult{
		Strategy:   strategy,
		Weights:    w,
		Candidates: explained,
		TS:         time.Now(),
	}
	if strategy == "adaptive" {
		result.QLEpsilon = sch.ql.Epsilon()
		result.AvgReward = sch.ql.AvgReward()
		_ = actionIdx
	}
	return result, nil
}

// RecordFeedback 记录调度反馈并更新 Q-learning
func (sch *Scheduler) RecordFeedback(ctx context.Context, fileHash, nodeID string, downloadSpeed, responseTimeMs float64, success bool) error {
	avgSpeed, avgLat, err := sch.store.AvgFeedbackMetrics(ctx)
	if err != nil {
		avgSpeed = 1.0
		avgLat = 100.0
	}
	if avgSpeed <= 0 {
		avgSpeed = 1.0
	}
	if avgLat <= 0 {
		avgLat = 100.0
	}

	reward := ComputeReward(downloadSpeed, responseTimeMs, avgSpeed, avgLat)

	w := sch.ql.CurrentWeights()
	fb := &dao.ScheduleFeedback{
		FileHash:       fileHash,
		NodeID:         nodeID,
		DownloadSpeed:  downloadSpeed,
		ResponseTimeMs: responseTimeMs,
		Success:        success,
		WeightsJSON:    dao.JSON(w),
		TS:             time.Now(),
	}
	if err := sch.store.SaveScheduleFeedback(ctx, fb); err != nil {
		return err
	}

	if success {
		scores, _ := sch.store.LatestScores(ctx)
		sh, ok := scores[nodeID]
		elo := 1200.0
		bwUtil := 0.0
		if ok && sh != nil {
			elo = sh.Elo
			bwUtil = sh.BWContrib
		}
		nextState := DiscretizeState(elo, true, bwUtil)
		sch.ql.Update(reward, nextState)
		sch.ql.DecayEpsilon(0.995)
	}

	sch.persistQTable(ctx)
	return nil
}

// buildReasons 为每个节点生成可解释原因列表
func buildReasons(c Candidate, bd ScoreBreakdown, selected bool, w WeightAction, topK, total int) []string {
	var reasons []string

	if selected {
		reasons = append(reasons, fmt.Sprintf("selected: node ranked in top %d by score %.4f", topK, bd.FinalScore))
	} else {
		reasons = append(reasons, fmt.Sprintf("not_selected: node score %.4f below top %d threshold", bd.FinalScore, topK))
	}

	if bd.EloNormalized >= 1.2 {
		reasons = append(reasons, "high_elo: node health rating significantly above average")
	} else if bd.EloNormalized < 0.8 {
		reasons = append(reasons, "low_elo: node health rating below average, reducing selection probability")
	}

	if bd.RegionPenalty == 0 {
		reasons = append(reasons, "region_match: node in same region as client, no latency penalty")
	} else if bd.RegionPenalty == 1 {
		reasons = append(reasons, "region_adjacent: node in adjacent region, moderate latency penalty")
	} else {
		reasons = append(reasons, "region_remote: node in remote region, significant latency penalty applied")
	}

	if w.AvailW > 0.5 {
		reasons = append(reasons, fmt.Sprintf("weight_bias: availability weighted heavily (%.0f%%) by Q-learning policy", w.AvailW*100))
	}
	if w.BWW > 0.5 {
		reasons = append(reasons, fmt.Sprintf("weight_bias: bandwidth contribution weighted heavily (%.0f%%) by Q-learning policy", w.BWW*100))
	}
	if w.UptimeW > 0.5 {
		reasons = append(reasons, fmt.Sprintf("weight_bias: uptime stability weighted heavily (%.0f%%) by Q-learning policy", w.UptimeW*100))
	}

	if bd.AvailContrib > 0.3 {
		reasons = append(reasons, "strong_availability: low CPU/memory usage contributes positively")
	}
	if bd.BWContrib > 0.3 {
		reasons = append(reasons, "strong_bandwidth: high bandwidth utilization indicates active contribution")
	}
	if bd.UptimeContrib > 0.3 {
		reasons = append(reasons, "strong_uptime: long online history indicates reliability")
	}

	return reasons
}

// adaptivePick 使用 Q-learning 权重的加权采样
func adaptivePick(candidates []Candidate, k int, fileHash string) []Candidate {
	return weightedRandomPick(candidates, k, fileHash)
}

func avgEloOf(nodes []dao.Node, scores map[string]*dao.ScoreHistory) float64 {
	total := 0.0
	for _, n := range nodes {
		if s, ok := scores[n.ID]; ok && s != nil {
			total += s.Elo
		} else {
			total += 1200.0
		}
	}
	if len(nodes) == 0 {
		return 1200.0
	}
	return total / float64(len(nodes))
}

func avgBWOf(nodes []dao.Node, scores map[string]*dao.ScoreHistory) float64 {
	total := 0.0
	for _, n := range nodes {
		if s, ok := scores[n.ID]; ok && s != nil {
			total += s.BWContrib
		}
	}
	if len(nodes) == 0 {
		return 0
	}
	return total / float64(len(nodes))
}

func hasRegionMatch(nodes []dao.Node, clientRegion string) bool {
	for _, n := range nodes {
		if n.Region == clientRegion {
			return true
		}
	}
	return false
}

// 确定性选择：按 file_hash 哈希到排序后分片
func deterministicPick(candidates []Candidate, k int, fileHash string) []Candidate {
	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].Score != candidates[j].Score {
			return candidates[i].Score > candidates[j].Score
		}
		return candidates[i].Node.ID < candidates[j].Node.ID
	})
	h := hashUint64(fileHash)
	offset := int(h % uint64(max(len(candidates)-k+1, 1)))
	picked := candidates[offset : offset+k]
	return picked
}

// 随机权重：以 Score 为权重，无放回采样（对同一 hash 稳定）
// 修复：当所有节点 Score 相等或极小差异时，浮点累积可能导致越界/死循环，
// 增加：1) 所有权重相等时退化到均匀随机；2) 累积循环的越界保护；3) 剩余节点不足时提前终止
func weightedRandomPick(candidates []Candidate, k int, fileHash string) []Candidate {
	src := rand.NewSource(int64(hashUint64(fileHash)))
	rng := rand.New(src)

	remaining := make([]Candidate, len(candidates))
	copy(remaining, candidates)

	picked := make([]Candidate, 0, k)
	for i := 0; i < k && len(remaining) > 0; i++ {
		weights := make([]float64, len(remaining))
		total := 0.0
		allEqual := true
		for j, c := range remaining {
			w := math.Max(c.Score, 0.01)
			weights[j] = w
			total += w
			if j > 0 && math.Abs(weights[j]-weights[0]) > 1e-9 {
				allEqual = false
			}
		}
		if total <= 0 {
			break
		}

		var idx int
		if allEqual {
			idx = rng.Intn(len(remaining))
		} else {
			r := rng.Float64() * total
			acc := 0.0
			idx = len(remaining) - 1
			for j, w := range weights {
				acc += w
				if acc >= r-1e-12 {
					idx = j
					break
				}
			}
		}
		if idx < 0 || idx >= len(remaining) {
			idx = len(remaining) - 1
		}
		picked = append(picked, remaining[idx])
		remaining = append(remaining[:idx], remaining[idx+1:]...)
	}
	return picked
}

func hashUint64(s string) uint64 {
	h := sha256.Sum256([]byte(s))
	return binary.BigEndian.Uint64(h[:8])
}

func regionDistance(a, b string) int {
	if a == b {
		return 0
	}
	minLen := len(a)
	if len(b) < minLen {
		minLen = len(b)
	}
	prefix := 0
	for i := 0; i < minLen; i++ {
		if a[i] != b[i] {
			break
		}
		prefix++
	}
	if prefix >= 5 {
		return 1
	}
	return 3
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
