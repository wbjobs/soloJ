# 协同文本编辑器 (Collaborative Text Editor)

一个支持离线编辑的协同文本编辑器，使用 CRDT 算法实现实时多人协作。

## 技术栈

### 后端
- **Elixir + Phoenix Framework** - Web 服务器和 WebSocket 通道
- **PostgreSQL** - 持久化 Yjs 更新日志
- **Yjs CRDT 算法** - 实现无冲突的分布式数据同步

### 前端
- **SvelteKit** - 前端框架
- **CodeMirror 6** - 代码编辑器组件
- **Yjs** - 客户端 CRDT
- **y-websocket** - WebSocket 同步提供器
- **y-indexeddb** - 浏览器本地离线存储 (IndexedDB)

## 功能特性

- ✅ **实时协同编辑** - 多人同时编辑，毫秒级同步
- ✅ **离线编辑** - 断网时可继续编辑，本地更改自动保存
- ✅ **自动同步** - 网络恢复后自动与后端同步所有离线更改
- ✅ **冲突自动解决** - 使用 CRDT 算法，无需手动解决冲突
- ✅ **多语言支持** - JavaScript, TypeScript, Python, HTML, CSS, 纯文本
- ✅ **代码高亮** - 完整的语法高亮和代码补全
- ✅ **持久化存储** - 所有编辑历史持久化到 PostgreSQL
- ✅ **状态感知** - 实时显示连接状态和同步状态

## 快速开始

### 1. 启动数据库

```bash
docker-compose up -d
```

### 2. 启动后端服务

```bash
cd backend
mix deps.get
mix ecto.create
mix ecto.migrate
mix phx.server
```

后端服务将在 `http://localhost:4000` 启动。

### 3. 启动前端服务

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 `http://localhost:5173` 启动。

### 4. 使用编辑器

打开浏览器访问 `http://localhost:5173`

- 使用不同的浏览器窗口打开同一 URL，即可体验多人协同编辑
- 在浏览器开发者工具中模拟离线状态，验证离线编辑功能
- 恢复网络后，离线更改将自动同步到服务器和其他客户端

## 项目结构

```
.
├── backend/                    # Elixir Phoenix 后端
│   ├── lib/
│   │   ├── yjs_collab/         # 业务逻辑
│   │   │   ├── yjs.ex          # Yjs 核心处理模块
│   │   │   └── yjs/
│   │   │       ├── update.ex   # 更新记录 Schema
│   │   │       └── snapshot.ex # 文档快照 Schema
│   │   └── yjs_collab_web/
│   │       ├── channels/
│   │       │   ├── yjs_channel.ex    # Yjs WebSocket 通道
│   │       │   └── user_socket.ex    # Socket 连接处理
│   │       └── controllers/
│   │           └── document_controller.ex  # REST API
│   └── priv/repo/migrations/    # 数据库迁移
├── frontend/                   # SvelteKit 前端
│   └── src/
│       ├── lib/
│       │   ├── yjsProvider.ts  # Yjs 客户端封装
│       │   ├── codemirror/
│       │   │   └── editor.ts   # CodeMirror 编辑器配置
│       │   └── components/     # UI 组件
│       └── routes/
│           └── +page.svelte    # 编辑器主页面
└── docker-compose.yml          # 数据库服务
```

## 核心实现原理

### Yjs 同步协议

Yjs 使用以下消息类型进行同步：

| 类型 | 名称       | 描述                     |
|------|------------|--------------------------|
| 0    | Sync Step 1| 客户端发送状态向量      |
| 1    | Sync Step 2| 服务器返回完整文档状态  |
| 2    | Update     | 增量更新消息            |

### 离线编辑实现

1. **本地存储**: 使用 `y-indexeddb` 将文档状态存储在浏览器 IndexedDB 中
2. **网络检测**: 监听 `online`/`offline` 事件检测网络状态
3. **自动重连**: 指数退避算法实现 WebSocket 自动重连
4. **状态合并**: 网络恢复后，Yjs CRDT 自动合并本地和服务器状态

### 数据持久化

后端将每个 Yjs 更新作为二进制 blob 存储在 PostgreSQL 中：
- `yjs_updates` 表存储所有增量更新
- `yjs_doc_snapshots` 表存储定期快照以加快加载速度
- 每 100 次更新自动创建一次快照

## API 接口

### WebSocket
- **端点**: `ws://localhost:4000/socket/websocket`
- **主题**: `yjs:{doc_id}`

### REST
- `GET /api/health` - 健康检查
- `GET /api/docs/:id/updates` - 获取文档更新信息
- `POST /api/docs/:id/updates` - 提交新的更新

## 测试离线功能

1. 打开编辑器并输入一些内容
2. 在浏览器开发者工具中:
   - Chrome: Network -> Offline
   - Firefox: Network -> Throttling -> Offline
3. 继续编辑内容（状态栏显示"离线"）
4. 恢复网络连接（取消 Offline 选项）
5. 观察状态栏变为"已连接 · 已同步"
6. 刷新页面，验证所有更改都已保存

## License

MIT
