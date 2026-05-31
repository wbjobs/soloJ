# 串口调试工具 (Serial Port Tool)

基于 Tauri (Rust + React) 开发的跨平台串口调试桌面应用。

## 功能特性

- 📡 串口参数配置
  - 波特率：9600 / 19200 / 38400 / 57600 / 115200
  - 数据位：5 / 6 / 7 / 8
  - 停止位：1 / 2
  - 校验位：无 / 奇校验 / 偶校验

- 💬 Hex 指令发送
  - 支持空格分隔的 Hex 格式输入
  - 回车快捷发送
  - 实时显示发送/接收数据

- 📝 日志记录
  - 自动按时间戳命名日志文件
  - 自定义 .log 格式保存
  - 同时记录 HEX 和 ASCII 数据
  - 显示时间戳和数据方向(TX/RX)

## 环境要求

### 必需软件

1. **Node.js** (>= 16.0)
   - 已安装: v20.9.0 ✓

2. **Rust** (>= 1.60)
   - 需自行安装: https://www.rust-lang.org/tools/install
   - Windows 用户需额外安装 Visual Studio Build Tools

3. **WebView2** (Windows)
   - Windows 11 已内置
   - Windows 10 可能需要手动安装

### Rust 环境安装 (Windows)

```powershell
# 1. 下载并运行 rustup-init.exe
# 访问: https://win.rustup.rs/

# 2. 安装完成后，验证安装
rustc --version
cargo --version

# 3. 如果安装了 Visual Studio，需要设置环境变量
# 或使用 MSYS2 工具链
```

## 项目结构

```
j56/
├── src/                          # React 前端
│   ├── main.jsx                 # 入口文件
│   ├── App.jsx                  # 主组件
│   ├── App.css                  # 样式文件
│   └── index.css                # 全局样式
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs              # Tauri 主入口 + 命令定义
│   │   ├── serial_port.rs       # 串口操作模块
│   │   └── logger.rs            # 日志记录模块
│   ├── Cargo.toml               # Rust 依赖配置
│   ├── tauri.conf.json          # Tauri 配置
│   └── build.rs                 # 构建脚本
├── index.html                   # HTML 模板
├── vite.config.js               # Vite 配置
├── package.json                 # npm 配置
└── README.md                    # 项目说明
```

## 快速开始

### 1. 安装依赖

```powershell
# 已执行，如需要重新安装:
npm install
```

### 2. 开发模式运行

```powershell
# 首次运行会自动下载 Rust 依赖
npm run tauri dev
```

### 3. 构建生产版本

```powershell
npm run tauri build
```

构建完成后，安装包位于:
- Windows: `src-tauri/target/release/bundle/msi/` 或 `nsis/`

## 使用说明

### 连接串口

1. 从下拉列表选择串口号
2. 配置波特率、数据位、停止位、校验位
3. 点击「打开串口」按钮
4. 连接成功后可发送指令

### 发送 Hex 指令

- 输入格式示例: `01 03 00 00 00 01`
- 空格会被自动忽略
- 按回车键快速发送
- 发送的数据会显示在下方日志区域

### 记录日志

1. 点击「开始记录日志」
2. 选择日志保存目录
3. 日志文件名格式: `serial_log_YYYYMMDD_HHMMSS.log`
4. 所有发送和接收的数据会自动写入文件

### 日志文件格式

```
========================================
串口日志文件
创建时间: 2026-05-28 14:30:00
格式: [时间戳] [方向] HEX: [十六进制数据] ASCII: [ASCII数据]
========================================
[2026-05-28 14:30:01.123] [TX] HEX: 010300000001 ASCII: ......
[2026-05-28 14:30:01.234] [RX] HEX: 01030200FF ASCII: .....
```

## 核心依赖

### Rust 后端

- `tauri`: 桌面应用框架
- `serialport`: 串口通信库
- `chrono`: 时间处理
- `hex`: Hex 编解码
- `parking_lot`: 同步原语
- `serde`: 序列化/反序列化

### React 前端

- `react`: UI 框架
- `vite`: 构建工具
- `@tauri-apps/api`: Tauri JS API

## 常见问题

### Q: 无法找到串口?

A: 
1. 确保设备已正确连接
2. 检查设备管理器中 COM 端口
3. 点击「刷新」按钮重新扫描

### Q: 打开串口失败?

A:
1. 确认串口未被其他程序占用
2. 检查串口参数配置是否正确
3. Windows 可能需要管理员权限

### Q: 日志文件在哪里?

A: 点击「开始记录日志」时选择的目录，文件名包含创建时间戳。

### Q: 如何修改支持的波特率?

A: 编辑 `src/App.jsx` 中的波特率下拉选项，Rust 后端支持任意合法波特率。

## 技术说明

### 数据流向

```
React 前端
    ↓ (invoke)
Tauri 命令层
    ↓
Rust 业务逻辑
    ├─ serialport 库 → 硬件串口
    └─ Logger 模块   → 文件系统
```

### 并发设计

- 使用 `Arc<Mutex<...>>` 安全共享串口状态
- 前端轮询读取串口数据 (100ms 间隔)
- 日志写入使用互斥锁保证线程安全

## 许可证

MIT
