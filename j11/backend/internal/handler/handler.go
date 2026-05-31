package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"audio-fingerprint-backend/internal/db"
	"audio-fingerprint-backend/internal/fingerprint"
)

type Handler struct {
	store *db.Store
}

func NewHandler(store *db.Store) *Handler {
	return &Handler{store: store}
}

type StoreRequest struct {
	AudioID      string                      `json:"audio_id"`
	Fingerprints []fingerprint.InputFingerprint `json:"fingerprints"`
	Duration     float64                    `json:"duration"`
	Metadata     map[string]string          `json:"metadata,omitempty"`
}

type StoreResponse struct {
	Success          bool   `json:"success"`
	AudioID          string `json:"audio_id"`
	FingerprintCount int    `json:"fingerprint_count"`
}

type MatchRequest struct {
	Fingerprints []fingerprint.InputFingerprint `json:"fingerprints"`
}

type MultiQuerySegment struct {
	SegmentID      string                           `json:"segment_id"`
	Fingerprints   []fingerprint.InputFingerprint  `json:"fingerprints"`
	MinMatchCount  int                              `json:"min_match_count,omitempty"`
	Weight         float64                          `json:"weight,omitempty"`
}

type MultiMatchRequest struct {
	Segments []MultiQuerySegment `json:"segments"`
	Mode     string             `json:"mode,omitempty"`
}

type MultiMatchResult struct {
	AudioID          string            `json:"audio_id"`
	Score            float64           `json:"score"`
	SegmentScores    []float64         `json:"segment_scores"`
	SegmentMatches   []int             `json:"segment_matches"`
	MatchedHashes    int               `json:"matched_hashes"`
	TotalHashes      int               `json:"total_hashes"`
	Metadata         map[string]string `json:"metadata,omitempty"`
}

type HealthResponse struct {
	Status           string `json:"status"`
	FingerprintCount int    `json:"fingerprint_count"`
	AudioCount       int    `json:"audio_count"`
	HashIndexCount   int    `json:"hash_index_count"`
}

