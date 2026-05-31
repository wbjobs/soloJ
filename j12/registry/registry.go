package registry

import (
	"bytes"
	"context"
	"encoding/json"
	"sync"
	"time"

	shell "github.com/ipfs/go-ipfs-api"
	"github.com/libp2p/go-libp2p/core/peer"
	"go.uber.org/zap"

	"github.com/fcnet/func-compute/config"
	"github.com/fcnet/func-compute/types"
)

type FunctionRegistry struct {
	cfg     *config.IPFSConfig
	logger  *zap.Logger
	ipfs    *shell.Shell
	ctx     context.Context
	cancel  context.CancelFunc

	localFunctions map[types.FunctionID]*types.FunctionSpec
	localMtx       sync.RWMutex

	functionProviders map[types.FunctionID][]peer.ID
	providersMtx      sync.RWMutex
}

func NewFunctionRegistry(cfg *config.IPFSConfig, logger *zap.Logger) (*FunctionRegistry, error) {
	sh := shell.NewShell(cfg.APIAddress)

	ctx, cancel := context.WithCancel(context.Background())

	r := &FunctionRegistry{
		cfg:               cfg,
		logger:            logger,
		ipfs:              sh,
		ctx:               ctx,
		cancel:            cancel,
		localFunctions:    make(map[types.FunctionID]*types.FunctionSpec),
		functionProviders: make(map[types.FunctionID][]peer.ID),
	}

	if err := r.checkIPFSConnection(); err != nil {
		logger.Warn("failed to connect to IPFS, running in local mode", zap.Error(err))
	}

	return r, nil
}

func (r *FunctionRegistry) checkIPFSConnection() error {
	_, err := r.ipfs.ID()
	return err
}

func (r *FunctionRegistry) RegisterFunction(spec *types.FunctionSpec, nodeID peer.ID) error {
	r.localMtx.Lock()
	r.localFunctions[spec.ID] = spec
	r.localMtx.Unlock()

	r.providersMtx.Lock()
	if !containsPeer(r.functionProviders[spec.ID], nodeID) {
		r.functionProviders[spec.ID] = append(r.functionProviders[spec.ID], nodeID)
	}
	r.providersMtx.Unlock()

	go r.publishToIPFS(spec)

	return nil
}

func (r *FunctionRegistry) publishToIPFS(spec *types.FunctionSpec) {
	data, err := json.Marshal(spec)
	if err != nil {
		r.logger.Warn("failed to marshal function spec", zap.Error(err))
		return
	}

	cid, err := r.ipfs.Add(bytes.NewReader(data))
	if err != nil {
		r.logger.Warn("failed to add to IPFS", zap.Error(err))
		return
	}

	r.logger.Info("function published to IPFS",
		zap.String("function", string(spec.ID)),
		zap.String("cid", cid))
}

func (r *FunctionRegistry) GetFunction(id types.FunctionID) (*types.FunctionSpec, bool) {
	r.localMtx.RLock()
	spec, ok := r.localFunctions[id]
	r.localMtx.RUnlock()
	if ok {
		return spec, true
	}

	return r.getFromIPFS(id)
}

func (r *FunctionRegistry) getFromIPFS(id types.FunctionID) (*types.FunctionSpec, bool) {
	return nil, false
}

func (r *FunctionRegistry) GetFunctionProviders(id types.FunctionID) []peer.ID {
	r.providersMtx.RLock()
	defer r.providersMtx.RUnlock()

	peers := r.functionProviders[id]
	result := make([]peer.ID, len(peers))
	copy(result, peers)
	return result
}

func (r *FunctionRegistry) AddProvider(id types.FunctionID, nodeID peer.ID) {
	r.providersMtx.Lock()
	defer r.providersMtx.Unlock()

	if !containsPeer(r.functionProviders[id], nodeID) {
		r.functionProviders[id] = append(r.functionProviders[id], nodeID)
	}
}

func (r *FunctionRegistry) RemoveProvider(nodeID peer.ID) {
	r.providersMtx.Lock()
	defer r.providersMtx.Unlock()

	for id, peers := range r.functionProviders {
		r.functionProviders[id] = removePeer(peers, nodeID)
	}
}

func (r *FunctionRegistry) GetAllFunctions() []types.FunctionSpec {
	r.localMtx.RLock()
	defer r.localMtx.RUnlock()

	result := make([]types.FunctionSpec, 0, len(r.localFunctions))
	for _, spec := range r.localFunctions {
		result = append(result, *spec)
	}
	return result
}

func (r *FunctionRegistry) Close() {
	r.cancel()
}

func containsPeer(peers []peer.ID, p peer.ID) bool {
	for _, existing := range peers {
		if existing == p {
			return true
		}
	}
	return false
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

type DHTResultCache struct {
	logger *zap.Logger
	ctx    context.Context
	cancel context.CancelFunc

	cache     map[string]*cacheEntry
	cacheMtx  sync.RWMutex
	defaultTTL time.Duration
}

type cacheEntry struct {
	Result    *types.TaskResult
	ExpiresAt time.Time
}

func NewDHTResultCache(logger *zap.Logger, ttl time.Duration) *DHTResultCache {
	ctx, cancel := context.WithCancel(context.Background())

	c := &DHTResultCache{
		logger:     logger,
		ctx:        ctx,
		cancel:     cancel,
		cache:      make(map[string]*cacheEntry),
		defaultTTL: ttl,
	}

	go c.cleaner()

	return c
}

func (c *DHTResultCache) Store(result *types.TaskResult) error {
	c.cacheMtx.Lock()
	defer c.cacheMtx.Unlock()

	c.cache[result.CacheKey] = &cacheEntry{
		Result:    result,
		ExpiresAt: time.Now().Add(c.defaultTTL),
	}

	c.logger.Debug("result cached", zap.String("key", result.CacheKey))
	return nil
}

func (c *DHTResultCache) Get(cacheKey string) (*types.TaskResult, bool) {
	c.cacheMtx.RLock()
	defer c.cacheMtx.RUnlock()

	entry, ok := c.cache[cacheKey]
	if !ok {
		return nil, false
	}

	if time.Now().After(entry.ExpiresAt) {
		delete(c.cache, cacheKey)
		return nil, false
	}

	return entry.Result, true
}

func (c *DHTResultCache) cleaner() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-c.ctx.Done():
			return
		case <-ticker.C:
			c.cleanExpired()
		}
	}
}

func (c *DHTResultCache) cleanExpired() {
	c.cacheMtx.Lock()
	defer c.cacheMtx.Unlock()

	now := time.Now()
	for key, entry := range c.cache {
		if now.After(entry.ExpiresAt) {
			delete(c.cache, key)
		}
	}
}

func (c *DHTResultCache) Close() {
	c.cancel()
}

func (c *DHTResultCache) GetStats() (count int, oldest time.Time) {
	c.cacheMtx.RLock()
	defer c.cacheMtx.RUnlock()

	count = len(c.cache)
	oldest = time.Now()

	for _, entry := range c.cache {
		if entry.ExpiresAt.Before(oldest) {
			oldest = entry.ExpiresAt
		}
	}

	return count, oldest
}
