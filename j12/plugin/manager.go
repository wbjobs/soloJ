package plugin

import (
	"fmt"
	"os"
	"path/filepath"
	"plugin"
	"sync"

	"github.com/fcnet/func-compute/config"
	"github.com/fcnet/func-compute/types"
	"go.uber.org/zap"
)

type Manager struct {
	cfg        *config.PluginConfig
	logger     *zap.Logger
	plugins    map[types.FunctionID]*loadedPlugin
	pluginsMtx sync.RWMutex
}

type loadedPlugin struct {
	spec     types.FunctionSpec
	function types.PluginFunction
	path     string
}

func NewManager(cfg *config.PluginConfig, logger *zap.Logger) *Manager {
	return &Manager{
		cfg:     cfg,
		logger:  logger,
		plugins: make(map[types.FunctionID]*loadedPlugin),
	}
}

func (m *Manager) LoadPlugins() error {
	if m.cfg.AutoLoad {
		return m.loadFromDir(m.cfg.PluginDir)
	}
	return nil
}

func (m *Manager) loadFromDir(dir string) error {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create plugin dir: %w", err)
	}

	files, err := filepath.Glob(filepath.Join(dir, "*.so"))
	if err != nil {
		return fmt.Errorf("glob plugins: %w", err)
	}

	for _, file := range files {
		if err := m.LoadPlugin(file); err != nil {
			m.logger.Warn("failed to load plugin", zap.String("file", file), zap.Error(err))
		}
	}

	return nil
}

func (m *Manager) LoadPlugin(path string) error {
	m.pluginsMtx.Lock()
	defer m.pluginsMtx.Unlock()

	for _, p := range m.plugins {
		if p.path == path {
			return fmt.Errorf("plugin already loaded: %s", path)
		}
	}

	p, err := plugin.Open(path)
	if err != nil {
		return fmt.Errorf("open plugin: %w", err)
	}

	sym, err := p.Lookup("Function")
	if err != nil {
		return fmt.Errorf("lookup Function symbol: %w", err)
	}

	fn, ok := sym.(types.PluginFunction)
	if !ok {
		return fmt.Errorf("symbol does not implement PluginFunction interface")
	}

	spec := fn.GetSpec()
	spec.PluginPath = path
	spec.ID = types.NewFunctionID(spec.Name, spec.Version)

	if m.isPluginAllowed(spec.Name) {
		m.plugins[spec.ID] = &loadedPlugin{
			spec:     spec,
			function: fn,
			path:     path,
		}
		m.logger.Info("plugin loaded", zap.String("name", spec.Name), zap.String("version", spec.Version))
	} else {
		m.logger.Warn("plugin not allowed", zap.String("name", spec.Name))
	}

	return nil
}

func (m *Manager) isPluginAllowed(name string) bool {
	if len(m.cfg.AllowedPlugins) == 0 {
		return true
	}
	for _, allowed := range m.cfg.AllowedPlugins {
		if allowed == name {
			return true
		}
	}
	return false
}

func (m *Manager) UnloadPlugin(id types.FunctionID) error {
	m.pluginsMtx.Lock()
	defer m.pluginsMtx.Unlock()

	if _, ok := m.plugins[id]; !ok {
		return fmt.Errorf("plugin not found: %s", id)
	}

	delete(m.plugins, id)
	m.logger.Info("plugin unloaded", zap.String("id", string(id)))
	return nil
}

func (m *Manager) GetFunction(id types.FunctionID) (types.PluginFunction, bool) {
	m.pluginsMtx.RLock()
	defer m.pluginsMtx.RUnlock()

	p, ok := m.plugins[id]
	if !ok {
		return nil, false
	}
	return p.function, true
}

func (m *Manager) GetSpec(id types.FunctionID) (*types.FunctionSpec, bool) {
	m.pluginsMtx.RLock()
	defer m.pluginsMtx.RUnlock()

	p, ok := m.plugins[id]
	if !ok {
		return nil, false
	}
	spec := p.spec
	return &spec, true
}

func (m *Manager) GetAllFunctions() []types.FunctionSpec {
	m.pluginsMtx.RLock()
	defer m.pluginsMtx.RUnlock()

	result := make([]types.FunctionSpec, 0, len(m.plugins))
	for _, p := range m.plugins {
		result = append(result, p.spec)
	}
	return result
}

func (m *Manager) GetFunctionIDs() []types.FunctionID {
	m.pluginsMtx.RLock()
	defer m.pluginsMtx.RUnlock()

	result := make([]types.FunctionID, 0, len(m.plugins))
	for id := range m.plugins {
		result = append(result, id)
	}
	return result
}

func (m *Manager) Execute(id types.FunctionID, input map[string]interface{}) (map[string]interface{}, error) {
	fn, ok := m.GetFunction(id)
	if !ok {
		return nil, fmt.Errorf("function not found: %s", id)
	}

	return fn.Execute(input)
}
