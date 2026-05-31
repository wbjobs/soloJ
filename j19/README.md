# FPGA 远程烧录与在线调试平台

![Status](https://img.shields.io/badge/status-beta-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Python](https://img.shields.io/badge/python-3.11-blue) ![Node](https://img.shields.io/badge/node-18-green)

一个基于 WebUSB 技术的 **FPGA 远程烧录与在线调试平台**，支持在浏览器中通过 USB 直接连接 FPGA 开发板，完成比特流烧录、远程逻辑分析、断点调试、波形查看等全流程开发工作，无需安装任何本地驱动软件。

---

## 1. 项目概述

本平台面向 FPGA 工程师、嵌入式开发人员与高校师生，提供了一套端到端的远程开发与调试解决方案：

- **零驱动安装**：浏览器原生 WebUSB API 直接与 FPGA JTAG/SWD 接口通讯，支持 Windows、macOS、Linux 三端通用。
- **云端协同**：多用户共享设备资源，管理员可按项目分配开发板使用权。
- **在线调试**：浏览器内即可触发断点、读取寄存器、捕获波形。
- **比特流资产管理**：集中管理不同版本、不同器件型号的比特流文件 (`.bit`、`.bin`、`.rbf`)，支持版本对比与一键烧录。

---

## 2. 功能特性

| 模块               | 核心能力                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| WebUSB 设备连接    | 自动扫描 FPGA 设备、握手鉴权、热插拔监听、链路保活                       |
| 比特流管理         | 上传/校验/哈希去重/版本对比、器件型号识别、烧录前兼容性检查              |
| 远程逻辑分析仪     | 多通道实时采样、任意频率触发、数据降采样、FIFO 回读                      |
| 调试断点           | 软硬件断点设置、单步/连续执行、寄存器读写、PC 跟踪                        |
| 用户权限           | RBAC 角色（管理员/开发者/访客），JWT 会话，资源级细粒度权限               |
| 波形显示           | 基于 Canvas 的高性能波形渲染，支持百万级采样点、缩放、光标测量、导出 CSV |
| 操作审计           | 所有烧录、调试操作留痕，可按项目与用户检索                               |

---

## 3. 技术栈

### 前端

- **React 18** — 组件化 UI 开发
- **Vite** — 极速开发构建工具
- **Tailwind CSS** — 原子化样式体系
- **WebUSB API** — 浏览器原生 USB 通讯
- **Zustand/Context** — 全局状态管理
- **Axios** — HTTP 客户端

### 后端

- **Python 3.11** — 运行时
- **Flask 2.3** — 轻量级 Web 框架
- **SQLAlchemy** — ORM，支持 SQLite / PostgreSQL
- **Flask-JWT-Extended** — 身份认证与令牌管理
- **pyusb (libusb)** — 后端 USB 代理转发
- **Pydantic** — 请求/响应数据校验

### 其它

- **Docker** — 一键部署容器化运行环境
- **Nginx**（可选）— 生产环境反向代理与静态托管

---

## 4. 系统架构

```
                      ┌─────────────────────────────────────────────────────┐
                      │                      浏览器                        │
                      │   ┌───────────────┐       ┌──────────────────────┐ │
                      │   │   React 18    │◄──────►│    WebUSB API         │ │
                      │   │  (Vite +      │  HTTPS │  (JTAG/SWD 协议栈)    │ │
                      │   │  Tailwind)    │  /WSS  │                       │ │
                      │   └──────┬────────┘       └──────────┬─────────────┘ │
                      │          │                           │               │
                      └──────────┼───────────────────────────┼───────────────┘
                                 │                           │
                                 │ REST / WebSocket          │ 原始 USB 传输
                                 ▼                           ▼
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │                          服务器 (Flask / Python 3.11)                        │
   │                                                                             │
   │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  ┌───────────────┐ │
   │  │ Auth (JWT)   │  │ 比特流服务   │  │ 调试调度器    │  │ WebUSB 代理   │ │
   │  │ RBAC         │  │ (上传/校验)  │  │ (断点/波形)   │  │ (pyusb)       │ │
   │  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  └──────┬────────┘ │
   │         └──────────────────┴─────────┬───────┴──────────────────┘          │
   │                                       ▼                                    │
   │                           ┌─────────────────────┐                         │
   │                           │   SQLAlchemy ORM    │                         │
   │                           │  (SQLite / PG)      │                         │
   │                           └─────────────────────┘                         │
   └─────────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                   ┌──────────────────────────────┐
                   │        FPGA 开发板            │
                   │   (Xilinx Artix-7 /           │
                   │    Altera Cyclone V / ...)    │
                   └──────────────────────────────┘
```

数据流要点：

1. 浏览器通过 WebUSB 直连开发板，执行 JTAG/SWD 原始字节流操作。
2. 关键命令（烧录、断点设置）经后端校验与审计后落库。
3. 波形与日志通过 WebSocket 通道实时推送到前端渲染。

---

## 5. 快速开始

### 5.1 环境要求

| 依赖   | 最低版本 |
| ------ | -------- |
| Python | 3.10+    |
| Node   | 18+      |
| npm    | 9+       |
| 浏览器 | Chrome 113+ / Edge 113+ / Opera 99+（需支持 WebUSB） |

### 5.2 克隆与启动

```bash
git clone <repo-url>
cd j19
```

#### 方式一：一键脚本

Windows：

```bat
start.bat
```

Linux / macOS：

```bash
chmod +x start.sh
./start.sh
```

脚本会自动安装依赖并在后台启动前后端服务。

#### 方式二：手动启动

**后端**

```bash
cd backend
pip install -r requirements.txt
python app.py
```

默认监听 `http://localhost:5000`。

**前端**

```bash
cd frontend
npm install
npm run dev
```

默认访问地址：`http://localhost:3000`。

### 5.3 默认管理员

系统首次启动时会自动初始化以下账号：

| 用户名 | 密码  | 角色     |
| ------ | ----- | -------- |
| admin  | admin | 超级管理员 |

> ⚠️ 登录后请**立即修改默认密码**。

---

## 6. 目录结构

```
j19/
├── backend/                      # Flask 后端
│   ├── app.py                    # 应用入口，注册蓝图与中间件
│   ├── config.py                 # 配置（JWT、数据库、密钥）
│   ├── models.py                 # SQLAlchemy 数据模型
│   ├── requirements.txt          # Python 依赖
│   ├── routes/                   # API 路由蓝图
│   │   ├── auth.py               # 登录 / 令牌刷新 / 权限
│   │   ├── bitstream.py          # 比特流上传、校验、烧录任务
│   │   ├── debug.py              # 断点、寄存器、单步执行
│   │   └── webusb.py             # WebUSB 代理与命令通道
│   └── utils/
│       ├── bitstream_parser.py   # .bit/.bin 文件头解析
│       ├── debug_queue.py        # 调试命令队列与回包匹配
│       └── webusb_proxy.py       # pyusb 代理实现
│
├── frontend/                     # React 前端
│   ├── index.html                # Vite 入口 HTML
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx              # 应用入口
│       ├── App.jsx               # 路由与布局
│       ├── index.css             # Tailwind 基础样式
│       ├── components/           # 业务组件
│       │   ├── Bitstream/        # 比特流管理
│       │   ├── Common/           # 通用组件 (Header / Sidebar)
│       │   ├── Debugger/         # 断点与控制台
│       │   ├── DeviceManager/    # 设备连接与列表
│       │   ├── LogicAnalyzer/    # 采样与波形
│       │   └── User/             # 登录与用户管理
│       ├── context/              # Context 全局状态
│       ├── hooks/                # 自定义 hooks (useWebUSB)
│       ├── pages/                # 页面级组件
│       ├── services/             # API 与 WebUSB 服务封装
│       └── utils/                # 工具方法 (协议、渲染)
│
├── docker-compose.yml            # Docker 一键编排
├── start.bat                     # Windows 启动脚本
├── start.sh                      # Linux / macOS 启动脚本
└── README.md
```

---

## 7. API 文档概览

所有接口以 `/api/v1` 为前缀，统一使用 JSON 请求/响应。

### 7.1 认证

| 方法   | 路径                   | 说明               |
| ------ | ---------------------- | ------------------ |
| POST   | `/auth/login`          | 登录，返回 access/refresh token |
| POST   | `/auth/refresh`        | 刷新 access token  |
| POST   | `/auth/logout`         | 注销               |
| GET    | `/auth/me`             | 获取当前用户信息   |

### 7.2 用户管理（管理员）

| 方法   | 路径                   | 说明               |
| ------ | ---------------------- | ------------------ |
| GET    | `/users`               | 用户列表           |
| POST   | `/users`               | 创建用户           |
| PATCH  | `/users/:id`           | 更新角色/密码      |
| DELETE | `/users/:id`           | 删除用户           |

### 7.3 比特流

| 方法   | 路径                          | 说明                       |
| ------ | ----------------------------- | -------------------------- |
| GET    | `/bitstreams`                 | 列表/筛选                  |
| POST   | `/bitstreams/upload`          | multipart 上传             |
| GET    | `/bitstreams/:id/download`    | 下载文件                   |
| POST   | `/bitstreams/:id/burn`        | 触发异步烧录任务           |
| GET    | `/bitstreams/:id/burn/:task`  | 查询烧录进度               |

### 7.4 调试

| 方法   | 路径                       | 说明                       |
| ------ | -------------------------- | -------------------------- |
| POST   | `/debug/breakpoints`       | 设断点                     |
| DELETE | `/debug/breakpoints/:id`   | 删断点                     |
| POST   | `/debug/step`              | 单步执行                   |
| POST   | `/debug/continue`          | 继续执行                   |
| GET    | `/debug/registers`         | 读取寄存器组               |

### 7.5 WebUSB

| 方法   | 路径                        | 说明                           |
| ------ | --------------------------- | ------------------------------ |
| GET    | `/webusb/devices`           | 列出后端可见 USB 设备          |
| WS     | `/ws/webusb/:deviceId`      | 原始字节流双向通道             |
| POST   | `/webusb/claim`             | 后端代理接口声明               |

所有接口通过 `Authorization: Bearer <token>` 进行鉴权，异常统一返回：

```json
{ "code": 40101, "message": "token expired", "data": null }
```

---

## 8. WebUSB 协议说明

### 8.1 握手流程

```
Browser                              FPGA
  │                                    │
  │── navigator.usb.requestDevice ────►│  (用户选择设备)
  │◄──── device (USBInterface) ───────│
  │                                    │
  │── open() ────────────────────────►│
  │── selectConfiguration(1) ────────►│
  │── claimInterface(0) ─────────────►│
  │                                    │
  │── 控制传输 (0x40, 0xB0, ...) ────►│  JTAG/SWD 初始化
  │◄──── ACK ────────────────────────│
  │                                    │
  │── 批量传输 (EP1 OUT, 数据块) ────►│  烧录/采样
  │◄──── 批量传输 (EP2 IN, 回包) ────│
  │                                    │
```

### 8.2 数据包格式

```
Byte  0     : 0xAA (包起始)
Byte  1     : 命令码 (0x01=RESET, 0x02=BURN, 0x03=SAMPLE, 0x04=READ_REG)
Byte  2-3   : 载荷长度 (little-endian uint16)
Byte  4..N  : 载荷
Byte  N+1   : 校验和 (XOR 全部前面字节)
Byte  N+2   : 0x55 (包结束)
```

### 8.3 心跳

浏览器端每 10s 发送一次 `0x00 (PING)` 命令，设备需在 500ms 内回复 `0x00` + 原序号，否则认为链路断开，触发重连。

---

## 9. 浏览器支持说明

WebUSB 属于**安全上下文**特性，必须满足：

- 页面运行在 `https://` 或 `http://localhost` 下
- 浏览器为 **Chromium 内核**（Chrome、Edge、Opera、Arc、Brave 等）
- Firefox 与 Safari **暂不支持** WebUSB，可使用后端代理模式 `pyusb` 完成同等功能
- 首次使用需在浏览器弹窗中授权设备，授权信息持久保存在浏览器

检测方法：

```js
if (!("usb" in navigator)) {
  alert("当前浏览器不支持 WebUSB，请使用最新版 Chrome 或 Edge。");
}
```

---

## 10. 常见问题排查

### Q1. `navigator.usb` 为 undefined？
> 请确认使用 Chromium 内核浏览器，并且页面地址为 `https` 或 `localhost`。

### Q2. 点击"连接设备"无反应？
> 在 Windows 上需先安装 **WinUSB** 驱动（可用 Zadig 工具替换），并确保没有其他程序占用设备（如 Vivado Hardware Manager）。

### Q3. Linux 下普通用户无法访问 USB 设备？
> 添加 udev 规则，例如：
> ```
> SUBSYSTEM=="usb", ATTR{idVendor}=="0403", MODE="0666", GROUP="plugdev"
> ```
> 然后执行 `udevadm control --reload-rules`，重新插拔设备。

### Q4. 烧录过程中断，出现"校验失败"？
> 检查 USB 线缆质量、供电稳定性；长时间传输建议启用 `webusb.keepAlive` 心跳并缩短单次数据块至 4096 字节。

### Q5. JWT 过期后接口返回 401？
> 前端会在 401 时使用 refresh token 自动刷新；若 refresh 也过期则跳转登录页。

### Q6. 波形渲染卡顿？
> 默认已做降采样，若仍不流畅可在「设置 → 波形渲染」中将采样点上限调低（默认 500,000）。

---

## 11. 开发与贡献

建议使用 **npm workspaces** 与 **pipenv/poetry** 统一管理依赖。提交前请执行：

```bash
cd backend && pytest
cd frontend && npm run lint && npm run test
```

欢迎通过 Issue / Pull Request 贡献新 FPGA 型号适配协议。

---

## 12. License

本项目基于 [MIT License](LICENSE) 开源。
