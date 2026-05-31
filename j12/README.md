# FCNet - 去中心化函数计算后端服务

基于 libp2p 协议的去中心化函数计算平台，支持节点自动发现、函数插件化、任务自动调度和结果缓存去重。

## 核心特性

- **P2P网络层**
  - 节点自动发现 (mDNS)
  - 心跳机制与健康检查
  - 节点状态管理

- **插件系统**
  - Go plugin 动态加载
  - 函数注册与发现
  - 权限控制

- **任务调度**
  - 一致性哈希调度
  - 任务队列与重试
  - 自动路由到可用节点

- **结果缓存**
  - DHT式结果缓存
  - 结果去重
  - TTL自动过期

## 项目结构

```
.
├── cmd/
│   ├── node/          # 节点主程序
│   └── client/        # 客户端示例
├── p2p/               # P2P网络层
│   ├── host.go       # 节点主机实现
│   └── message.go    # 消息传输协议
├── plugin/            # 插件管理器
│   └── manager.go    # 插件加载与管理
├── scheduler/         # 任务调度器
│   └── scheduler.go  # 调度逻辑
├── registry/          # 函数注册中心
│   └── registry.go   # IPFS注册与缓存
├── types/             # 核心类型定义
├── config/            # 配置管理
├── plugins/           # 插件目录
│   └── math/         # 示例数学插件
├── config.yaml        # 配置文件
└── Makefile
```

## 快速开始

### 1. 安装依赖

```bash
make deps
```

### 2. 编译节点

```bash
make build
```

### 3. 编译插件

```bash
make build-plugins
```

### 4. 启动节点

```bash
make run-node
```

或直接运行：

```bash
./bin/node
```

### 5. 使用客户端调用函数

```bash
# 加法运算
go run ./cmd/client -op add -a 10 -b 20

# 乘法运算
go run ./cmd/client -op multiply -a 5 -b 6

# 分片执行WordCount（带进度追踪）
go run ./cmd/client_sharded -f wordcount:1.0.0 -lines 5000 -watch
```

## 数据分片与MapReduce

### 分片策略

系统支持4种分片策略：

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| **range** | 按范围分片 | 有序数据集 |
| **hash** | 按哈希值分片 | 分布式负载均衡 |
| **size** | 按数据大小分片 | 大小不均的数据集 |
| **key** | 按键值分组分片 | 需要按组处理的数据 |

### 合并器类型

| 合并器 | 说明 | 输出 |
|--------|------|------|
| **sum** | 求和合并 | sum, total, count, average |
| **average** | 平均值合并 | average, total_sum, total_count |
| **list** | 列表合并（按分片顺序） | items, count |
| **map** | MapReduce合并（键值合并） | map, count |
| **groupby** | 分组合并 | groups, group_count |
| **passthrough** | 透传（默认） | 所有分片的原始结果 |

### 分片执行流程

```
客户端         调度节点           工作节点1       工作节点2
  |                |                  |               |
  |-- 提交大任务 -->|                  |               |
  |                |-- 检测阈值       |               |
  |                |-- 自动分片       |               |
  |                |-- 分发子任务 -->|               |
  |                |-- 分发子任务 ------------------>|
  |                |<-- 执行结果 ----|               |
  |                |<-- 执行结果 --------------------|
  |                |-- 合并结果      |               |
  |<-- 返回结果 ----|                  |               |
```

### 进度追踪

分片任务支持实时进度追踪：

```bash
# 自动开启进度条显示
go run ./cmd/client_sharded -f wordcount:1.0.0 -lines 10000 -watch

# 输出:
# Progress: [████████████░░░░░░░░░░] 50.0% | 4/8 | Pending:2 Running:2 Completed:4 Failed:0
```

### 注册分片策略和合并器

```go
// 为WordCount函数注册分片策略和合并器
wordCountID := types.NewFunctionID("wordcount", "1.0.0")
sched.RegisterShardPolicy(wordCountID, types.ShardPolicy{
    Strategy:       types.ShardStrategySize,
    ThresholdBytes: 1024 * 1024,  // 1MB阈值
    MaxShards:      8,
    ShardSizeBytes: 256 * 1024,   // 每个分片256KB
    DataField:      "data",
})
sched.RegisterCombiner(wordCountID, sharding.CombinerMap)
```

## 配置说明

详见 [config.yaml](config.yaml)

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| p2p.listen_port | P2P监听端口 | 4001 |
| p2p.heartbeat_interval | 心跳间隔 | 30s |
| p2p.node_timeout | 节点超时时间 | 90s |
| scheduler.worker_count | 工作协程数 | 4 |
| scheduler.max_retries | 最大重试次数 | 3 |
| scheduler.result_ttl | 结果缓存TTL | 1h |
| plugin.plugin_dir | 插件目录 | ./plugins |

## 插件开发

### 插件接口

```go
type PluginFunction interface {
    Execute(input map[string]interface{}) (map[string]interface{}, error)
    GetSpec() FunctionSpec
}
```

### 示例插件

```go
package main

import "github.com/fcnet/func-compute/types"

type MyFunction struct{}

var Function types.PluginFunction = &MyFunction{}

func (f *MyFunction) GetSpec() types.FunctionSpec {
    return types.FunctionSpec{
        Name:        "my_func",
        Version:     "1.0.0",
        Description: "My custom function",
        Timeout:     5 * time.Second,
        MemoryMB:    128,
    }
}

func (f *MyFunction) Execute(input map[string]interface{}) (map[string]interface{}, error) {
    // 执行逻辑
    return map[string]interface{}{"result": "ok"}, nil
}
```

编译插件：

```bash
go build -buildmode=plugin -o plugins/my_func.so ./plugins/my_func
```

## 架构设计

### 节点发现流程

1. 节点启动后通过 mDNS 发现网络中的其他节点
2. 建立连接后通过心跳协议交换节点信息
3. 各节点维护可用节点列表和函数提供者映射

### 任务调度流程

1. 客户端提交任务到任意节点
2. 节点查询函数提供者列表
3. 通过一致性哈希选择目标节点
4. 任务转发到目标节点执行
5. 执行结果返回提交者并缓存到 DHT

### 结果去重流程

1. 任务提交时生成 cache key (function_id + input_hash)
2. 查询本地缓存，命中则直接返回
3. 未命中则执行任务
4. 执行结果写入缓存，设置 TTL

## 网络协议

| 协议 ID | 说明 |
|---------|------|
| /fcnet/heartbeat/1.0.0 | 心跳协议 |
| /fcnet/task/1.0.0 | 任务传输协议 |
| /fcnet/result/1.0.0 | 结果传输协议 |

## 依赖项

- Go 1.21+
- libp2p
- IPFS (可选，用于函数元数据存储)

## 注意事项

1. Windows 系统暂不支持 Go plugin，请使用 Linux 或 macOS
2. 插件必须使用与主程序相同版本的 Go 编译
3. 插件与主程序的依赖版本必须一致

## License

MIT
