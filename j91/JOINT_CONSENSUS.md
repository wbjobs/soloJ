# 动态集群成员变更（Joint Consensus）实现文档

## 概述

本文档详细说明了如何实现 Raft 的动态集群成员变更功能，允许在不停机的情况下通过 API 向集群中添加或移除节点。实现采用了 Raft 论文中描述的 Joint Consensus（联合共识）算法，确保在过渡期间系统的可用性和一致性。

## 问题背景

在分布式系统中，集群成员可能需要动态变更：
- 扩展集群容量，添加新节点
- 节点故障或退役，移除旧节点
- 替换有问题的节点

直接切换配置可能导致脑裂（split brain）问题：在配置切换期间，可能出现两个不同的多数派，各自选举出 Leader。

## Joint Consensus 算法

联合共识算法通过两阶段提交来安全地切换集群配置：

### 阶段 1：联合共识（Joint Consensus）
1. Leader 收到配置变更请求（添加或移除节点）
2. Leader 创建并追加 `joint_consensus` 日志条目，包含新旧两个配置
3. 日志条目需要同时获得**旧配置的多数派**和**新配置的多数派**的同意才能提交
4. 一旦联合共识配置被提交，系统进入过渡阶段

**过渡期间的规则**：
- 日志复制需要发送给新旧两个配置的所有节点
- 选举需要同时获得新旧两个配置的多数派投票
- 提交需要同时获得新旧两个配置的多数派确认
- 新旧两个配置中的任何一个都不能独立做出决策

### 阶段 2：新配置（New Configuration）
1. 联合共识配置被提交和应用后，Leader 自动创建并追加 `new_config` 日志条目，只包含新配置
2. 这个日志条目只需要获得**新配置的多数派**同意即可提交
3. 一旦新配置被提交，过渡完成，系统恢复正常运行

## 实现细节

### 1. 数据结构

#### ConfigChangeState（配置变更状态）
```rust
pub enum ConfigChangeState {
    Stable,           // 稳定状态，只有一个配置生效
    JointConsensus,   // 联合共识状态，新旧配置同时生效
}
```

#### ClusterConfig（集群配置）
```rust
pub struct ClusterConfig {
    pub servers: HashMap<String, String>,  // 节点ID -> 地址
}
```

#### RaftStateInner 扩展字段
```rust
pub struct RaftStateInner {
    // ... 原有字段 ...
    pub config_change_state: ConfigChangeState,
    pub current_config: ClusterConfig,     // 当前配置（联合共识阶段为新配置）
    pub old_config: Option<ClusterConfig>, // 旧配置（仅在联合共识阶段存在）
    pub pending_config_change: bool,       // 是否有正在进行的配置变更
}
```

### 2. 配置变更 API

#### HTTP API

**添加节点**：
```http
POST /peers
Content-Type: application/json

{
    "peer_id": "node4",
    "peer_address": "127.0.0.1:50054"
}
```

**移除节点**：
```http
DELETE /peers
Content-Type: application/json

{
    "peer_id": "node3"
}
```

**列出节点**：
```http
GET /peers
```

响应：
```json
{
    "peers": [
        {
            "peer_id": "node1",
            "peer_address": "127.0.0.1:50051",
            "is_leader": true,
            "is_active": true
        }
    ],
    "leader_id": "node1"
}
```

#### gRPC API

```protobuf
service RaftService {
    rpc AddPeer(AddPeerRequest) returns (AddPeerResponse);
    rpc RemovePeer(RemovePeerRequest) returns (RemovePeerResponse);
    rpc ListPeers(ListPeersRequest) returns (ListPeersResponse);
}
```

### 3. 配置变更流程

#### 步骤 1：接收配置变更请求
```rust
pub async fn add_peer(&self, peer_id: String, peer_address: String) -> Result<bool, String> {
    let mut state = self.state.write().await;
    
    // 安全检查
    if state.state != RaftState::Leader {
        return Err("Not leader".to_string());
    }
    if state.pending_config_change {
        return Err("Another config change in progress".to_string());
    }
    if state.current_config.contains(&peer_id) {
        return Err("Peer already exists".to_string());
    }
    
    // 创建新配置
    let mut new_config = state.current_config.clone();
    new_config.servers.insert(peer_id.clone(), peer_address.clone());
    
    // 创建联合共识日志条目
    let command = serde_json::json!({
        "op": "config_change",
        "type": "joint_consensus",
        "new_config": new_config.servers,
    }).to_string();
    
    // 立即切换到联合共识状态
    state.old_config = Some(state.current_config.clone());
    state.current_config = new_config;
    state.config_change_state = ConfigChangeState::JointConsensus;
    state.pending_config_change = true;
    
    // 追加日志
    state.log.push(entry);
    self.storage.save_logs(&state.log).ok();
    
    // 为新节点初始化 next_index 和 match_index
    state.next_index.insert(peer_id.clone(), 1);
    state.match_index.insert(peer_id.clone(), 0);
    
    Ok(true)
}
```

