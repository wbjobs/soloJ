package plugin

import (
	"dtask/internal/task"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

type Manager struct {
	plugins []Plugin
}

func NewManager() *Manager {
	return &Manager{
		plugins: make([]Plugin, 0),
	}
}

func (m *Manager) LoadPlugins(pluginDir string) error {
	if runtime.GOOS == "windows" {
		fmt.Println("Warning: Plugin loading is not supported on Windows (requires .so files)")
		return nil
	}

	if _, err := os.Stat(pluginDir); os.IsNotExist(err) {
		return nil
	}

	return filepath.Walk(pluginDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		if strings.HasSuffix(info.Name(), ".so") {
			plugin, err := LoadPlugin(path)
			if err != nil {
				fmt.Printf("Warning: Failed to load plugin %s: %v\n", path, err)
				return nil
			}
			m.plugins = append(m.plugins, plugin)
			fmt.Printf("Loaded plugin: %s\n", plugin.Name())
		}

		return nil
	})
}

func (m *Manager) RunPreExecuteHooks(t *task.Task) {
	for _, p := range m.plugins {
		if err := p.PreExecute(t); err != nil {
			fmt.Printf("Plugin %s PreExecute error: %v\n", p.Name(), err)
		}
	}
}

func (m *Manager) RunPostExecuteHooks(t *task.Task) {
	for _, p := range m.plugins {
		if err := p.PostExecute(t); err != nil {
			fmt.Printf("Plugin %s PostExecute error: %v\n", p.Name(), err)
		}
	}
}

func (m *Manager) PluginCount() int {
	return len(m.plugins)
}
