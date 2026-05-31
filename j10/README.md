# gRPC 视频流人脸检测服务

基于 gRPC 流式传输的实时视频人脸检测、年龄估计和性别识别服务。

## 功能特性

- **流式视频处理**: 使用 gRPC 双向流进行视频帧传输
- **人脸检测**: 使用 MTCNN 进行高精度人脸检测
- **属性估计**: 支持年龄和性别识别
- **智能丢帧**: 客户端自动丢帧机制，发送最新帧避免积压
- **批量处理**: 每 5 帧处理一次，降低计算负载
- **可观测性**: Prometheus 指标暴露 (QPS, 延迟, 活跃连接数)
- **GPU 显存保护**: 推理队列 + 工作线程池，限制并发推理数量
- **连接状态感知**: 客户端断开时立即终止处理，清理积压帧
- **推理超时**: 防止请求长时间阻塞推理引擎
- **联邦学习**: 支持边缘节点分布式训练 + 中心服务器 FedAvg 聚合

## 项目结构

```
j10/
├── main.py                 # 统一入口脚本
├── requirements.txt        # Python 依赖
├── proto/                  # Protobuf 定义和生成的代码
│   ├── video_service.proto
│   ├── video_service_pb2.py
│   └── video_service_pb2_grpc.py
├── server/                 # 视频处理服务端代码
│   ├── video_server.py     # gRPC 服务主程序
│   ├── download_models.py  # 模型下载脚本
│   └── models/             # 预训练模型目录
├── client/                 # 视频处理客户端代码
│   ├── video_client.py     # 实时视频客户端
│   └── test_client.py      # 测试客户端 (无需摄像头)
└── federated/              # 联邦学习模块
    ├── federated.proto     # FL gRPC 协议定义
    ├── model.py            # Tiny 3 层 CNN 模型定义
    ├── fl_server.py        # FL 中心服务器 (FedAvg)
    ├── fl_client.py        # FL 边缘客户端
    └── simulation.py       # FL 仿真脚本
```

## 安装

```bash
pip install -r requirements.txt
```

## 下载模型

服务端使用 Caffe 模型进行年龄和性别估计：

```bash
python main.py download
```

如果模型下载失败，服务端会使用模拟估计模式。

## 使用方法

### 启动服务端

```bash
# 默认端口 50051, 指标端口 8000
python main.py server

# 自定义端口
python main.py server --port 50051 --metrics-port 8000 --max-workers 4
```

### 启动客户端

```bash
# 使用摄像头 0
python main.py client --server localhost:50051 --camera 0

# 使用视频文件
python main.py client --server localhost:50051 --video path/to/video.mp4

# 调整丢帧队列大小
python main.py client --server localhost:50051 --max-pending 3

# 无显示模式
python main.py client --server localhost:50051 --no-display
```

### 测试模式 (无需摄像头)

```bash
python main.py test --frames 20 --interval 0.1
```

## 联邦学习

### 一键仿真 (3 个边缘节点 + 1 个中心服务器)

```bash
python main.py fl-sim --num-clients 3 --num-rounds 3
```

这会自动启动：
- 1 个联邦学习中心服务器 (端口 50052)
- 3 个边缘节点客户端
- 完成 3 轮完整的联邦学习通信

### 手动启动

#### 1. 启动中心服务器

```bash
python main.py fl-server \
  --port 50052 \
  --metrics-port 8001 \
  --num-clients 3 \
  --max-rounds 5
```

#### 2. 启动边缘节点 (多个终端)

```bash
# 终端 1: 边缘节点 1
python main.py fl-client \
  --client-id edge-node-01 \
  --server localhost:50052 \
  --local-epochs 3 \
  --num-rounds 5

# 终端 2: 边缘节点 2
python main.py fl-client \
  --client-id edge-node-02 \
  --server localhost:50052 \
  --local-epochs 3 \
  --num-rounds 5

# 终端 3: 边缘节点 3
python main.py fl-client \
  --client-id edge-node-03 \
  --server localhost:50052 \
  --local-epochs 3 \
  --num-rounds 5
```

