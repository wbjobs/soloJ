# 同步乐谱 - Sync Score

一个支持多人实时同步的 SVG 乐谱应用，包含节拍器、WebRTC 数据同步和 MongoDB 标注存储。

## 功能特性

- 🎵 SVG 硬编码钢琴乐谱（C 大调音阶）
- 🥁 Web Audio API 精确节拍器（误差 < 50ms）
- 🔗 WebRTC 数据通道实现房间内节拍和高亮严格同步
- 📡 WebSocket 信令服务器协助建立 WebRTC 连接
- 🎨 MongoDB 持久化标注存储，支持任意颜色标记
- 🔄 多人标注乐观锁 + 实时广播，防止数据丢失和顺序错乱

## 运行要求

- Node.js >= 16
- MongoDB 本地运行在默认端口 (27017)

## 安装和运行

```bash
# 安装依赖
npm install

# 启动服务器
npm start
```

访问 `http://localhost:3000` 打开应用。

## 使用说明

### 创建/加入房间

1. 点击「创建房间」作为房主，获得 6 位房间号
2. 另一用户输入房间号，点击「加入房间」
3. 所有成员可在页面看到房间信息和成员列表

### 节拍同步

- 仅**房主**可以控制节拍开始/停止
- 房主点击「开始节拍」后，所有成员的节拍和音符高亮严格同步
- 调整 BPM（40-240）后重新开始生效

### 标注乐谱

- 选择标注颜色（颜色选择器）
- 点击任意音符添加彩色标记
- 标注自动保存到 MongoDB，并实时广播给房间内所有成员
- 点击「清除标注」删除所有标记

## 多人标注一致性方案

针对您反馈的**多人标注数据丢失/顺序错乱**问题，已实现以下修复：

### 后端（[server/index.js](file:///e:/soloJ/j1/server/index.js)）

1. **原子序列号生成**：内存中维护 `sequenceCounters`，每个标注创建时分配递增的全局序列号
2. **乐观并发控制**：`Annotation` 模型包含 `version` 字段，更新时检测版本冲突返回 409
3. **按序查询**：GET API 支持 `sinceSequence` 参数，按 `sequence` 升序返回增量数据
4. **WebSocket 广播**：标注创建/更新/删除时，实时推送到所有连接的客户端

### 数据模型（[server/models/Annotation.js](file:///e:/soloJ/j1/server/models/Annotation.js)）

```javascript
{
  scoreId: String,      // 乐谱 ID
  noteIndex: Number,    // 音符索引
  color: String,        // 标注颜色
  author: String,       // 作者
  version: Number,      // 乐观锁版本号
  sequence: Number      // 全局序列号（用于排序）
}
```

## 架构说明

```
┌────────────────┐     WebSocket      ┌────────────────┐
│   客户端 A     │◄──────────────────►│   信令服务器    │
│  (房主/成员)   │                    │  (Node.js)     │
└────────┬───────┘                    └────────┬───────┘
         │                                     │
         │ WebRTC DataChannel                  │ MongoDB
         │                                     │
┌────────▼───────┐                    ┌────────▼───────┐
│   客户端 B     │                    │   标注存储      │
│  (成员)        │                    │                │
└────────────────┘                    └────────────────┘
```

## 技术栈

- **前端**：原生 JS + SVG + Web Audio API + WebRTC
- **后端**：Node.js + Express + ws (WebSocket)
- **数据库**：MongoDB + Mongoose
