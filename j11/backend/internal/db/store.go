package db

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"sort"
	"sync"

	"github.com/linxGnu/grocksdb"
)

const (
	CF_Fingerprints = "fingerprints"
	CF_AudioMeta    = "audio_meta"
	CF_HashIndex    = "hash_index"
)

type AudioMeta struct {
	AudioID          string            `json:"audio_id"`
	FingerprintCount int               `json:"fingerprint_count"`
	Duration         float64           `json:"duration"`
	Metadata         map[string]string `json:"metadata,omitempty"`
}

type FingerprintEntry struct {
	AudioID string `json:"audio_id"`
	Offset  uint32 `json:"offset"`
}

type HashIndexEntry struct {
	AudioIDs []string `json:"audio_ids"`
}

type HashMatch struct {
	Hash       uint32
	AudioIDs   []string
	EntryCount int
}

type Store struct {
	db        *grocksdb.DB
	cfHandles map[string]*grocksdb.ColumnFamilyHandle
	mu        sync.RWMutex
	path      string
}

func NewStore(path string) (*Store, error) {
	opts := grocksdb.NewDefaultOptions()
	opts.SetCreateIfMissing(true)
	opts.SetCreateIfMissingColumnFamilies(true)

	cfNames := []string{"default", CF_Fingerprints, CF_AudioMeta, CF_HashIndex}
	cfOpts := make([]*grocksdb.Options, len(cfNames))
	for i := range cfOpts {
		cfOpts[i] = grocksdb.NewDefaultOptions()
		cfOpts[i].SetCreateIfMissing(true)
	}

	db, cfHandles, err := grocksdb.OpenDbColumnFamilies(opts, path, cfNames, cfOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	handles := make(map[string]*grocksdb.ColumnFamilyHandle)
	for i, name := range cfNames {
		handles[name] = cfHandles[i]
	}

	return &Store{
		db:        db,
		cfHandles: handles,
		path:      path,
	}, nil
}

func (s *Store) Close() {
	for _, h := range s.cfHandles {
		h.Destroy()
	}
	s.db.Close()
}

func (s *Store) StoreFingerprintBatch(audioID string, hashes []uint32, offsets []uint32) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	wb := grocksdb.NewWriteBatch()
	defer wb.Destroy()

	uniqueHashes := make(map[uint32]bool)

	for i, hash := range hashes {
		offset := uint32(0)
		if i < len(offsets) {
			offset = offsets[i]
		}

		key := makeFingerprintKey(hash, audioID, offset)
		entry := FingerprintEntry{
			AudioID: audioID,
			Offset:  offset,
		}
		val, _ := json.Marshal(entry)
		wb.PutCF(s.cfHandles[CF_Fingerprints], key, val)
		uniqueHashes[hash] = true
	}

	for hash := range uniqueHashes {
		hashKey := makeHashIndexKey(hash)
		existing, err := s.db.GetCF(grocksdb.NewDefaultReadOptions(), s.cfHandles[CF_HashIndex], hashKey)
		if err != nil {
			existing.Free()
			continue
		}

		var idxEntry HashIndexEntry
		if existing.Exists() {
			json.Unmarshal(existing.Data(), &idxEntry)
		}
		existing.Free()

		found := false
		for _, id := range idxEntry.AudioIDs {
			if id == audioID {
				found = true
				break
			}
		}
		if !found {
			idxEntry.AudioIDs = append(idxEntry.AudioIDs, audioID)
			sort.Strings(idxEntry.AudioIDs)
		}

		newVal, _ := json.Marshal(idxEntry)
		wb.PutCF(s.cfHandles[CF_HashIndex], hashKey, newVal)
	}

	wo := grocksdb.NewDefaultWriteOptions()
	defer wo.Destroy()

	return s.db.Write(wo, wb)
}

func (s *Store) FindByHash(hash uint32) ([]FingerprintEntry, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	prefix := make([]byte, 4)
	binary.BigEndian.PutUint32(prefix, hash)

	ro := grocksdb.NewDefaultReadOptions()
	defer ro.Destroy()

	iter := s.db.NewIteratorCF(ro, s.cfHandles[CF_Fingerprints])
	defer iter.Close()

	var results []FingerprintEntry

	iter.Seek(prefix)
	for ; iter.Valid(); iter.Next() {
		key := iter.Key()
		keyData := key.Data()

		if !startsWith(keyData, prefix) {
			break
		}

		val := iter.Value()
		var entry FingerprintEntry
		if err := json.Unmarshal(val.Data(), &entry); err == nil {
			results = append(results, entry)
		}

		key.Free()
		val.Free()
	}

	return results, nil
}

