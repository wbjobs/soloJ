# Modbus TCP 工业数据监控系统

基于 Node.js (NestJS)、Python (FastAPI) 和 Vue3 构建的 Modbus TCP 协议网关与工业数据监控平台。

## 系统架构

```
┌─────────────────────────┐     gRPC     ┌─────────────────────────┐    REST    ┌──────────────┐
│  Modbus TCP Gateway     │ ───────────► │  Data Monitor Backend   │ ──────────► │  Vue3 Frontend │
│  (NestJS + modbus-serial)│              │  (FastAPI + InfluxDB)   │            │  (Dashboard)  │
│                         │              │                         │            │               │
│  • 连接/模拟 PLC 设备    │              │  • gRPC 服务端          │            │  • 实时监控    │
│  • 定时轮询寄存器        │              │  • 数据写入 InfluxDB    │            │  • 历史分析    │
│  • gRPC 数据流推送       │              │  • REST API 接口        │            │  • 设备管理    │
└─────────────────────────┘              └─────────────────────────┘            └──────────────┘
```

## 技术栈

### 1. Modbus TCP 网关 (Node.js / NestJS)
- **框架**: NestJS 10.x
- **Modbus 协议**: modbus-serial 8.x
- **通信协议**: gRPC (@grpc/grpc-js)
- **调度**: @nestjs/schedule

### 2. 数据监控后端 (Python / FastAPI)
- **框架**: FastAPI 0.109.x
- **gRPC**: grpcio, grpcio-tools
- **时序数据库**: InfluxDB 2.x (influxdb-client)
- **数据验证**: Pydantic 2.x

### 3. 前端 (Vue3)
- **框架**: Vue 3.4.x
- **路由**: Vue Router 4.x
- **UI 组件**: Element Plus 2.x
- **图表**: ECharts 5.x + vue-echarts
- **HTTP 客户端**: Axios
- **构建工具**: Vite 5.x

## 项目结构

```
j52/
├── proto/                          # gRPC 协议定义
│   └── modbus.proto               # Modbus 数据通信协议
├── modbus-gateway/                 # Node.js Modbus TCP 网关
│   ├── src/
│   │   ├── main.ts                # 应用入口
│   │   ├── app.module.ts          # 根模块
│   │   ├── modbus/
│   │   │   └── modbus.service.ts  # Modbus TCP 服务
│   │   ├── grpc/
│   │   │   └── grpc-client.service.ts  # gRPC 客户端
│   │   └── polling/
│   │       └── polling.service.ts # 数据轮询调度
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── data-monitor/                   # Python 数据监控后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py              # 配置管理
│   │   ├── main.py                # FastAPI 应用
│   │   ├── grpc_server.py         # gRPC 服务端
│   │   └── influxdb_service.py    # InfluxDB 服务
│   ├── grpc_gen/                  # 生成的 gRPC 代码
│   ├── main.py                    # 服务启动入口
│   ├── generate_grpc.py           # gRPC 代码生成脚本
│   ├── requirements.txt
│   └── .env
├── frontend/                       # Vue3 前端
│   ├── src/
│   │   ├── main.js
│   │   ├── App.vue
│   │   ├── style.css
│   │   ├── router/
│   │   │   └── index.js
│   │   ├── api/
│   │   │   └── api.js
│   │   └── views/
│   │       ├── Dashboard.vue      # 实时监控面板
│   │       ├── History.vue        # 历史数据分析
│   │       └── Devices.vue        # 设备管理
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml             # InfluxDB 一键部署
└── README.md
```

## 快速开始

### 前置要求

- Node.js >= 18.x
- Python >= 3.10
- Docker (用于运行 InfluxDB)

### 步骤 1: 启动 InfluxDB 时序数据库

```bash
# 在项目根目录启动 InfluxDB
docker-compose up -d
```

访问 InfluxDB Web UI: http://localhost:8086
- 用户名: `admin`
- 密码: `admin12345`
- 组织: `industrial-iot`
- 初始令牌: `influxdb-token-12345`

### 步骤 2: 启动 Python 数据监控后端

```bash
cd data-monitor

# 创建虚拟环境
python -m venv venv

# 激活虚拟环境 (Windows)
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 生成 gRPC 代码
python generate_grpc.py

# 启动服务
python main.py
```

服务启动后:
- REST API: http://localhost:8000
- API 文档: http://localhost:8000/docs
- gRPC 服务: localhost:50051

### 步骤 3: 启动 Node.js Modbus TCP 网关

```bash
cd modbus-gateway

# 安装依赖
npm install

# 启动服务 (开发模式)
npm run start:dev
```

网关将自动:
1. 尝试连接 Modbus TCP 设备 (默认 127.0.0.1:502)
2. 如果连接失败，自动切换到**模拟模式**，生成仿真 PLC 数据
3. 每秒轮询一次保持寄存器 (地址 0-9)
4. 通过 gRPC 流将数据推送到 Python 后端

### 步骤 4: 启动 Vue3 前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问前端: http://localhost:5173

## Modbus 寄存器映射

系统默认监控以下 10 个保持寄存器:

