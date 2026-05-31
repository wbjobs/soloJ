# Electron 笔记应用

一个功能完整的桌面笔记应用，使用 Electron、Express 和 MongoDB 构建。

## 功能特性

- 📝 **笔记管理** - 创建、编辑、删除笔记
- 📁 **文件夹组织** - 按文件夹分类管理笔记
- 🏷️ **标签系统** - 使用标签标记笔记
- ✍️ **Markdown 支持** - 支持 Markdown 编辑和实时预览
- 👀 **多种视图模式** - 编辑模式、预览模式、分屏模式
- ☁️ **云端同步** - 支持将笔记同步到云端
- 🔍 **搜索功能** - 快速搜索笔记
- ⌨️ **快捷键支持** - 常用操作的键盘快捷键

## 技术栈

- **前端**: HTML5, CSS3, JavaScript
- **Markdown 渲染**: markdown-it
- **桌面框架**: Electron
- **后端**: Express.js
- **数据库**: MongoDB
- **HTTP 客户端**: Axios

## 项目结构

```
electron-note-app/
├── src/
│   ├── main/              # Electron 主进程
│   │   └── main.js
│   ├── renderer/          # 渲染进程
│   │   ├── index.html
│   │   ├── css/
│   │   │   └── style.css
│   │   └── js/
│   │       ├── api.js
│   │       └── app.js
│   └── server/            # 后端服务
│       ├── server.js
│       ├── models/
│       │   └── Note.js
│       └── routes/
│           └── notes.js
├── package.json
├── .env
└── README.md
```

## 安装和运行

### 前置要求

- Node.js (v16 或更高版本)
- MongoDB (本地或远程)

### 安装依赖

```bash
npm install
```

### 配置环境变量

编辑 `.env` 文件：

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/electron-notes
CLOUD_SYNC_URL=https://api.example.com/sync
```

### 启动应用

确保 MongoDB 服务正在运行，然后执行：

```bash
npm run dev
```

或者分别启动后端和 Electron：

```bash
# 启动后端服务
npm run server

# 启动 Electron 应用（在另一个终端）
npm run electron
```

## API 接口

### 笔记相关

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/notes` | 获取所有笔记 |
| GET | `/api/notes/:id` | 获取单个笔记 |
| POST | `/api/notes` | 创建新笔记 |
| PUT | `/api/notes/:id` | 更新笔记 |
| DELETE | `/api/notes/:id` | 删除笔记 |
| POST | `/api/notes/sync` | 同步笔记到云端 |
| GET | `/api/notes/folders/list` | 获取所有文件夹 |

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl + N | 新建笔记 |
| Ctrl + S | 保存笔记 |
| Ctrl + Shift + S | 同步到云端 |
| Ctrl + Q | 退出应用 |

## 使用说明

1. **创建笔记**: 点击左侧的 `+` 按钮或使用 Ctrl+N 快捷键
2. **编辑笔记**: 在右侧编辑器中输入内容，支持 Markdown 语法
3. **切换视图**: 使用编辑器顶部的按钮切换编辑/预览/分屏模式
4. **管理文件夹**: 点击文件夹旁边的 `+` 创建新文件夹
5. **添加标签**: 在标签输入框中输入标签名后按 Enter
6. **搜索笔记**: 在搜索框中输入关键词进行搜索
7. **同步云端**: 点击底部的"同步到云端"按钮

## 自定义云端同步

要实现自定义的云端同步功能，请修改 `src/server/routes/notes.js` 中的 `/sync` 接口，将其连接到您的云端服务。

## 许可证

MIT License