func (s *Store) FindAudioIDsByHash(hash uint32) ([]string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	hashKey := makeHashIndexKey(hash)

	ro := grocksdb.NewDefaultReadOptions()
	defer ro.Destroy()

	val, err := s.db.GetCF(ro, s.cfHandles[CF_HashIndex], hashKey)
	if err != nil {
		return nil, fmt.Errorf("failed to get hash index: %w", err)
	}
	defer val.Free()

	if !val.Exists() {
		return []string{}, nil
	}

	var idxEntry HashIndexEntry
	if err := json.Unmarshal(val.Data(), &idxEntry); err != nil {
		return []string{}, nil
	}

	return idxEntry.AudioIDs, nil
}

func (s *Store) FindAudioIDsByHashes(hashes []uint32) ([]HashMatch, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	results := make([]HashMatch, 0, len(hashes))
	seen := make(map[uint32]bool)

	ro := grocksdb.NewDefaultReadOptions()
	defer ro.Destroy()

	for _, hash := range hashes {
		if seen[hash] {
			continue
		}
		seen[hash] = true

		hashKey := makeHashIndexKey(hash)
		val, err := s.db.GetCF(ro, s.cfHandles[CF_HashIndex], hashKey)
		if err != nil {
			if val != nil {
				val.Free()
			}
			continue
		}

		if !val.Exists() {
			val.Free()
			continue
		}

		var idxEntry HashIndexEntry
		if err := json.Unmarshal(val.Data(), &idxEntry); err == nil {
			results = append(results, HashMatch{
				Hash:       hash,
				AudioIDs:   idxEntry.AudioIDs,
				EntryCount: len(idxEntry.AudioIDs),
			})
		}

		val.Free()
	}

	return results, nil
}

func (s *Store) FindIntersectionByHashes(hashesList [][]uint32, minMatchCount []int) (map[string][]int, error) {
	numQueries := len(hashesList)
	if numQueries == 0 {
		return nil, fmt.Errorf("no queries provided")
	}

	if len(minMatchCount) != numQueries {
		minMatchCount = make([]int, numQueries)
		for i := range minMatchCount {
			minMatchCount[i] = 1
		}
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	ro := grocksdb.NewDefaultReadOptions()
	defer ro.Destroy()

	audioMatchCount := make(map[string][]int)
	for i := 0; i < numQueries; i++ {
		seen := make(map[string]int)
		uniqueHashes := make(map[uint32]bool)

		for _, hash := range hashesList[i] {
			if uniqueHashes[hash] {
				continue
			}
			uniqueHashes[hash] = true

			hashKey := makeHashIndexKey(hash)
			val, err := s.db.GetCF(ro, s.cfHandles[CF_HashIndex], hashKey)
			if err != nil {
				if val != nil {
					val.Free()
				}
				continue
			}

			if !val.Exists() {
				val.Free()
				continue
			}

			var idxEntry HashIndexEntry
			if err := json.Unmarshal(val.Data(), &idxEntry); err == nil {
				for _, aid := range idxEntry.AudioIDs {
					seen[aid]++
				}
			}
			val.Free()
		}

		for aid, count := range seen {
			if count >= minMatchCount[i] {
				if _, ok := audioMatchCount[aid]; !ok {
					audioMatchCount[aid] = make([]int, numQueries)
				}
				audioMatchCount[aid][i] = count
			}
		}
	}

	result := make(map[string][]int)
	for aid, counts := range audioMatchCount {
		allMatched := true
		for i, c := range counts {
			if c < minMatchCount[i] {
				allMatched = false
				break
			}
		}
		if allMatched {
			result[aid] = counts
		}
	}

	return result, nil
}

func (s *Store) StoreAudioMeta(meta AudioMeta) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	val, err := json.Marshal(meta)
	if err != nil {
		return fmt.Errorf("failed to marshal audio meta: %w", err)
	}

	wo := grocksdb.NewDefaultWriteOptions()
	defer wo.Destroy()

	return s.db.PutCF(wo, s.cfHandles[CF_AudioMeta], []byte(meta.AudioID), val)
}

func (s *Store) GetAudioMeta(audioID string) (*AudioMeta, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ro := grocksdb.NewDefaultReadOptions()
	defer ro.Destroy()

	val, err := s.db.GetCF(ro, s.cfHandles[CF_AudioMeta], []byte(audioID))
	if err != nil {
		return nil, fmt.Errorf("failed to get audio meta: %w", err)
	}
	defer val.Free()

	if !val.Exists() {
		return nil, nil
	}

	var meta AudioMeta
	if err := json.Unmarshal(val.Data(), &meta); err != nil {
		return nil, fmt.Errorf("failed to unmarshal audio meta: %w", err)
	}

	return &meta, nil
}