func (h *Handler) CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	fpCount, _ := h.store.CountFingerprints()
	audioCount, _ := h.store.CountAudio()
	hashIndexCount, _ := h.store.CountHashIndexEntries()

	resp := HealthResponse{
		Status:           "ok",
		FingerprintCount: fpCount,
		AudioCount:       audioCount,
		HashIndexCount:   hashIndexCount,
	}

	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) MultiMatchFingerprints(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req MultiMatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Segments) == 0 {
		http.Error(w, "at least one segment is required", http.StatusBadRequest)
		return
	}

	if len(req.Segments) > 10 {
		http.Error(w, "maximum 10 segments allowed", http.StatusBadRequest)
		return
	}

	hashesList := make([][]uint32, len(req.Segments))
	minMatchCount := make([]int, len(req.Segments))
	weights := make([]float64, len(req.Segments))

	for i, seg := range req.Segments {
		if len(seg.Fingerprints) == 0 {
			http.Error(w, "segment fingerprints cannot be empty", http.StatusBadRequest)
			return
		}
		hashes := make([]uint32, len(seg.Fingerprints))
		for j, fp := range seg.Fingerprints {
			hashes[j] = fp.Hash
		}
		hashesList[i] = hashes
		if seg.MinMatchCount > 0 {
			minMatchCount[i] = seg.MinMatchCount
		} else {
			minMatchCount[i] = max(1, len(hashes)/50)
		}
		if seg.Weight > 0 {
			weights[i] = seg.Weight
		} else {
			weights[i] = 1.0
		}
	}

	intersection, err := h.store.FindIntersectionByHashes(hashesList, minMatchCount)
	if err != nil {
		http.Error(w, "Failed to compute intersection: "+err.Error(), http.StatusInternalServerError)
		return
	}

	type scoredResult struct {
		audioID       string
		score         float64
		segmentScores []float64
		segmentMatches []int
		matchedHashes int
		totalHashes   int
		metadata      map[string]string
	}

	var results []scoredResult

	for audioID, matches := range intersection {
		segmentScores := make([]float64, len(req.Segments))
		for i, matchCount := range matches {
			total := len(hashesList[i])
			if total > 0 {
				segmentScores[i] = float64(matchCount) / float64(total)
			} else {
				segmentScores[i] = 0
			}
		}

		weightedScore := 0.0
		totalWeight := 0.0
		matchedHashes := 0
		for i, s := range segmentScores {
			weightedScore += s * weights[i]
			totalWeight += weights[i]
			matchedHashes += matches[i]
		}
		if totalWeight > 0 {
			weightedScore /= totalWeight
		}

		meta, _ := h.store.GetAudioMeta(audioID)
		totalHashes := 0
		var metadata map[string]string
		if meta != nil {
			totalHashes = meta.FingerprintCount
			metadata = meta.Metadata
		}

		results = append(results, scoredResult{
			audioID:       audioID,
			score:         weightedScore,
			segmentScores: segmentScores,
			segmentMatches: matches,
			matchedHashes: matchedHashes,
			totalHashes:   totalHashes,
			metadata:      metadata,
		})
	}

	for i := range results {
		for j := i + 1; j < len(results); j++ {
			if results[j].score > results[i].score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}

	var response []MultiMatchResult
	for _, r := range results {
		response = append(response, MultiMatchResult{
			AudioID:        r.audioID,
			Score:          r.score,
			SegmentScores:  r.segmentScores,
			SegmentMatches: r.segmentMatches,
			MatchedHashes:  r.matchedHashes,
			TotalHashes:    r.totalHashes,
			Metadata:       r.metadata,
		})
	}

	writeJSON(w, http.StatusOK, response)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func (h *Handler) StoreFingerprints(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req StoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.AudioID == "" {
		http.Error(w, "audio_id is required", http.StatusBadRequest)
		return
	}

	if len(req.Fingerprints) == 0 {
		http.Error(w, "fingerprints is required and cannot be empty", http.StatusBadRequest)
		return
	}

	hashes := make([]uint32, len(req.Fingerprints))
	offsets := make([]uint32, len(req.Fingerprints))
	for i, fp := range req.Fingerprints {
		hashes[i] = fp.Hash
		offsets[i] = fp.Offset
	}

	if err := h.store.StoreFingerprintBatch(req.AudioID, hashes, offsets); err != nil {
		http.Error(w, "Failed to store fingerprints: "+err.Error(), http.StatusInternalServerError)
		return
	}

	meta := db.AudioMeta{
		AudioID:          req.AudioID,
		FingerprintCount: len(req.Fingerprints),
		Duration:         req.Duration,
		Metadata:         req.Metadata,
	}
	if err := h.store.StoreAudioMeta(meta); err != nil {
		http.Error(w, "Failed to store audio metadata: "+err.Error(), http.StatusInternalServerError)
		return
	}

	resp := StoreResponse{
		Success:          true,
		AudioID:          req.AudioID,
		FingerprintCount: len(req.Fingerprints),
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) MatchFingerprints(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req MatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Fingerprints) == 0 {
		http.Error(w, "fingerprints is required and cannot be empty", http.StatusBadRequest)
		return
	}

	lookupFn := func(hash uint32) ([]fingerprint.StoredFingerprint, error) {
		entries, err := h.store.FindByHash(hash)
		if err != nil {
			return nil, err
		}
		result := make([]fingerprint.StoredFingerprint, len(entries))
		for i, e := range entries {
			result[i] = fingerprint.StoredFingerprint{
				AudioID: e.AudioID,
				Offset:  e.Offset,
			}
		}
		return result, nil
	}

	totalHashesFn := func(audioID string) int {
		meta, err := h.store.GetAudioMeta(audioID)
		if err != nil || meta == nil {
			return 0
		}
		return meta.FingerprintCount
	}

	metadataFn := func(audioID string) map[string]string {
		meta, err := h.store.GetAudioMeta(audioID)
		if err != nil || meta == nil {
			return nil
		}
		return meta.Metadata
	}

	results, err := fingerprint.MatchFingerprints(
		req.Fingerprints,
		lookupFn,
		totalHashesFn,
		metadataFn,
	)
	if err != nil {
		http.Error(w, "Failed to match fingerprints: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, results)
}

func (h *Handler) ListAudio(w http.ResponseWriter, r *http.Request) {
	metas, err := h.store.ListAudioMeta()
	if err != nil {
		http.Error(w, "Failed to list audio: "+err.Error(), http.StatusInternalServerError)
		return
	}

	type AudioListItem struct {
		AudioID          string  `json:"audio_id"`
		FingerprintCount int     `json:"fingerprint_count"`
		Duration         float64 `json:"duration"`
	}

	list := make([]AudioListItem, len(metas))
	for i, m := range metas {
		list[i] = AudioListItem{
			AudioID:          m.AudioID,
			FingerprintCount: m.FingerprintCount,
			Duration:         m.Duration,
		}
	}

	writeJSON(w, http.StatusOK, list)
}

func (h *Handler) DeleteAudio(w http.ResponseWriter, r *http.Request) {
	if r.Method != "DELETE" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	audioID := strings.TrimPrefix(r.URL.Path, "/api/audio/")
	if audioID == "" {
		http.Error(w, "audio_id is required", http.StatusBadRequest)
		return
	}

	if err := h.store.DeleteAudio(audioID); err != nil {
		http.Error(w, "Failed to delete audio: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
