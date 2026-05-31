# Raft KV Store

基于 Raft 一致性算法的分布式键值存储系统。

## 功能特性

- **Leader 选举**: 自动选举集群 Leader
- **日志复制**: 可靠的日志复制机制
- **安全性保证**: 完整的 Raft 安全性特性
- **WAL 日志**: 预写日志持久化
- **Snapshot**: 快照压缩功能
- **gRPC 接口**: 集群内部通信
- **HTTP API**: Put/Get/Delete 操作接口

## 项目结构

```
raft-kv/
├── proto/
│   └── raft.proto              # gRPC 协议定义
├── src/
│   ├── main.rs                 # 主程序入口
│   ├── lib.rs                  # 库入口
│   ├── raft.rs                 # Raft 核心状态机
│   ├── storage.rs              # 持久化存储层
│   ├── server.rs               # gRPC 服务端
│   └── http_api.rs             # HTTP API
├── build.rs                    # Protobuf 编译脚本
├── Cargo.toml                  # 项目配置
└── README.md                   # 说明文档
```

## 模块说明

### 1. Raft 核心状态机 (raft.rs)
- **RaftNode**: Raft 节点结构体
- **RaftStateInner**: 节点内部状态
- **request_vote**: 处理投票请求
- **append_entries**: 处理日志追加请求
- **install_snapshot**: 处理快照安装
- **propose_command**: 提交命令
- **run_election_timeout**: 选举超时处理
- **run_heartbeat**: Leader 心跳发送

### 2. 持久化存储层 (storage.rs)
- **Storage trait**: 存储接口
- **WalLog**: WAL 日志实现
- **load_logs/save_logs**: 日志加载/保存
- **load_term/save_term**: Term 加载/保存
- **save_snapshot/load_snapshot**: 快照保存/加载

### 3. gRPC 服务 (server.rs)
- **RaftServiceImpl**: gRPC 服务实现
- **RequestVote/AppendEntries/InstallSnapshot**: Raft RPC
- **Put/Get/Delete**: KV 操作 RPC

### 4. HTTP API (http_api.rs)
- `POST /kv/{key}` - Put 操作
- `GET /kv/{key}` - Get 操作  
- `DELETE /kv/{key}` - Delete 操作
- `GET /status` - 节点状态

## 构建和运行

### 前置要求
- Rust 1.70+
- Protobuf 编译器 (protoc)
- Visual Studio Build Tools (Windows)

### 构建
```bash
cargo build --release
```

### 启动集群

启动节点 1:
```bash
cargo run -- --id node1 --peers "127.0.0.1:50052,127.0.0.1:50053" --grpc-port 50051 --http-port 8081
```

启动节点 2:
```bash
cargo run -- --id node2 --peers "127.0.0.1:50051,127.0.0.1:50053" --grpc-port 50052 --http-port 8082
```

启动节点 3:
```bash
cargo run -- --id node3 --peers "127.0.0.1:50051,127.0.0.1:50052" --grpc-port 50053 --http-port 8083
```

## API 使用示例

### Put 操作
```bash
curl -X POST -H "Content-Type: application/json" -d '{"value":"hello"}' http://localhost:8081/kv/mykey
```

### Get 操作
```bash
curl http://localhost:8081/kv/mykey
```

### Delete 操作
```bash
curl -X DELETE http://localhost:8081/kv/mykey
```

### 查看状态
```bash
curl http://localhost:8081/status
```

## Raft 算法实现细节

### Leader 选举
1. 节点启动时为 Follower 状态
2. 选举超时后变为 Candidate
3. Candidate 向所有节点请求投票
4. 获得多数票后成为 Leader
5. Leader 定期发送心跳

### 日志复制
1. Client 将命令发送给 Leader
2. Leader 将命令追加到本地日志
3. Leader 向 Follower 发送 AppendEntries RPC
4. Follower 复制日志并返回确认
5. 多数节点复制后，Leader 提交日志
6. 日志应用到状态机

### 安全性保证
- **选举安全**: 每个 Term 最多一个 Leader
- **Leader 只追加**: Leader 不修改已有日志
- **日志匹配**: 相同索引的日志内容相同
- **Leader 完整性**: Leader 包含所有已提交日志
- **状态机安全**: 状态机应用相同的日志序列
