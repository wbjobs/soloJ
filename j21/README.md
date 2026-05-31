# 多人实时音视频审片系统

支持多人实时同步观看视频并添加批注的审片系统。

## 功能特性

- 🎬 **视频上传**: 主持人上传MP4视频，自动创建房间
- 🔗 **房间管理**: 生成唯一房间ID，参与者通过ID加入
- 🔄 **实时同步**: 播放/暂停/跳转操作实时同步给所有成员
- 📝 **视频批注**: 在视频画面上框选区域添加文字批注
- 📋 **批注列表**: 查看所有批注，点击跳转到对应时间点
- 👥 **用户管理**: 显示房间内所有在线用户

## 技术栈

- **后端**: Node.js + Express + Socket.io
- **前端**: React + Video.js
- **数据库**: PostgreSQL
- **对象存储**: MinIO

## 快速开始

### 1. 启动基础服务

使用Docker启动PostgreSQL和MinIO：

```bash
docker-compose up -d
```

服务启动后：
- PostgreSQL: localhost:5432
- MinIO控制台: http://localhost:9001 (账号: minioadmin / minioadmin123)

### 2. 启动后端服务

```bash
cd server
npm install
npm run dev
```

后端服务运行在 http://localhost:3001

### 3. 启动前端服务

```bash
cd client
npm install
npm run dev
```

前端服务运行在 http://localhost:5173

## 使用说明

### 创建房间（主持人）

1. 访问 http://localhost:5173
2. 点击或拖拽上传MP4视频文件
3. 系统自动创建房间并生成6位房间ID
4. 将房间ID分享给其他参与者

### 加入房间（参与者）

1. 访问 http://localhost:5173
2. 在"加入房间"区域输入房间ID
3. 点击"加入房间"按钮

### 添加批注

1. 在视频播放过程中，在视频画面上拖拽鼠标框选区域
2. 在右侧输入批注文字
3. 点击"提交"按钮
4. 批注会实时同步给所有房间成员

### 同步控制

- 任何用户的播放/暂停/跳转操作都会同步给其他用户
- 点击批注列表中的批注可跳转到对应时间点

## 项目结构

```
├── docker-compose.yml      # Docker服务配置
├── server/                 # 后端服务
│   ├── src/
│   │   ├── config/         # 配置文件
│   │   ├── models/         # 数据模型
│   │   ├── routes/         # API路由
│   │   ├── services/       # 业务服务
│   │   ├── sockets/        # Socket.io逻辑
│   │   ├── app.js          # Express应用
│   │   └── server.js       # 服务入口
│   ├── package.json
│   └── .env
└── client/                 # 前端应用
    ├── src/
    │   ├── components/     # React组件
    │   ├── pages/          # 页面组件
    │   ├── services/       # API和Socket服务
    │   ├── App.jsx
    │   └── main.jsx
    ├── package.json
    └── vite.config.js
```

## API接口

### 上传视频并创建房间
```
POST /api/video/upload
Content-Type: multipart/form-data
Body: { video: [MP4文件] }
Response: { roomId, hostId, videoId, videoName }
```

### 获取房间信息
```
GET /api/video/room/:roomId
Response: { roomId, video: { id, name, url, duration }, annotations: [...] }
```

### 导出批注报告
```
GET /api/video/room/:roomId/export
Response: { roomId, video: {...}, exportedAt, annotations: [...] }
```

## Socket.io事件

### 客户端发送
- `join-room`: 加入房间
- `play`: 播放视频
- `pause`: 暂停视频
- `seek`: 跳转进度
- `add-annotation`: 添加批注
- `delete-annotation`: 删除批注
- `add-reply`: 添加批注回复
- `delete-reply`: 删除批注回复
- `toggle-annotation-visibility`: 切换批注显示/隐藏

### 服务端广播
- `play`: 同步播放
- `pause`: 同步暂停
- `seek`: 同步跳转
- `annotation-added`: 新批注
- `annotation-deleted`: 删除批注
- `reply-added`: 新回复
- `reply-deleted`: 删除回复
- `annotation-visibility-changed`: 批注可见性变更
- `user-joined`: 用户加入
- `user-left`: 用户离开
