# 音视频字幕校准系统

一个完整的音视频字幕自动校准系统，集成了语音活动检测(VAD)和智能时间轴对齐算法。

## 功能特性

- 🎬 **视频上传与预览**: 支持拖拽上传，实时视频预览
- 🎤 **语音活动检测**: 基于 WebRTC VAD 的人声检测
- 🔍 **智能校准算法**: 自动计算字幕偏移量
- ⏱️ **时间轴可视化**: VAD 语音段与字幕时间轴对比显示
- ✏️ **手动微调**: 支持手动调整字幕偏移量
- 📦 **分片上传**: 大文件分片上传，支持断点续传
- 🔄 **异步任务队列**: Bull 队列处理长时任务
- 📡 **WebSocket 实时推送**: 任务进度实时更新
- 🌐 **WebRTC P2P**: 点对点视频预览，降低服务器带宽

## 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (React + TypeScript)                 │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐  │
│  │ 文件上传    │  │ 视频预览   │  │ 时间轴调整面板          │  │
│  └────────────┘  └────────────┘  └──────────────────────────┘  │
│         │               │                     │                 │
│  ┌──────┴───────────────┴─────────────────────┴───────────────┐  │
│  │  FFmpeg.wasm (视频切片)  │   WebRTC (P2P预览)             │  │
│  └─────────────────────────┴─────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────┘
                                       │ HTTP/WebSocket
                                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  后端 (Node.js + Express)                        │
│  ┌────────────┐  ┌────────────┐  ┌──────────────────────────┐  │
│  │ 上传API    │  │ WebSocket  │  │  WebRTC 信令服务        │  │
│  └────────────┘  └────────────┘  └──────────────────────────┘  │
│         │               │                                        │
│  ┌──────┴───────────────┴───────────────┐                       │
│  │           Bull 任务队列              │                       │
│  └──────────────────────────────────────┘                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│               算法服务 (Python + FastAPI)                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  音频提取器      │  │   VAD 检测       │  │  字幕对齐算法 │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
          ┌────────────────────┴────────────────────┐
          ▼                                         ▼
┌───────────────────┐                   ┌───────────────────┐
│   PostgreSQL      │                   │      Redis        │
│  (任务存储)       │                   │  (队列/缓存)      │
└───────────────────┘                   └───────────────────┘
```

## 快速开始

### 方式一：Docker Compose (推荐)

```bash
# 1. 复制环境变量配置
cp .env.example .env

# 2. 启动所有服务
docker-compose up -d

# 3. 访问前端
# http://localhost:3000
```

### 方式二：手动启动

#### 1. 启动数据库和 Redis

```bash
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_USER=subtitle_user \
  -e POSTGRES_PASSWORD=subtitle_pass \
  -e POSTGRES_DB=subtitle_alignment \
  postgres:15-alpine

docker run -d --name redis -p 6379:6379 redis:7-alpine
```

#### 2. 启动算法服务

```bash
cd algorithm
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

#### 3. 启动后端 API

```bash
cd backend
npm install
npm run dev
```

#### 4. 启动前端

```bash
cd frontend
npm install
npm run dev
```

## 项目结构

