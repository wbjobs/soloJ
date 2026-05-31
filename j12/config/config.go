package config

import (
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	P2P      P2PConfig      `mapstructure:"p2p"`
	IPFS     IPFSConfig     `mapstructure:"ipfs"`
	Scheduler SchedulerConfig `mapstructure:"scheduler"`
	Plugin   PluginConfig   `mapstructure:"plugin"`
	Log      LogConfig      `mapstructure:"log"`
}

type P2PConfig struct {
	ListenPort       int           `mapstructure:"listen_port"`
	BootstrapPeers   []string      `mapstructure:"bootstrap_peers"`
	HeartbeatInterval time.Duration `mapstructure:"heartbeat_interval"`
	NodeTimeout      time.Duration `mapstructure:"node_timeout"`
	EnableMDNS       bool          `mapstructure:"enable_mdns"`
}

type IPFSConfig struct {
	APIAddress string `mapstructure:"api_address"`
}

type SchedulerConfig struct {
	QueueSize      int           `mapstructure:"queue_size"`
	WorkerCount    int           `mapstructure:"worker_count"`
	RetryInterval  time.Duration `mapstructure:"retry_interval"`
	MaxRetries     int           `mapstructure:"max_retries"`
	ResultTTL      time.Duration `mapstructure:"result_ttl"`
	EnableDedup    bool          `mapstructure:"enable_dedup"`
}

type PluginConfig struct {
	PluginDir     string   `mapstructure:"plugin_dir"`
	AutoLoad      bool     `mapstructure:"auto_load"`
	AllowedPlugins []string `mapstructure:"allowed_plugins"`
}

type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
}

func Load(path string) (*Config, error) {
	v := viper.New()
	v.SetConfigFile(path)
	v.SetDefault("p2p.listen_port", 4001)
	v.SetDefault("p2p.heartbeat_interval", 30*time.Second)
	v.SetDefault("p2p.node_timeout", 90*time.Second)
	v.SetDefault("p2p.enable_mdns", true)
	v.SetDefault("ipfs.api_address", "http://localhost:5001")
	v.SetDefault("scheduler.queue_size", 1000)
	v.SetDefault("scheduler.worker_count", 4)
	v.SetDefault("scheduler.retry_interval", 5*time.Second)
	v.SetDefault("scheduler.max_retries", 3)
	v.SetDefault("scheduler.result_ttl", 1*time.Hour)
	v.SetDefault("scheduler.enable_dedup", true)
	v.SetDefault("plugin.plugin_dir", "./plugins")
	v.SetDefault("plugin.auto_load", true)
	v.SetDefault("log.level", "info")
	v.SetDefault("log.format", "console")

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
