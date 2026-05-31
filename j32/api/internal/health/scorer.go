package health

import (
	"context"
	"time"

	"github.com/dcdn/api/internal/dao"
)

// EloVariantScorer —— 基于 Elo 评分算法变体的健康度评分器
// 原理：
//  - 基础分 BaseRating = 1200
//  - 每轮心跳视为一次"对局"：根据实际可用性、带宽贡献、在线时长计算节点表现值
//  - 与"预期值"（基于历史 Elo 推算的理想表现）比较，计算偏差
//  - Elo 更新：Δ = K * (actual - expected)
//  - K 因子：与节点带宽贡献和在线时长相关，老节点更稳定
type EloVariantScorer struct {
	store *dao.Store
	K     float64
	Base  float64
}

func NewEloVariantScorer(s *dao.Store) *EloVariantScorer {
	return &EloVariantScorer{store: s, K: 32, Base: 1200}
}

// Compute 更新单节点的 Elo 健康度分数
func (e *EloVariantScorer) Compute(ctx context.Context, nodeID string, hb dao.Heartbeat, node dao.Node) (*dao.ScoreHistory, error) {
	now := time.Now()

	// 1. 计算"实际表现" (0..1)
	//    可用性：cpu/mem 越低越好，bw 贡献越高越好
	utilization := (hb.CPU + hb.Mem) / 2.0 // 0..1
	avail := clamp(1.0 - utilization, 0, 1)
	bwContrib := clamp(hb.BWUsage/max(node.BandwidthCap, 1.0), 0, 1)
	uptime := clamp(now.Sub(node.RegisteredAt).Hours()/24.0/30.0, 0, 1) // 月归一化

	actual := 0.5*avail + 0.3*bwContrib + 0.2*uptime

	// 2. 读取历史最新 Elo，得到"预期表现"
	prev, err := e.store.LatestScore(ctx, nodeID)
	if err != nil || prev == nil {
		prev = &dao.ScoreHistory{NodeID: nodeID, Elo: e.Base, Avail: avail, BWContrib: bwContrib, Uptime: uptime, Version: 0}
	}
	// 将 Elo 映射到 [0,1] 区间
	expected := clamp((prev.Elo-1000)/400.0, 0, 1)

	// 3. Elo 更新
	K := e.K * (0.5 + 0.5*bwContrib)
	newElo := prev.Elo + K*(actual-expected)
	newElo = clamp(newElo, 0, 2400)

	sh := &dao.ScoreHistory{
		NodeID:     nodeID,
		Elo:        newElo,
		Avail:      avail,
		BWContrib:  bwContrib,
		Uptime:     uptime,
		Version:    prev.Version + 1,
		ComputedAt: now,
	}
	if err := e.store.SaveScore(ctx, sh); err != nil {
		return nil, err
	}
	return sh, nil
}

// TransferHeritage 将退出节点的 Elo 按权重转移给存活节点
// 权重：按各存活节点的当前 Elo 占比，避免低质量节点接管高质量遗产
func (e *EloVariantScorer) TransferHeritage(ctx context.Context, fromNode string, totalElo float64, survivors []string) error {
	scores, err := e.store.LatestScores(ctx)
	if err != nil {
		return err
	}
	var total float64
	weights := map[string]float64{}
	for _, id := range survivors {
		s, ok := scores[id]
		if !ok || s == nil {
			continue
		}
		weights[id] = s.Elo
		total += s.Elo
	}
	if total <= 0 {
		return nil
	}
	now := time.Now()
	toIDs := []string{}
	wg := []float64{}
	for id, w := range weights {
		share := totalElo * (w / total)
		toIDs = append(toIDs, id)
		wg = append(wg, share)
		prev := scores[id]
		newElo := prev.Elo + share*0.2 // 继承 20% 遗产权重，防止膨胀
		sh := &dao.ScoreHistory{
			NodeID:     id,
			Elo:        newElo,
			Avail:      prev.Avail,
			BWContrib:  prev.BWContrib,
			Uptime:     prev.Uptime,
			Version:    prev.Version + 1,
			ComputedAt: now,
		}
		if err := e.store.SaveScore(ctx, sh); err != nil {
			return err
		}
	}
	return e.store.SaveHeritageLog(ctx, &dao.HeritageLog{
		FromNode: fromNode,
		ToNodes:  dao.JSON(toIDs),
		TotalElo: totalElo,
		Weights:  dao.JSON(wg),
		TS:       now,
	})
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}
