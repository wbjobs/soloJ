# 跨平台网络分析工具

一个基于 Tauri + Rust + React 的跨平台网络数据包分析工具。

## 功能特性

- 🔍 **数据包捕获**: 调用系统底层接口（libpcap/winpcap）抓取网卡数据包
- 📡 **多协议识别**: 支持 HTTP、DNS 和 TCP 握手协议识别
- 📊 **数据包列表**: 以表格形式实时展示捕获的数据包
- 🔧 **协议过滤**: 支持按协议类型（HTTP/DNS/TCP/OTHER）过滤数据包
- 🖱️ **数据包详情**: 点击数据包查看详细信息
- 🎨 **现代 UI**: 深色主题，美观的界面设计

## 技术栈

- **前端**: React 18 + TypeScript + Vite
- **GUI 框架**: Tauri 1.x
- **后端**: Rust
  - `pcap`: 底层数据包捕获
  - `etherparse`: 网络协议解析
  - `tokio`: 异步运行时
  - `serde`: 序列化/反序列化

## 系统要求

### Windows
- 需要安装 WinPcap 或 Npcap
- 需要管理员权限运行

### macOS/Linux
- 需要安装 libpcap
- 需要 sudo/root 权限运行

## 安装依赖

```bash
# 安装前端依赖
npm install

# Rust 依赖会在构建时自动安装
```

## 开发运行

```bash
# 开发模式
npm run tauri dev
```

## 构建生产版本

```bash
# 构建
npm run tauri build
```

## 项目结构

```
.
├── src/                      # 前端源代码
│   ├── App.tsx              # 主应用组件
│   ├── main.tsx             # 入口文件
│   ├── types.ts             # TypeScript 类型定义
│   └── styles.css           # 全局样式
├── src-tauri/               # Rust 后端代码
│   ├── src/
│   │   ├── main.rs          # Tauri 主入口
│   │   ├── capture.rs       # 数据包捕获模块
│   │   ├── types.rs         # Rust 类型定义
│   │   └── protocols/       # 协议解析模块
│   │       ├── mod.rs
│   │       ├── tcp.rs       # TCP 协议解析
│   │       ├── http.rs      # HTTP 协议解析
│   │       └── dns.rs       # DNS 协议解析
│   ├── Cargo.toml           # Rust 依赖配置
│   └── tauri.conf.json      # Tauri 配置
├── package.json             # npm 配置
├── tsconfig.json            # TypeScript 配置
└── vite.config.ts           # Vite 配置
```

## 使用说明

1. 启动应用程序
2. 从下拉列表中选择要监听的网络接口
3. 点击「开始捕获」按钮开始抓包
4. 查看实时捕获的数据包列表
5. 使用「协议过滤」下拉菜单筛选特定协议的数据包
6. 点击任意数据包查看详细信息
7. 点击「停止捕获」按钮结束抓包

## 权限说明

由于数据包捕获需要访问网络接口，程序需要相应的系统权限：

- **Windows**: 以管理员身份运行
- **macOS**: 使用 `sudo` 运行或在系统设置中授予权限
- **Linux**: 使用 `sudo` 运行