```
.
├── frontend/                 # React + TypeScript 前端
│   ├── src/
│   │   ├── components/       # 组件
│   │   │   ├── FileUpload.tsx      # 文件上传
│   │   │   ├── VideoPreview.tsx    # 视频预览
│   │   │   └── Timeline.tsx        # 时间轴
│   │   ├── pages/            # 页面
│   │   │   ├── Home.tsx            # 首页
│   │   │   ├── TaskList.tsx        # 任务列表
│   │   │   └── TaskDetail.tsx      # 任务详情
│   │   ├── services/         # API 服务
│   │   │   ├── api.ts              # HTTP API
│   │   │   └── websocket.ts        # WebSocket
│   │   ├── hooks/            # 自定义 Hook
│   │   │   └── useWebRTC.ts        # WebRTC Hook
│   │   ├── utils/            # 工具函数
│   │   │   └── ffmpeg.ts           # FFmpeg.wasm
│   │   └── types/            # TypeScript 类型
│   ├── Dockerfile
│   └── package.json
├── backend/                  # Node.js + Express 后端
│   ├── src/
│   │   ├── config/           # 配置
│   │   │   ├── database.js         # 数据库
│   │   │   └── redis.js            # Redis
│   │   ├── models/           # 数据模型
│   │   │   └── Task.js             # 任务模型
│   │   ├── routes/           # 路由
│   │   │   ├── uploadRoutes.js     # 上传
│   │   │   ├── taskRoutes.js       # 任务
│   │   │   └── webrtcRoutes.js     # WebRTC 信令
│   │   ├── queues/           # 任务队列
│   │   │   └── taskQueue.js        # Bull 队列
│   │   ├── websocket/        # WebSocket
│   │   │   └── WebSocketManager.js # WebSocket 管理器
│   │   └── index.js
│   ├── Dockerfile
│   └── package.json
├── algorithm/                # Python + FastAPI 算法服务
│   ├── src/
│   │   ├── services/         # 服务
│   │   │   ├── audio_extractor.py  # 音频提取
│   │   │   ├── vad_service.py      # VAD 检测
│   │   │   ├── srt_service.py      # SRT 解析
│   │   │   └── alignment_service.py # 字幕对齐
│   │   └── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── database/                 # 数据库
│   └── init.sql              # 初始化脚本
├── docker/                   # Docker 相关
├── docker-compose.yml
└── README.md
```

## API 接口

### 上传接口

- `POST /api/upload` - 上传视频和字幕文件
- `POST /api/upload/chunk` - 分片上传
- `POST /api/upload/merge` - 合并分片

### 任务接口

- `GET /api/tasks` - 获取任务列表
- `GET /api/tasks/:id` - 获取任务详情
- `POST /api/tasks/:id/apply-offset` - 应用手动偏移量
- `GET /api/tasks/:id/download` - 下载字幕
- `DELETE /api/tasks/:id` - 删除任务

### WebRTC 信令

- `POST /api/webrtc/offer` - 发送 Offer
- `POST /api/webrtc/answer` - 发送 Answer
- `GET /api/webrtc/offer/:taskId/:peerId` - 获取 Offer
- `GET /api/webrtc/answer/:taskId/:peerId` - 获取 Answer
- `POST /api/webrtc/ice` - 发送 ICE 候选
- `GET /api/webrtc/ice/:taskId/:peerId` - 获取 ICE 候选

### WebSocket

- `ws://localhost:3001/ws` - WebSocket 连接
- 订阅任务进度: `{ "type": "subscribe", "taskId": "..." }`
- 消息类型:
  - `progress` - 进度更新
  - `completed` - 任务完成
  - `error` - 任务出错

### 算法服务 API

- `POST /api/v1/align` - 执行字幕校准
- `POST /api/v1/vad` - VAD 语音检测
- `POST /api/v1/parse-srt` - 解析 SRT 文件

## 核心算法

### 语音活动检测 (VAD)

- 优先使用 WebRTC VAD (高性能)
- 降级方案: 基于能量的 VAD
- 采样率: 16kHz, 单声道

### 字幕对齐算法

1. 提取视频音频轨
2. VAD 检测人声时间段
3. 解析 SRT 字幕时间轴
4. 滑动窗口搜索最佳偏移量
5. 计算重叠度评分
6. 生成校准建议

## 开发说明

### 环境变量

参考 `.env.example` 文件配置环境变量。

### 数据库迁移

后端启动时会自动通过 Sequelize 同步数据库结构。

### 生产部署

1. 修改环境变量配置
2. 使用 `docker-compose -f docker-compose.yml up -d`
3. 配置反向代理 (Nginx)
4. 启用 HTTPS

## 许可证

MIT License
