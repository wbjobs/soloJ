# MQTT 数据包嗅探与协议推断工具

一个功能强大的命令行工具，用于监听 MQTT Broker，抓取所有 Pub/Sub 数据包，并自动推断协议结构。

## 功能特性

- **MQTT 数据包嗅探**: 连接到 MQTT Broker，订阅所有主题，实时捕获发布消息
- **协议推断模块**: 基于 Payload 字节分布，自动推测可能的字段边界
  - 检测长度前缀字段
  - 识别校验和位置 (XOR, SUM)
  - 发现序列号/计数器
  - 识别固定魔术字节
  - 推测消息类型字段
- **SQLite 持久化存储**: 实时存储捕获的数据包和分析结果
- **多模式操作**: 支持实时嗅探、离线分析、数据导出等多种模式

## 安装

```bash
pip install -r requirements.txt
```

或者以开发模式安装:

```bash
pip install -e .
```

## 快速开始

### 1. 启动嗅探

```bash
# 基本嗅探
python -m mqtt_sniffer.main sniff -H localhost -p 1883

# 启用自动协议分析并显示详细载荷
python -m mqtt_sniffer.main sniff -H localhost -p 1883 --auto-analyze --verbose

# 带认证的 Broker
python -m mqtt_sniffer.main sniff -H mqtt.example.com -p 1883 -u user -P pass
```

### 2. 分析已捕获的数据

```bash
# 分析数据库中所有数据包
python -m mqtt_sniffer.main analyze

# 按特定主题过滤分析
python -m mqtt_sniffer.main analyze -t sensors/temperature

# 保存分析结果到数据库
python -m mqtt_sniffer.main analyze --save
```

### 3. 查看统计信息

```bash
python -m mqtt_sniffer.main stats
```

### 4. 列出数据包

```bash
# 列出最近 50 个包
python -m mqtt_sniffer.main list

# 列出特定主题的包
python -m mqtt_sniffer.main list -t devices/+/status

# 显示更多包
python -m mqtt_sniffer.main list -n 100
```

### 5. 导出数据

```bash
python -m mqtt_sniffer.main export -o packets.json
```

### 6. 清空数据库

```bash
python -m mqtt_sniffer.main clear
```

## 命令详解

### sniff - 嗅探模式

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-H, --host` | MQTT Broker 地址 | localhost |
| `-p, --port` | MQTT Broker 端口 | 1883 |
| `-u, --username` | 用户名 | - |
| `-P, --password` | 密码 | - |
| `-v, --verbose` | 显示详细载荷内容 | false |
| `--auto-analyze` | 启用自动协议分析 | false |
| `--analyze-interval` | 分析间隔包数 | 20 |

### analyze - 分析模式

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-t, --topic` | 按主题过滤 | - |
| `-n, --limit` | 分析包数量上限 | 1000 |
| `--save` | 保存分析结果 | false |

### stats - 统计模式

显示数据库总体统计和各主题的数据包分布。

### list - 列表模式

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-t, --topic` | 按主题过滤 | - |
| `-n, --limit` | 显示包数量 | 50 |

### export - 导出模式

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-o, --output` | 输出文件路径 | mqtt_packets.json |
| `-n, --limit` | 导出数量限制 | - |

## 协议推断说明

协议推断模块通过分析多个数据包的字节分布，自动识别以下字段类型:

| 字段类型 | 说明 | 检测方法 |
|---------|------|---------|
| **magic_byte** | 固定魔术字节 | 在所有包中值相同的字节 |
| **length_prefix** | 长度前缀 | 值等于后续字节数的字段 |
| **sequence_number** | 序列号 | 随时间递增的字段 |
| **message_type** | 消息类型 | 有有限种不同值的字段 |
| **checksum_xor** | XOR 校验和 | 与前面所有字节 XOR 结果匹配 |
| **checksum_sum** | SUM 校验和 | 与前面所有字节求和结果匹配 |

每个推断结果都有置信度评分，置信度越高表示推断越可靠。

## 数据库结构

### mqtt_packets 表

存储所有捕获的 MQTT 数据包:

| 字段 | 说明 |
|------|------|
| id | 主键 |
| timestamp | 时间戳 |
| datetime | 可读时间 |
| packet_type | 包类型 (PUBLISH 等) |
| direction | 方向 |
| topic | 主题 |
| qos | 服务质量 |
| retain | 保留标志 |
| payload_hex | 载荷 (十六进制) |
| payload_length | 载荷长度 |
| client_id | 客户端 ID |
| packet_id | 包 ID |

### topic_stats 表

主题统计信息:

| 字段 | 说明 |
|------|------|
| topic | 主题 (主键) |
| packet_count | 包数量 |
| first_seen | 首次出现 |
| last_seen | 最后出现 |
| total_bytes | 总字节数 |
| avg_payload_length | 平均载荷长度 |

## 示例输出

### 嗅探输出

```
============================================================
MQTT 数据包嗅探器 - 会话 ID: a1b2c3d4
============================================================
Broker: localhost:1883
数据库: mqtt_sniffer.db
自动分析: 启用

[+] Connected to MQTT Broker at localhost:1883
[+] Subscribed to all topics with QoS: [0]
[+] 嗅探已启动，按 Ctrl+C 停止

[14:32:15.123] PUBLISH sensors/temperature (12 bytes)
[14:32:16.456] PUBLISH devices/door/status (8 bytes)
[14:32:17.789] PUBLISH sensors/humidity (10 bytes)
```

### 协议分析输出

```
============================================================
协议结构推断分析报告
============================================================
分析的数据包数量: 25
最大数据包长度: 16 字节
------------------------------------------------------------
检测到 3 个候选字段:
------------------------------------------------------------
1. 偏移 0-0 (长度 1 字节)
   类型: magic_byte
   置信度: 100.0%
   描述: 固定值 0xAA, 出现在所有包中

2. 偏移 1-2 (长度 2 字节)
   类型: length_prefix
   置信度: 96.0%
   描述: 可能的长度字段 (大端), 匹配 24/25 个包

3. 偏移 15-15 (长度 1 字节)
   类型: checksum_xor
   置信度: 88.0%
   描述: XOR 校验和, 匹配 22/25
```

## 注意事项

1. **权限要求**: 连接 MQTT Broker 需要相应的订阅权限
2. **数据包数量**: 协议推断需要至少 5-10 个数据包才能得到可靠结果
3. **性能考虑**: 高流量环境下建议关闭 `--verbose` 以提升性能
4. **数据库大小**: 长时间运行可能产生大量数据，定期清理或导出

## License

MIT License
