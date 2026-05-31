# 音频指纹识别系统

基于 WebAssembly 的浏览器端实时音频指纹识别系统。采用 React + TypeScript 前端，C++ WASM 核心音频处理算法，Go + RocksDB 后端存储与匹配服务。

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        浏览器 (React + TS)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ 录音组件      │  │ 上传组件      │  │ 指纹可视化组件        │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘ │
│         │                 │                      │              │
│         ▼                 ▼                      │              │
│  ┌─────────────────────────────────────────────┐ │              │
│  │        WASM 模块 (C++ 编译)                  │ │              │
│  │  ┌───────────┐ ┌───────────┐ ┌────────────┐ │ │              │
│  │  │ FFT 变换   │ │ 峰值提取    │ │ 指纹生成    │ │ │              │
│  │  └───────────┘ └───────────┘ └────────────┘ │ │              │
│  └──────────────────────────┬──────────────────┘ │              │
│                             │                    │              │
│                             ▼                    │              │
│                     HTTP / REST API              │              │
└─────────────────────────────┬────────────────────┴──────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     Go 后端服务                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ CORS 中间件   │  │ 指纹匹配引擎  │  │ RocksDB 存储层        │ │
│  └──────────────┘  └──────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 项目结构

```
j11/
├── wasm/                          # C++ WASM 音频处理模块
│   ├── src/
│   │   ├── fft.h/cpp             # FFT 变换算法
│   │   ├── fingerprint.h/cpp     # 音频指纹提取与生成
│   │   └── main.cpp              # Emscripten 绑定入口
│   ├── CMakeLists.txt             # CMake 构建配置
│   └── build.ps1                 # WASM 构建脚本
│
├── frontend/                      # React + TypeScript 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioUploader.tsx    # 音频文件上传组件
│   │   │   ├── AudioRecorder.tsx    # 实时录音识别组件
│   │   │   ├── AudioLibrary.tsx     # 指纹库管理组件
│   │   │   └── FingerprintVisualizer.tsx  # 指纹可视化组件
│   │   ├── hooks/
│   │   │   ├── useAudioRecorder.ts    # 录音 Hook
│   │   │   └── useFingerprint.ts      # 指纹处理 Hook
│   │   ├── services/
│   │   │   ├── api.ts               # 后端 API 服务
│   │   │   └── audio.ts             # 音频处理工具
│   │   ├── wasm/
│   │   │   ├── fingerprint_wasm.ts    # WASM 桥接层
│   │   │   ├── fingerprint_wasm.d.ts  # WASM 类型声明
│   │   │   └── (audio_fingerprint.js/.wasm)  # 编译产物
│   │   ├── App.tsx                  # 主应用组件
│   │   └── main.tsx                 # 应用入口
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── index.html
│
├── backend/                       # Go 后端服务
│   ├── cmd/server/
│   │   └── main.go                # 服务入口
│   ├── internal/
│   │   ├── db/
│   │   │   └── store.go           # RocksDB 存储层
│   │   ├── fingerprint/
│   │   │   └── matcher.go         # 指纹匹配算法
│   │   └── handler/
│   │       └── handler.go         # HTTP 请求处理器
│   └── go.mod
│
└── Makefile                       # 构建脚本
```

## 核心算法说明

### 音频指纹算法 (Shazam 风格)

1. **STFT 频谱图生成**：对音频信号进行加窗短时傅里叶变换，生成时频图
2. **峰值提取**：在频谱图中寻找局部极大值点（峰值），通过滑动窗口抑制非极大值
3. **指纹哈希生成**：对峰值进行配对，生成哈希值：
   - 选取锚点峰值和目标峰值（fan_out 参数控制配对数量）
   - 哈希函数：`hash(f1, f2, dt)` = `f1 * 1000003² + f2 * 1000003 + dt`
   - 其中 `f1`、`f2` 为频率bin，`dt` 为时间偏移

### 匹配算法

1. **哈希查找**：查询指纹中的每个哈希值在数据库中的所有匹配
2. **时间一致性验证**：计算匹配对的时间偏移差，统计同一偏移差的出现频率
3. **聚类评分**：对偏移差进行聚类，聚类大小决定匹配分数
4. **排序返回**：按匹配分数降序返回结果

