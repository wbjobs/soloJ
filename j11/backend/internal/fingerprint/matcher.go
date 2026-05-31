package fingerprint

import (
	"sort"
)

type InputFingerprint struct {
	Hash   uint32 `json:"hash"`
	Offset uint32 `json:"offset"`
}

type StoredFingerprint struct {
	AudioID string `json:"audio_id"`
	Offset  uint32 `json:"offset"`
}

type MatchScore struct {
	AudioID      string
	Score        float64
	MatchedCount int
	TotalCount   int
	Metadata     map[string]string
}

type MatchResult struct {
	AudioID       string            `json:"audio_id"`
	Score         float64           `json:"score"`
	MatchedHashes int              `json:"matched_hashes"`
	TotalHashes   int              `json:"total_hashes"`
	Metadata      map[string]string `json:"metadata,omitempty"`
}

type CandidateInfo struct {
	offsets      []int32
	inputOffsets []int32
}

func MatchFingerprints(
	inputFps []InputFingerprint,
	lookupFn func(hash uint32) ([]StoredFingerprint, error),
	totalHashesFn func(audioID string) int,
	metadataFn func(audioID string) map[string]string,
) ([]MatchResult, error) {

	candidates := make(map[string]*CandidateInfo)

	for _, inputFp := range inputFps {
		stored, err := lookupFn(inputFp.Hash)
		if err != nil {
			return nil, err
		}

		for _, sfp := range stored {
			info, ok := candidates[sfp.AudioID]
			if !ok {
				info = &CandidateInfo{}
				candidates[sfp.AudioID] = info
			}
			info.offsets = append(info.offsets, int32(sfp.Offset))
			info.inputOffsets = append(info.inputOffsets, int32(inputFp.Offset))
		}
	}

	type scored struct {
		audioID string
		score   float64
		matched int
	}

	var results []scored

	for audioID, info := range candidates {
		matched := countTimeAlignedMatches(info.offsets, info.inputOffsets)
		total := totalHashesFn(audioID)

		score := 0.0
		if total > 0 {
			score = float64(matched) / float64(total)
		}

		results = append(results, scored{
			audioID: audioID,
			score:   score,
			matched: matched,
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].score > results[j].score
	})

	var matchResults []MatchResult
	for _, r := range results {
		matchResults = append(matchResults, MatchResult{
			AudioID:       r.audioID,
			Score:         r.score,
			MatchedHashes: r.matched,
			TotalHashes:   totalHashesFn(r.audioID),
			Metadata:      metadataFn(r.audioID),
		})
	}

	return matchResults, nil
}

func countTimeAlignedMatches(storedOffsets, inputOffsets []int32) int {
	if len(storedOffsets) != len(inputOffsets) || len(storedOffsets) == 0 {
		return 0
	}

	type pair struct {
		stored int32
		input  int32
	}

	pairs := make([]pair, len(storedOffsets))
	for i := range storedOffsets {
		pairs[i] = pair{stored: storedOffsets[i], input: inputOffsets[i]}
	}

	type offsetCount struct {
		offset int32
		count  int
	}

	countMap := make(map[int32]int)
	for _, p := range pairs {
		delta := p.stored - p.input
		countMap[delta]++
	}

	maxCount := 0
	for _, count := range countMap {
		if count > maxCount {
			maxCount = count
		}
	}

	clusterThreshold := 2
	clusteredCount := 0
	for _, count := range countMap {
		if count >= clusterThreshold {
			clusteredCount += count
		}
	}

	if clusteredCount > 0 {
		return clusteredCount
	}
	return maxCount
}

func TimeCoherenceScore(offsets []int32) float64 {
	if len(offsets) < 2 {
		return 0
	}

	sort.Slice(offsets, func(i, j int) bool {
		return offsets[i] < offsets[j]
	})

	maxGap := int32(5)
	clusters := 0
	inCluster := false
	for i := 1; i < len(offsets); i++ {
		gap := offsets[i] - offsets[i-1]
		if gap <= maxGap {
			if !inCluster {
				clusters++
				inCluster = true
			}
		} else {
			inCluster = false
		}
	}

	if len(offsets) == 0 {
		return 0
	}
	return float64(clusters) / float64(len(offsets))
}
