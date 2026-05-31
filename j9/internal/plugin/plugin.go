package plugin

import (
	"dtask/internal/task"
	"plugin"
)

type Plugin interface {
	Name() string
	PreExecute(t *task.Task) error
	PostExecute(t *task.Task) error
}

type PluginSymbol struct {
	Name        func() string
	PreExecute  func(*task.Task) error
	PostExecute func(*task.Task) error
}

type LoadedPlugin struct {
	symbol PluginSymbol
}

func (lp *LoadedPlugin) Name() string {
	return lp.symbol.Name()
}

func (lp *LoadedPlugin) PreExecute(t *task.Task) error {
	return lp.symbol.PreExecute(t)
}

func (lp *LoadedPlugin) PostExecute(t *task.Task) error {
	return lp.symbol.PostExecute(t)
}

func LoadPlugin(path string) (Plugin, error) {
	p, err := plugin.Open(path)
	if err != nil {
		return nil, err
	}

	symName, err := p.Lookup("Name")
	if err != nil {
		return nil, err
	}

	symPreExecute, err := p.Lookup("PreExecute")
	if err != nil {
		return nil, err
	}

	symPostExecute, err := p.Lookup("PostExecute")
	if err != nil {
		return nil, err
	}

	return &LoadedPlugin{
		symbol: PluginSymbol{
			Name:        symName.(func() string),
			PreExecute:  symPreExecute.(func(*task.Task) error),
			PostExecute: symPostExecute.(func(*task.Task) error),
		},
	}, nil
}
