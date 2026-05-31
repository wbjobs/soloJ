# WASM Python 运行环境与可视化调试器

一个基于 WebAssembly 的 Python 运行环境，支持在浏览器中执行 Python 代码并提供专业级的可视化调试功能。

## ✨ 功能特性

### 🐍 Python 运行时
- **WASM 执行**: 基于 Pyodide (Emscripten 编译的 CPython)
- **标准库支持**: builtins、math、json 等核心模块
- **包管理**: 支持 numpy、pandas 等常用包的 WASM 版本

### 🔧 可视化调试
- **断点设置**: 点击行号设置/取消断点
- **单步执行**: Step Over / Step Into / Step Out
- **变量监视**: 实时查看局部/全局变量
- **调用栈**: 可视化显示调用栈信息
- **执行控制**: 继续、暂停、重启调试

### 📝 代码编辑器
- **Monaco Editor**: VS Code 同款编辑器
- **语法高亮**: Python 完整语法着色
- **主题支持**: 深色/浅色主题切换
- **智能提示**: 基础代码补全

### 📁 虚拟文件系统
- **WASI 接口**: 通过 WASI 访问虚拟文件系统
- **本地持久化**: 基于 LocalStorage 的文件持久化
- **文件管理**: 创建、读取、写入、删除文件

## 🚀 快速开始

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 http://localhost:3000 启动

### 后端服务

```bash
cd backend
npm install
npm start
```

后端服务将在 http://localhost:8080 启动

## 🏗️ 技术架构

### 前端技术栈
- **框架**: React 18 + TypeScript
- **构建**: Vite
- **编辑器**: Monaco Editor
- **Python 运行时**: Pyodide
- **状态管理**: Zustand
- **样式**: TailwindCSS
- **图标**: Lucide React

### 后端技术栈
- **框架**: Express.js
- **功能**: 预编译包管理、API 服务

### 关键技术
- **WebAssembly (WASM)**: 浏览器端高性能代码执行
- **WebAssembly System Interface (WASI)**: 系统接口抽象
- **Python bdb**: 调试器核心协议
- **IndexedDB/LocalStorage**: 本地持久化存储

## 📂 项目结构

```
.
├── frontend/                 # 前端应用
│   ├── src/
│   │   ├── components/      # UI 组件
│   │   │   ├── editor/      # 代码编辑器
│   │   │   ├── debugger/    # 调试器组件
│   │   │   ├── console/     # 控制台
│   │   │   ├── filesystem/  # 文件浏览器
│   │   │   └── layout/      # 布局组件
│   │   ├── hooks/           # 自定义 Hooks
│   │   ├── stores/          # 状态管理 (Zustand)
│   │   ├── services/        # 服务层
│   │   │   └── pyodide/     # Pyodide 运行时
│   │   ├── types/           # TypeScript 类型
│   │   └── App.tsx          # 应用入口
│   └── package.json
│
├── backend/                 # 后端服务
│   ├── server.js            # Express 服务
│   ├── packages/            # 预编译包存储
│   └── package.json
│
└── .trae/documents/         # 项目文档
    ├── prd.md               # 产品需求文档
    └── technical-architecture.md  # 技术架构文档
```

## 🎯 使用说明

### 基本操作
1. **运行代码**: 点击绿色播放按钮或按 F5
2. **开始调试**: 点击瓢虫图标按钮或按 F6
3. **设置断点**: 点击编辑器左侧行号区域
4. **单步执行**: 调试暂停后使用单步控制按钮

### 快捷键
| 快捷键 | 功能 |
|--------|------|
| F5 | 运行 / 继续执行 |
| F6 | 开始调试 / 暂停 |
| F10 | 单步跳过 |
| F11 | 单步进入 |
| Shift+F11 | 单步跳出 |
| Shift+F5 | 停止 |

### 包管理
1. 点击工具栏的"包管理"按钮
2. 输入要加载的包名 (如: numpy)
3. 点击"加载"按钮
4. 等待包下载和加载完成

### 支持的包
- **numpy**: 科学计算 (1.24.0)
- **pandas**: 数据分析 (2.1.0)
- **matplotlib**: 数据可视化 (3.7.0)
- **scipy**: 科学计算库 (1.11.0)
- **scikit-learn**: 机器学习 (1.3.0)
- **sympy**: 符号计算 (1.12)

## 🔧 开发指南

### 调试器工作原理
1. Python 端使用 `sys.settrace()` 实现调试钩子
2. 每行代码执行时触发 trace 函数
3. 检查是否命中断点或需要单步暂停
4. 通过 JS 桥接将调试事件发送到前端
5. 前端更新变量、调用栈等 UI 状态

### Pyodide 集成
- 自动从 CDN 加载 Pyodide 运行时
- 支持 stdout/stderr 捕获
- 支持 Python ↔ JavaScript 双向通信

## 📊 性能指标

| 指标 | 目标 |
|------|------|
| 编辑器加载时间 | < 2秒 |
| Python 运行时初始化 | < 3秒 |
| 调试操作响应 | < 100ms |
| 支持代码行数 | ≥ 1000行 |

## 🌐 浏览器兼容性

- ✅ Chrome 最新版
- ✅ Firefox 最新版
- ✅ Safari 最新版
- ✅ Edge 最新版

需要支持 WebAssembly 和 SharedArrayBuffer 的现代浏览器

## 🛡️ 安全特性

- **沙箱执行**: WASM 内存隔离
- **文件系统限制**: 仅可访问虚拟文件系统
- **网络限制**: 默认禁用网络请求
- **超时保护**: 防止无限循环

## 📝 版本历史

### v0.1.0
- ✅ 基础代码编辑器 (Monaco Editor)
- ✅ Python WASM 运行时 (Pyodide)
- ✅ 断点调试功能
- ✅ 变量监视器
- ✅ 调用栈可视化
- ✅ 虚拟文件系统
- ✅ 包管理功能
- ✅ 后端 API 服务

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

**Made with ❤️ using WebAssembly & Python**