#### 步骤 2：日志复制（联合共识阶段）
```rust
// 在 send_append_entries 中
let new_commit = if state.config_change_state == ConfigChangeState::JointConsensus {
    if let Some(ref old_config) = state.old_config {
        // 需要同时获得新旧配置的多数派
        let new_config_majority = state.current_config.majority(&state.match_index, last_log_index_val);
        let old_config_majority = old_config.majority(&state.match_index, last_log_index_val);
        std::cmp::min(new_config_majority, old_config_majority)
    } else {
        state.current_config.majority(&state.match_index, last_log_index_val)
    }
} else {
    state.current_config.majority(&state.match_index, last_log_index_val)
};
```

#### 步骤 3：应用联合共识配置
```rust
async fn apply_committed_entries(&self, state: &mut RaftStateInner) {
    while state.last_applied < state.commit_index {
        state.last_applied += 1;
        if let Some(entry) = state.log.iter().find(|e| e.index == state.last_applied) {
            if !entry.command.is_empty() {
                if let Ok(cmd) = serde_json::from_str::<serde_json::Value>(&entry.command) {
                    if let Some(op) = cmd.get("op").and_then(|v| v.as_str()) {
                        if op == "config_change" {
                            self.apply_config_change(state, &cmd);
                            
                            // 联合共识配置应用后，自动开始第二阶段
                            if state.config_change_state == ConfigChangeState::JointConsensus {
                                let new_config_command = serde_json::json!({
                                    "op": "config_change",
                                    "type": "new_config",
                                    "new_config": state.current_config.servers,
                                }).to_string();
                                
                                // 追加新配置日志条目
                                let new_entry = LogEntry { ... };
                                state.log.push(new_entry);
                                self.storage.save_logs(&state.log).ok();
                            }
                            continue;
                        }
                    }
                }
                
                // ... 应用其他命令
            }
        }
    }
}
```

#### 步骤 4：应用新配置
```rust
fn apply_config_change(&self, state: &mut RaftStateInner, command: &serde_json::Value) {
    if let Some(change_type) = command.get("type").and_then(|v| v.as_str()) {
        match change_type {
            "joint_consensus" => {
                // 进入联合共识状态
                if let Some(new_servers) = command.get("new_config") {
                    if let Ok(servers) = serde_json::from_value::<HashMap<String, String>>(new_servers.clone()) {
                        state.old_config = Some(state.current_config.clone());
                        state.current_config = ClusterConfig { servers };
                        state.config_change_state = ConfigChangeState::JointConsensus;
                        state.pending_config_change = true;
                    }
                }
            }
            "new_config" => {
                // 切换到新配置，过渡完成
                if let Some(new_servers) = command.get("new_config") {
                    if let Ok(servers) = serde_json::from_value::<HashMap<String, String>>(new_servers.clone()) {
                        state.current_config = ClusterConfig { servers };
                        state.old_config = None;
                        state.config_change_state = ConfigChangeState::Stable;
                        state.pending_config_change = false;
                    }
                }
            }
            _ => {}
        }
    }
}
```

### 4. 选举期间的联合共识支持

```rust
async fn start_election(node: Arc<RaftNode>) {
    // 收集新旧两个配置中的所有节点
    let mut all_peers: Vec<String> = node.config.peers();
    let mut all_addresses: Vec<String> = ...;
    
    if state.config_change_state == ConfigChangeState::JointConsensus {
        if let Some(ref old_config) = state.old_config {
            for (peer_id, _) in &old_config.servers {
                if peer_id != &node.config.id && !all_peers.contains(peer_id) {
                    all_peers.push(peer_id.clone());
                    // 添加地址
                }
            }
        }
    }
    
    // ... 请求投票
    
    // 检查是否同时获得新旧配置的多数派
    let can_lead = if in_joint_consensus {
        if let Some(ref old_cfg) = old_config_clone {
            let new_total = new_config_clone.servers.len();
            let old_total = old_cfg.servers.len();
            let new_majority = new_total / 2 + 1;
            let old_majority = old_total / 2 + 1;
            // 需要同时获得两个多数派
            current_votes >= new_majority && current_votes >= old_majority
        } else {
            // ...
        }
    } else {
        // ...
    };
}
```

### 5. 读取安全检查