| 地址 | 名称 | 说明 | 模拟数据范围 |
|------|------|------|-------------|
| 0 | Temperature_Sensor_1 | 温度传感器 1 | 15-35 °C |
| 1 | Temperature_Sensor_2 | 温度传感器 2 | 15-35 °C |
| 2 | Pressure_Sensor_1 | 压力传感器 1 | 80-120 kPa |
| 3 | Pressure_Sensor_2 | 压力传感器 2 | 80-120 kPa |
| 4 | Flow_Rate | 流量 | 50-100 |
| 5 | Motor_Speed | 电机转速 | 1200-1800 RPM |
| 6 | Motor_Current | 电机电流 | 10-25 A |
| 7 | Valve_Position | 阀门位置 | 0-100 % |
| 8 | Energy_Consumption | 能耗 | 递增计数 |
| 9 | System_Status | 系统状态 | 1-3 |

## API 接口

### REST API (FastAPI)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/devices` | 获取设备列表 |
| GET | `/api/data/latest` | 获取最新数据 |
| GET | `/api/data/history/{register_name}` | 获取历史数据 |
| GET | `/api/registers` | 获取寄存器列表 |
| GET | `/api/stats` | 获取统计信息 |

### gRPC 服务

```protobuf
service ModbusDataService {
  rpc SendDataStream (stream ModbusData) returns (StreamResponse);
  rpc SendData (ModbusData) returns (StreamResponse);
}
```

## 功能特点

### 1. Modbus TCP 网关
- ✅ 支持真实 Modbus TCP 设备连接
- ✅ 内置 PLC 数据模拟器，无真实设备也可运行
- ✅ 可配置的轮询间隔和寄存器范围
- ✅ gRPC 流式数据传输，高效可靠
- ✅ 自动重连和错误处理

### 2. 数据监控后端
- ✅ 高性能 gRPC 服务端
- ✅ InfluxDB 时序数据库存储
- ✅ RESTful API 接口
- ✅ 自动数据聚合和查询优化
- ✅ CORS 跨域支持
- ✅ 完整的 API 文档 (Swagger UI)

### 3. 前端监控平台
- ✅ 实时数据看板，2秒自动刷新
- ✅ 多维度数据展示（卡片、图表、表格）
- ✅ 交互式历史数据分析
- ✅ 设备状态监控
- ✅ 响应式设计，支持移动端
- ✅ Element Plus 精美 UI

## 配置说明

### Modbus 网关配置 (`modbus-gateway/.env`)

```env
MODBUS_HOST=127.0.0.1          # Modbus TCP 设备地址
MODBUS_PORT=502                # Modbus 端口
MODBUS_SLAVE_ID=1              # 从站 ID

POLL_INTERVAL_MS=1000          # 轮询间隔 (毫秒)
REGISTER_START=0               # 起始寄存器地址
REGISTER_COUNT=10              # 寄存器数量

GRPC_SERVER_URL=localhost:50051  # gRPC 服务器地址

DEVICE_ID=plc-001              # 设备 ID
DEVICE_NAME=Industrial_PLC_Line_A  # 设备名称
```

### 后端配置 (`data-monitor/.env`)

```env
GRPC_HOST=0.0.0.0              # gRPC 监听地址
GRPC_PORT=50051                # gRPC 端口

API_HOST=0.0.0.0               # API 监听地址
API_PORT=8000                  # API 端口

INFLUXDB_URL=http://localhost:8086  # InfluxDB 地址
INFLUXDB_TOKEN=influxdb-token-12345  # 访问令牌
INFLUXDB_ORG=industrial-iot    # 组织名称
INFLUXDB_BUCKET=modbus-data    # 存储桶名称

CORS_ORIGINS=http://localhost:5173,http://localhost:3000  # 允许的源
```

## 故障排查

### 1. Modbus 连接失败
- 确认 PLC 设备已启动并可访问
- 检查 IP 地址和端口配置
- 防火墙是否允许 502 端口
- 如果没有真实设备，系统会自动使用模拟模式

### 2. InfluxDB 连接失败
- 确认 Docker 容器正在运行: `docker ps`
- 检查端口 8086 是否被占用
- 验证令牌和配置是否正确

### 3. gRPC 通信失败
- 确认 Python 后端已启动
- 检查端口 50051 是否被占用
- 查看后端日志确认 gRPC 服务正常

## 生产部署建议

1. **使用环境变量管理敏感信息**
2. **启用 HTTPS/TLS 加密**
   - 为 gRPC 配置 TLS 证书
   - 为 REST API 配置 HTTPS
3. **配置 InfluxDB 数据保留策略**
4. **添加认证和授权**
   - FastAPI 集成 OAuth2/JWT
   - 前端添加登录页面
5. **使用 Docker Compose 完整部署**
   - 将所有服务容器化
6. **配置监控和告警**
   - 添加服务健康检查
   - 配置异常数据告警

## 开发说明

### 扩展 Modbus 寄存器
修改 `modbus-gateway/src/modbus/modbus.service.ts` 中的 `registerNames` Map:

```typescript
private readonly registerNames: Map<number, string> = new Map([
  [0, 'Temperature_Sensor_1'],
  [1, 'Temperature_Sensor_2'],
  // 添加更多寄存器...
]);
```

### 添加新的前端页面
在 `frontend/src/views/` 目录创建新组件，然后在 `router/index.js` 中添加路由。

## License

MIT