func (s *Store) ListAudioMeta() ([]AudioMeta, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ro := grocksdb.NewDefaultReadOptions()
	defer ro.Destroy()

	iter := s.db.NewIteratorCF(ro, s.cfHandles[CF_AudioMeta])
	defer iter.Close()

	var results []AudioMeta
	iter.SeekToFirst()
	for ; iter.Valid(); iter.Next() {
		val := iter.Value()
		var meta AudioMeta
		if err := json.Unmarshal(val.Data(), &meta); err == nil {
			results = append(results, meta)
		}
		val.Free()
	}

	return results, nil
}

func (s *Store) DeleteAudio(audioID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	wb := grocksdb.NewWriteBatch()
	defer wb.Destroy()

	wb.DeleteCF(s.cfHandles[CF_AudioMeta], []byte(audioID))

	ro := grocksdb.NewDefaultReadOptions()
	defer ro.Destroy()

	affectedHashes := make(map[uint32]bool)

	iter := s.db.NewIteratorCF(ro, s.cfHandles[CF_Fingerprints])
	defer iter.Close()

	iter.SeekToFirst()
	for ; iter.Valid(); iter.Next() {
		val := iter.Value()
		valData := val.Data()
		var entry FingerprintEntry
		if err := json.Unmarshal(valData, &entry); err == nil && entry.AudioID == audioID {
			key := iter.Key()
			keyData := key.Data()
			keyCopy := make([]byte, len(keyData))
			copy(keyCopy, keyData)
			wb.DeleteCF(s.cfHandles[CF_Fingerprints], keyCopy)

			if len(keyData) >= 4 {
				hash := binary.BigEndian.Uint32(keyData[:4])
				affectedHashes[hash] = true
			}
			key.Free()
		}
		val.Free()
	}

	for hash := range affectedHashes {
		hashKey := makeHashIndexKey(hash)
		existing, err := s.db.GetCF(ro, s.cfHandles[CF_HashIndex], hashKey)
		if err != nil {
			if existing != nil {
				existing.Free()
			}
			continue
		}

		if existing.Exists() {
			var idxEntry HashIndexEntry
			if err := json.Unmarshal(existing.Data(), &idxEntry); err == nil {
				newIDs := make([]string, 0, len(idxEntry.AudioIDs))
				for _, id := range idxEntry.AudioIDs {
					if id != audioID {
						newIDs = append(newIDs, id)
					}
				}
				if len(newIDs) > 0 {
					idxEntry.AudioIDs = newIDs
					newVal, _ := json.Marshal(idxEntry)
					wb.PutCF(s.cfHandles[CF_HashIndex], hashKey, newVal)
				} else {
					wb.DeleteCF(s.cfHandles[CF_HashIndex], hashKey)
				}
			}
		}
		existing.Free()
	}

	wo := grocksdb.NewDefaultWriteOptions()
	defer wo.Destroy()

	return s.db.Write(wo, wb)
}

func (s *Store) CountFingerprints() (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ro := grocksdb.NewDefaultReadOptions()
	defer ro.Destroy()

	iter := s.db.NewIteratorCF(ro, s.cfHandles[CF_Fingerprints])
	defer iter.Close()

	count := 0
	iter.SeekToFirst()
	for ; iter.Valid(); iter.Next() {
		count++
	}

	return count, nil
}

func (s *Store) CountAudio() (int, error) {
	metas, err := s.ListAudioMeta()
	if err != nil {
		return 0, err
	}
	return len(metas), nil
}

func (s *Store) CountHashIndexEntries() (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ro := grocksdb.NewDefaultReadOptions()
	defer ro.Destroy()

	iter := s.db.NewIteratorCF(ro, s.cfHandles[CF_HashIndex])
	defer iter.Close()

	count := 0
	iter.SeekToFirst()
	for ; iter.Valid(); iter.Next() {
		count++
	}

	return count, nil
}

func makeFingerprintKey(hash uint32, audioID string, offset uint32) []byte {
	key := make([]byte, 4+len(audioID)+4)
	binary.BigEndian.PutUint32(key[:4], hash)
	copy(key[4:4+len(audioID)], []byte(audioID))
	binary.BigEndian.PutUint32(key[4+len(audioID):], offset)
	return key
}

func makeHashIndexKey(hash uint32) []byte {
	key := make([]byte, 4)
	binary.BigEndian.PutUint32(key, hash)
	return key
}

func startsWith(data, prefix []byte) bool {
	if len(data) < len(prefix) {
		return false
	}
	for i := range prefix {
		if data[i] != prefix[i] {
			return false
		}
	}
	return true
}