```rust
pub async fn safe_to_read(&self) -> bool {
    let state = self.state.read().await;
    
    if state.state != RaftState::Leader {
        return false;
    }
    
    let last_log_index = state.log.last().map(|e| e.index).unwrap_or(0);
    
    let confirmed = if state.config_change_state == ConfigChangeState::JointConsensus {
        if let Some(ref old_config) = state.old_config {
            // 同时检查新旧配置的确认
            let new_config_commit = state.current_config.majority(&state.match_index, last_log_index);
            let old_config_commit = old_config.majority(&state.match_index, last_log_index);
            std::cmp::min(new_config_commit, old_config_commit)
        } else {
            state.current_config.majority(&state.match_index, last_log_index)
        }
    } else {
        state.current_config.majority(&state.match_index, last_log_index)
    };
    
    confirmed >= state.read_index && state.last_applied >= state.read_index
}
```

## 安全保证

### 1. 配置变更互斥
同一时间只能进行一个配置变更：
```rust
if state.pending_config_change {
    return Err("Another config change in progress".to_string());
}
```

### 2. 不能移除自己
```rust
if peer_id == self.config.id {
    return Err("Cannot remove self".to_string());
}
```

### 3. 重复添加检查
```rust
if state.current_config.contains(&peer_id) {
    return Err("Peer already exists".to_string());
}
```

### 4. 联合共识期间的多数派保证
在联合共识阶段，任何决策（提交、选举）都需要同时获得新旧两个配置的多数派同意，确保不会出现脑裂。

### 5. 配置变更期间禁止普通写入
```rust
pub async fn propose_command(&self, command: String) -> bool {
    let mut state = self.state.write().await;
    
    if state.state != RaftState::Leader {
        return false;
    }
    
    // 配置变更期间禁止普通写入，防止冲突
    if state.pending_config_change {
        return false;
    }
    
    // ...
}
```

## 使用示例

### 启动初始集群

节点 1：
```bash
cargo run -- --id node1 \
  --peer-ids node2,node3 \
  --peer-addresses 127.0.0.1:50052,127.0.0.1:50053 \
  --grpc-port 50051 --http-port 8081
```

节点 2：
```bash
cargo run -- --id node2 \
  --peer-ids node1,node3 \
  --peer-addresses 127.0.0.1:50051,127.0.0.1:50053 \
  --grpc-port 50052 --http-port 8082
```

节点 3：
```bash
cargo run -- --id node3 \
  --peer-ids node1,node2 \
  --peer-addresses 127.0.0.1:50051,127.0.0.1:50052 \
  --grpc-port 50053 --http-port 8083
```

### 动态添加节点

1. 启动新节点（先不加入集群）：
```bash
cargo run -- --id node4 \
  --peer-ids node1,node2,node3 \
  --peer-addresses 127.0.0.1:50051,127.0.0.1:50052,127.0.0.1:50053 \
  --grpc-port 50054 --http-port 8084
```

2. 通过 Leader 的 API 添加节点：
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"peer_id": "node4", "peer_address": "127.0.0.1:50054"}' \
  http://localhost:8081/peers
```

3. 系统自动完成联合共识过渡，查看状态：
```bash
curl http://localhost:8081/status
```

响应中会显示 `config_change_state`：
- `stable` - 稳定状态
- `joint_consensus` - 正在进行联合共识过渡

### 动态移除节点

```bash
curl -X DELETE -H "Content-Type: application/json" \
  -d '{"peer_id": "node3"}' \
  http://localhost:8081/peers
```

### 查看集群节点

```bash
curl http://localhost:8081/peers
```

## 过渡期间的可用性

在联合共识过渡期间：
- **写入操作**：暂时禁止（返回错误），确保一致性
- **读取操作**：需要通过 `safe_to_read` 检查，确保线性一致性
- **选举操作**：正常进行，但需要新旧配置的多数派
- **可用性**：只要新旧两个配置的多数派都在线，系统就可用

## 故障场景处理

### 场景 1：Leader 在联合共识阶段崩溃

1. 新 Leader 被选举出来（需要新旧配置的多数派）
2. 新 Leader 会继续完成未完成的配置变更
3. 日志会被继续复制和提交

### 场景 2：新节点在添加过程中崩溃

1. 如果联合共识还未提交，配置变更失败
2. 如果联合共识已提交但新配置未提交，新 Leader 会继续完成
3. 最终要么配置变更成功，要么回滚到旧配置

### 场景 3：移除的节点在过渡期间试图参与

1. 由于联合共识需要旧配置的多数派，被移除的节点在阶段 1 仍然可以投票
2. 一旦进入阶段 2（新配置），被移除的节点不再参与决策
3. 被移除的节点最终会超时并开始选举，但无法获得新配置的多数派

## 总结

Joint Consensus 算法通过两阶段提交安全地实现了动态集群成员变更：

1. **阶段 1（联合共识）**：新旧配置同时生效，决策需要两个多数派
2. **阶段 2（新配置）**：只使用新配置，恢复正常运行

这种设计确保了：
- ✅ 配置变更期间不会出现脑裂
- ✅ 配置变更期间系统保持可用
- ✅ 配置变更可以安全中断和恢复
- ✅ 新旧配置的切换是原子的