### Tiny 3 层 CNN 模型架构

```
输入 (3x64x64)
   ↓
Conv2d(3→16, 3x3, stride=2) + BN + ReLU + MaxPool
   ↓
Conv2d(16→32, 3x3, stride=2) + BN + ReLU + MaxPool
   ↓
Conv2d(32→64, 3x3, stride=2) + BN + ReLU
   ↓
Flatten (64×8×8 = 4096)
   ↓
Linear(4096→128) + Dropout + ReLU
   ↓
┌─────────────────────┬─────────────────────┐
│  Gender Head        │  Age Head           │
│ Linear(128→2)       │ Linear(128→8)       │
└─────────────────────┴─────────────────────┘
```

### 联邦学习流程

1. **初始化**: 中心服务器创建全局模型
2. **下载权重**: 各边缘节点下载最新全局模型
3. **本地训练**: 各节点使用本地视频数据训练
4. **上传权重**: 各节点将训练后的模型权重上传到中心
5. **FedAvg 聚合**: 中心服务器按样本数加权平均
6. **分发新模型**: 将聚合后的新模型分发回各节点
7. **重复**: 回到步骤 2，直到完成指定轮数

### FL Prometheus 指标

指标暴露在 `http://localhost:8001`

| 指标名 | 类型 | 描述 |
|--------|------|------|
| `fl_round_duration_seconds` | Histogram | 每轮联邦学习耗时 |
| `fl_clients_per_round` | Gauge | 每轮参与的客户端数 |
| `fl_uploaded_weights_total` | Counter | 权重上传总数 |
| `fl_global_model_version` | Gauge | 全局模型当前版本 |
| `fl_average_train_loss` | Gauge | 跨客户端平均训练损失 |
| `fl_average_train_accuracy` | Gauge | 跨客户端平均训练准确率 |

## 流控机制

### 客户端丢帧

客户端使用有界队列 (`max_pending`) 缓存待发送帧：
- 当队列满时，丢弃最旧的帧
- 始终发送最新的帧
- 避免服务端处理延迟导致的帧积压

### 服务端批量处理

- 每收到 5 帧进行一次人脸检测处理
- 减少计算开销
- 保持实时性

## Prometheus 指标

指标暴露在 `http://localhost:8000`

| 指标名 | 类型 | 描述 |
|--------|------|------|
| `video_service_requests_total` | Counter | 处理的请求总数 |
| `video_service_request_duration_seconds` | Histogram | 批量处理延迟 |
| `video_service_frame_process_duration_seconds` | Histogram | 单帧处理延迟 |
| `video_service_faces_detected` | Gauge | 最后一批检测到的人脸数量 |
| `video_service_active_streams` | Gauge | 当前活跃流数量 |
| `video_service_frame_backlog` | Gauge | 帧积压数量 |
| `video_service_dropped_frames_total` | Counter | 丢弃的帧总数 |

查看指标:
```bash
curl http://localhost:8000/metrics
```

## Proto 定义

```protobuf
service VideoService {
  rpc ProcessVideo(stream FrameRequest) returns (stream FrameResponse);
}
```

## 性能优化建议

1. **GPU 加速**: MTCNN 可以使用 GPU 加速，安装 `mtcnn[gpu]`
2. **模型量化**: 对年龄/性别模型进行量化以加速推理
3. **批量大小**: 根据服务器性能调整 `FRAMES_SKIP` 参数
4. **线程数**: 调整 `--max-workers` 以适应并发连接

## 故障排查

### 连接失败
```
[ERROR] gRPC error: StatusCode.UNAVAILABLE
```
确保服务端已启动且端口正确。

### 模型加载失败
```
[WARN] Age/Gender models not found, using mock estimation
```
运行 `python main.py download` 下载模型，或手动放置模型文件到 `server/models/` 目录。

### 帧率低
- 减少分辨率
- 增加 `FRAMES_SKIP` 值
- 使用 GPU 加速