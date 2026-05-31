# DICOM 医学影像批量处理系统

基于 WebAssembly (Rust) 的前端 DICOM 解析脱敏 + Redis 消息队列 + WebSocket 实时进度推送

## 项目架构

```
├── wasm/                   # Rust WASM 模块，DICOM 解析和脱敏
├── frontend/               # 前端 HTML/JS 界面
│   ├── index.html          # 主页面（批量队列管理）
│   └── dicom-worker.js     # Web Worker 后台处理大文件
├── backend/                # Go 后端服务，DICOM 转 JPEG
│   ├── main.go             # 主程序（含 Redis + WebSocket）
│   └── go.mod
├── docker-compose.yml      # Redis 容器配置
├── build-wasm.ps1          # Windows WASM 构建脚本
└── build-wasm.sh           # Linux/Mac WASM 构建脚本
```

## 功能特性

### 核心功能
1. **批量文件上传**：支持拖拽上传多个 DICOM 文件
2. **前端 WASM 脱敏**：使用 Rust 编译为 WebAssembly，在浏览器端解析 DICOM 文件
3. **隐私保护**：对 PatientName 和 PatientID 进行正则脱敏（替换为 *）
4. **Redis 消息队列**：异步任务队列，支持高并发请求
5. **WebSocket 实时推送**：后端实时推送每个文件的处理进度
6. **格式转换**：后端 Go 服务将 DICOM 转换为标准 JPEG
7. **图片预览**：转换完成后返回图片 URL 供前端预览

### 性能优化
1. **Web Worker 后台处理**：大文件（>50MB）使用 Web Worker 处理，避免主线程阻塞
2. **分块读取**：大文件采用 10MB 分块读取，降低内存峰值
3. **内存管理**：WASM 端主动释放内存，避免内存溢出
4. **多 Worker 并行处理**：后端启动与 CPU 核数相等的 Worker 从 Redis 队列消费任务
5. **文件锁机制**：基于文件名的互斥锁，避免并发写入冲突
6. **原子文件操作**：先写入临时文件，再原子重命名，避免部分写入

### 批量处理特性
1. **队列管理界面**：可视化展示所有文件的处理状态
2. **实时统计**：等待中 / 处理中 / 已完成 / 失败 数量统计
3. **状态流转**：等待中 → 脱敏中 → 已脱敏 → 上传中 → 队列中 → 转换中 → 已完成
4. **单个文件进度条**：每个文件独立显示进度百分比和当前阶段
5. **批量操作**：一键开始批量处理、一键清空队列
6. **预览功能**：完成的文件可点击预览大图

## 环境要求

- Rust 工具链（1.60+）
- wasm-pack
- Go 1.21+
- Redis 6.0+（或使用 Docker）
- 现代浏览器（支持 ES6 Modules、WebAssembly、Web Worker、WebSocket）

## 快速开始

### 1. 启动 Redis（使用 Docker）

```bash
docker-compose up -d
```

或使用本地 Redis：确保 Redis 运行在 `localhost:6379`

### 2. 构建 WASM 模块

**Windows:**
```powershell
.\build-wasm.ps1
```

**Linux/Mac:**
```bash
chmod +x build-wasm.sh
./build-wasm.sh
```

### 3. 启动后端服务

```bash
cd backend
go mod tidy
go run main.go
```

后端服务将在 `http://localhost:8080` 启动

### 4. 启动前端

由于浏览器安全限制，需要通过 HTTP 服务器访问前端：

```bash
cd frontend
python -m http.server 8000
```

然后访问 `http://localhost:8000`

## 使用流程

1. **上传文件**：点击或拖拽多个 .dcm 文件到上传区域
2. **查看队列**：所有文件加入队列，显示文件名和大小
3. **开始处理**：点击「开始批量处理」按钮
4. **实时监控**：
   - 每个文件显示独立的进度条
   - 顶部显示各状态数量统计
   - WebSocket 实时接收后端进度推送
5. **预览结果**：处理完成后点击预览图标查看转换后的 JPEG

## 处理状态说明

| 状态 | 说明 |
|------|------|
| 等待中 | 文件已加入队列，等待开始处理 |
| 脱敏处理中 | Web Worker 正在进行 WASM 脱敏 |
| 已脱敏，等待上传 | 前端脱敏完成，准备上传到后端 |
| 上传中 | 文件正在上传到后端服务器 |
| 队列中 | 文件已加入 Redis 队列，等待 Worker 消费 |
| 转换中 | 后端 Worker 正在进行 DICOM 转 JPEG |
| 已完成 | 处理成功，可以预览 |
| 失败 | 处理过程中出现错误 |

## API 接口

### WebSocket 连接

**URL:** `ws://localhost:8080/ws`

**消息类型：**

