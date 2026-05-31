# 机器人控制系统 (Robot Control System)

一个基于WebRTC的实时机器人控制系统，支持低延迟视频传输、移动控制、机械臂操作和多机器人管理。

## 系统架构

```
┌─────────────────┐     WebRTC     ┌─────────────────┐
│   Web控制端     │◄──────────────►│   机器人端      │
│  (浏览器)       │                │  (Python)       │
└────────┬────────┘                └────────┬────────┘
         │                                   │
         │ Socket.io 信令                    │ Socket.io
         ▼                                   ▼
┌─────────────────────────────────────────────────────┐
│                  后端服务                           │
│  (Express + Socket.io + JWT + InfluxDB)            │
└─────────────────────────────────────────────────────┘
```

## 功能特性

### 视频传输
- **WebRTC实时视频流**：延迟 < 200ms
- **OpenCV视频采集**：支持USB摄像头
- **640x480 @ 30fps**：可配置分辨率和帧率

### 控制功能
- **虚拟摇杆**：鼠标/触摸控制
- **键盘控制**：WASD / 方向键
- **移动指令**：线速度 + 角速度
- **机械臂控制**：3D坐标 + 夹爪控制

### 3D可视化
- **Three.js渲染**：实时姿态显示
- **机器人朝向**：Yaw角度可视化
- **机械臂关节**：6轴角度实时更新

### 后端服务
- **Socket.io信令**：WebRTC协商
- **JWT用户鉴权**：安全认证
- **多机器人支持**：同时在线管理
- **管理员权限**：可抢占控制权
- **InfluxDB日志**：时序数据存储

## 快速开始

### 1. 环境要求

- **Node.js** >= 16.0
- **Python** >= 3.8
- **InfluxDB** >= 2.0 (可选，用于日志)

### 2. 安装后端服务

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 启动服务
npm start
```

### 3. 配置机器人端

```bash
# 安装Python依赖
pip install -r requirements.txt

# 配置环境变量
cd robot
cp .env.example .env
# 编辑 robot/.env 文件

# 启动机器人客户端
python robot_client.py
```

### 4. 访问控制界面

打开浏览器访问: `http://localhost:3000`

默认管理员账号:
- 用户名: `admin`
- 密码: `admin123`

## 项目结构

```
├── server/
│   └── index.js              # 后端服务主文件
├── public/
│   ├── index.html            # 控制界面HTML
│   ├── style.css             # 样式文件
│   └── app.js                # 前端逻辑
├── robot/
│   ├── robot_client.py       # 机器人端Python程序
│   └── .env.example          # 机器人端配置示例
├── package.json              # Node.js依赖
├── requirements.txt          # Python依赖
├── .env.example              # 后端配置示例
└── README.md
```

## 配置说明

### 后端配置 (.env)

| 变量 | 说明 | 默认值 |
|------|------|--------|
| PORT | 服务端口 | 3000 |
| JWT_SECRET | JWT密钥 | - |
| INFLUXDB_URL | InfluxDB地址 | http://localhost:8086 |
| INFLUXDB_TOKEN | InfluxDB令牌 | - |
| INFLUXDB_ORG | InfluxDB组织 | robot-org |
| INFLUXDB_BUCKET | InfluxDB存储桶 | robot-logs |
| ADMIN_USERNAME | 管理员用户名 | admin |
| ADMIN_PASSWORD | 管理员密码 | admin123 |

### 机器人端配置 (robot/.env)

| 变量 | 说明 | 默认值 |
|------|------|--------|
| ROBOT_ID | 机器人唯一ID | robot_001 |
| ROBOT_NAME | 机器人显示名称 | Robot-1 |
| SERVER_URL | 后端服务地址 | http://localhost:3000 |

## API接口

### 登录
```
POST /api/login
Body: { username: "admin", password: "admin123" }
Response: { token: "...", username: "admin", role: "admin" }
```

### 获取机器人列表
```
GET /api/robots
Response: [{ id, name, status, controller }]
```

### 获取指令日志
```
GET /api/logs/:robotId
Response: [InfluxDB records]
```

## Socket.io事件

### 用户端事件

| 事件 | 方向 | 数据 |
|------|------|------|
| request_control | 发送 | { robotId } |
| release_control | 发送 | { robotId } |
| velocity_command | 发送 | { robotId, linear, angular } |
| arm_command | 发送 | { robotId, position: {x,y,z}, gripper } |
| webrtc_offer | 发送 | { robotId, offer } |
| webrtc_answer | 发送 | { robotId, answer } |
| webrtc_ice_candidate | 发送 | { robotId, candidate } |
| robot_list_update | 接收 | [robots] |
| robot_pose | 接收 | { robotId, pose, armAngles } |
| control_response | 接收 | { success, robotId, error } |

### 机器人端事件

| 事件 | 方向 | 数据 |
|------|------|------|
| robot_register | 发送 | { robotId, name, pose, armAngles } |
| robot_pose_update | 发送 | { pose, armAngles } |
| webrtc_offer | 发送 | { robotId, offer } |
| webrtc_answer | 发送 | { answer, controllerSocketId } |
| webrtc_ice_candidate | 发送 | { candidate, toController } |
| controller_connected | 接收 | { controllerSocketId, userId } |
| controller_disconnected | 接收 | - |
| velocity_command | 接收 | { linear, angular } |
| arm_command | 接收 | { position, gripper } |
| webrtc_offer | 接收 | { offer, controllerSocketId } |

## 性能优化

### WebRTC低延迟
- 使用硬件编码/解码
- 调整视频分辨率和帧率
- 启用NACK/PLI丢包重传
- 优化jitter buffer大小

### 网络优化
- 优先使用WebSocket传输
- 本地网络优先P2P直连
- STUN服务器协助NAT穿透
- TURN服务器作为后备方案

## 多机器人控制

1. **机器人注册**：每个机器人启动后自动注册
2. **列表显示**：控制端显示所有在线机器人
3. **请求控制**：用户选择机器人并请求控制权
4. **权限管理**：
   - 普通用户：只能控制空闲机器人
   - 管理员：可抢占任意机器人控制权
5. **控制权释放**：断开连接自动释放

## 安全考虑

1. **JWT认证**：所有WebSocket连接需要令牌
2. **控制隔离**：仅授权用户可发送控制指令
3. **日志审计**：所有指令记录到InfluxDB
4. **HTTPS**：生产环境必须使用加密连接

## 故障排查

### 视频无法连接
1. 检查摄像头是否被占用
2. 确认防火墙允许UDP流量
3. 查看浏览器控制台错误信息
4. 尝试使用不同的STUN服务器

### 机器人无法连接
1. 确认后端服务已启动
2. 检查SERVER_URL配置
3. 查看机器人端日志输出
4. 确认网络连通性

### 延迟过高
1. 检查网络带宽
2. 降低视频分辨率/帧率
3. 优先使用有线连接
4. 确保P2P直连成功

## 开发计划

- [ ] 添加TURN服务器支持
- [ ] 实现机器人地图导航
- [ ] 添加语音控制功能
- [ ] 支持视频录制和回放
- [ ] 实现多人协同控制
- [ ] 添加ROS2集成
- [ ] 支持更多机械臂型号
- [ ] 添加移动端APP

## 许可证

MIT License