### RocksDB 数据模型

- **Column Family `fingerprints`**：存储所有指纹条目
  - Key: `hash(4字节) + audioID + offset(4字节)`
  - Value: `{audio_id, offset}` JSON

- **Column Family `audio_meta`**：存储音频元数据
  - Key: `audioID`
  - Value: `{audio_id, fingerprint_count, duration, metadata}` JSON

## 构建与运行

### 前置条件

- **Emscripten SDK** (用于编译 C++ 到 WASM)
- **Node.js 18+** (用于前端开发)
- **Go 1.21+** (用于后端服务)
- **RocksDB** (系统库，用于 Go 后端的 CGO 绑定)
- **CMake 3.16+** (用于 WASM 构建)

### WASM 构建

```bash
# 安装并激活 Emscripten
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest

# 构建 WASM
cd wasm
powershell -File build.ps1
```

### 前端开发

```bash
cd frontend
npm install
npm run dev    # 开发服务器 http://localhost:3000
```

### 后端运行

```bash
cd backend
go mod download
go run ./cmd/server -addr :8080 -db ./data/rocksdb
```

### 一键构建

```bash
# 构建 WASM + 后端
make all

# 运行后端
make run-backend

# 运行前端
make run-frontend
```

## API 接口

### `GET /api/health`

健康检查，返回数据库状态和统计信息。

**响应：**
```json
{
    "status": "ok",
    "fingerprint_count": 15234,
    "audio_count": 42
}
```

### `POST /api/fingerprints`

存储音频指纹到数据库。

**请求：**
```json
{
    "audio_id": "song_001",
    "fingerprints": [
        {"hash": 123456789, "offset": 0},
        {"hash": 987654321, "offset": 5}
    ],
    "duration": 180.5,
    "metadata": {"artist": "Unknown", "title": "Test Song"}
}
```

**响应：**
```json
{
    "success": true,
    "audio_id": "song_001",
    "fingerprint_count": 15234
}
```

### `POST /api/match`

匹配查询指纹与数据库中的指纹。

**请求：**
```json
{
    "fingerprints": [
        {"hash": 123456789, "offset": 0},
        {"hash": 987654321, "offset": 5}
    ]
}
```

**响应：**
```json
[
    {
        "audio_id": "song_001",
        "score": 0.85,
        "matched_hashes": 127,
        "total_hashes": 150,
        "metadata": {"artist": "Unknown", "title": "Test Song"}
    }
]
```

### `GET /api/audio`

获取所有已存储音频列表。

**响应：**
```json
[
    {"audio_id": "song_001", "fingerprint_count": 15234, "duration": 180.5}
]
```

### `DELETE /api/audio/{audio_id}`

删除指定音频及其所有指纹数据。

**响应：**
```json
{"success": true}
```

## CORS 配置

后端已配置 CORS 中间件，允许所有来源的跨域请求：
- `Access-Control-Allow-Origin: *`
- 允许方法：`GET, POST, PUT, DELETE, OPTIONS`
- 允许头部：`Content-Type, Authorization`

前端开发服务器 `vite.config.ts` 中已配置代理，将 `/api` 请求转发到后端 `http://localhost:8080`。

## 配置参数

### 音频处理参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| sample_rate | 44100 Hz | 采样率 |
| frame_size | 4096 | FFT 窗口大小 |
| hop_size | 1024 | 帧移大小 |
| peak_window | 15 | 峰值检测窗口半径 |
| peak_threshold | 0.0 | 峰值幅度阈值 |
| fan_out | 5 | 每个锚点峰值的配对数 |
| min_delta_t | 5 | 最小时间偏移（帧） |
| max_delta_t | 200 | 最大时间偏移（帧） |

### 后端参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| addr | :8080 | HTTP 服务地址 |
| db | ./data/rocksdb | RocksDB 数据目录 |

## 浏览器兼容性

- Chrome 63+
- Firefox 57+
- Safari 11+
- Edge 79+

需要支持 WebAssembly、Web Audio API、MediaDevices API。

## License

MIT