1. **connected** - 连接成功
```json
{
  "type": "connected"
}
```

2. **progress** - 处理进度
```json
{
  "type": "progress",
  "fileId": "xxx",
  "percent": 50,
  "stage": "解析 DICOM"
}
```

3. **completed** - 处理完成
```json
{
  "type": "completed",
  "fileId": "xxx",
  "url": "/images/xxx.jpg"
}
```

4. **error** - 处理失败
```json
{
  "type": "error",
  "fileId": "xxx",
  "message": "错误信息"
}
```

### HTTP 接口

#### POST /upload/batch

批量上传脱敏后的 DICOM 文件到队列

**请求：**
- Content-Type: multipart/form-data
- Fields:
  - `file`: DICOM 文件
  - `clientId`: WebSocket 客户端 ID
  - `frontendFileId`: 前端文件 ID

**响应：**
```json
{
  "success": true,
  "fileId": "xxx",
  "queueSize": 5
}
```

#### POST /upload

单文件同步转换（兼容旧版）

**请求：**
- Content-Type: multipart/form-data
- Body: file field with DICOM file

**响应：**
```json
{
  "success": true,
  "url": "/images/{unique_id}.jpg"
}
```

#### GET /images/{filename}

访问转换后的 JPEG 图片

## 技术栈

**前端 WASM (Rust):**
- `dicom-object` - DICOM 文件解析库
- `wasm-bindgen` - WASM 与 JS 交互
- `regex` - 正则表达式脱敏
- `serde` - 序列化支持
- `console_error_panic_hook` - 错误调试

**前端 JavaScript:**
- Web Worker API - 后台线程处理
- FileReader API - 分块文件读取
- WebSocket API - 实时通信
- Transferable Objects - 零拷贝数据传输

**后端 (Go):**
- `gin-gonic/gin` - Web 框架
- `suyashkumar/dicom` - Go DICOM 解析库
- `gorilla/websocket` - WebSocket 支持
- `redis/go-redis/v9` - Redis 客户端
- `google/uuid` - 唯一 ID 生成

**消息队列:**
- Redis List - 任务队列存储
- BLPOP - 阻塞式任务消费
- 多 Worker 并行处理

## 后端架构说明

### 组件结构

```
┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐
│   /upload/batch │────▶│  Redis Queue    │────▶│  Worker #1    │
└─────────────────┘     └─────────────────┘     └───────────────┘
                                                         │
┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐
│  WebSocket Hub  │◀────│  Progress Chan  │◀────│  Worker #2    │
└─────────────────┘     └─────────────────┘     └───────────────┘
         │
         ▼
┌─────────────────┐
│   Browser #1    │
└─────────────────┘
```

### 核心组件

1. **Hub** ([backend/main.go](file:///e:/soloJ/j51/backend/main.go#L82-L121))
   - 管理所有 WebSocket 客户端连接
   - 负责消息的广播和定向发送
   - 处理客户端注册和注销

2. **Task Worker** ([backend/main.go](file:///e:/soloJ/j51/backend/main.go#L176-L198))
   - 启动时创建 N 个（CPU 核数）Worker 协程
   - 使用 BLPOP 阻塞等待 Redis 队列任务
   - 处理任务并通过 WebSocket 推送进度

3. **WebSocket Handler** ([backend/main.go](file:///e:/soloJ/j51/backend/main.go#L324-L364))
   - 处理 WebSocket 升级请求
   - 为每个客户端创建独立的消息通道
   - 启动读和写两个协程

## 目录说明

- `wasm/src/lib.rs` - WASM 核心逻辑，DICOM 解析和脱敏
- `frontend/index.html` - 前端主页面，批量队列管理
- `frontend/dicom-worker.js` - Web Worker 脚本，大文件后台处理
- `backend/main.go` - 后端服务主程序，Redis 队列 + WebSocket
- `docker-compose.yml` - Redis Docker 配置

## 启动服务命令总结

```bash
# 1. 启动 Redis
docker-compose up -d

# 2. 构建 WASM
.\build-wasm.ps1

# 3. 启动后端
cd backend
go mod tidy
go run main.go

# 4. 启动前端
cd frontend
python -m http.server 8000

# 访问: http://localhost:8000
```

## 监控和调试

### Redis 队列监控

```bash
# 查看队列长度
redis-cli LLEN dicom:queue

# 查看队列内容
redis-cli LRANGE dicom:queue 0 -1

# 清空队列
redis-cli DEL dicom:queue
```

### 后端日志

后端会输出 Worker 处理日志：
```
Worker 0: Processing file1.dcm
Worker 1: Processing file2.dcm
Worker 0: Completed file1.dcm
```

### 浏览器控制台

- WebSocket 连接状态
- WASM Worker 初始化状态
- 错误信息和警告
