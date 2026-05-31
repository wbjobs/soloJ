# Ebook DRM Styler

一款专业的电子书 DRM 移除与智能样式重排桌面应用。

## 功能特点

### 🔧 核心引擎
- **Rust + Tauri**：高性能、跨平台的桌面应用框架
- **多格式支持**：PDF、EPUB、AZW3、MOBI
- **精准解析**：提取文本内容和样式信息

### 🔓 DRM 移除（仅供合法备份使用）
- 集成 Calibre 命令行工具
- 支持 DeDRM 插件
- 处理 Adobe DRM (PDF/EPUB)
- 处理 Amazon DRM (AZW/AZW3)

### 🎨 智能样式重排
- **C++ CSS 解析引擎**：高性能样式处理
- 自定义字体、字号、行高
- 可调节页边距和背景色
- 支持多栏布局
- 输出流式 HTML5 格式
- 双栏对比模式：原始 vs 重排

### 🔍 全文检索
- **SQLite + FTS5**：高性能全文搜索
- **Jieba 分词**：中英文混合搜索支持
- 模糊搜索和相关度排序
- 搜索结果高亮显示

### 📦 批处理模式
- 一次处理整个文件夹
- 保持目录结构
- 保留文件元数据
- 支持多格式混合输出
- 实时进度显示

## 技术栈

| 模块 | 技术 |
|------|------|
| GUI 界面 | Svelte 4 + TypeScript |
| 窗口框架 | Tauri 1.6 |
| 核心逻辑 | Rust |
| 排版引擎 | C++17 |
| 搜索引擎 | SQLite + FTS5 + Jieba |
| DRM 处理 | Calibre + DeDRM |

## 系统要求

### Windows
- Windows 10 及以上
- 已安装 Calibre（如需 DRM 移除功能）

### macOS
- macOS 10.13 及以上
- 已安装 Calibre（如需 DRM 移除功能）

### Linux
- Linux Kernel 4.x 及以上
- 已安装 Calibre（如需 DRM 移除功能）
- WebKit2GTK

## 安装

### 前置依赖
1. 安装 Node.js (>= 18.0)
2. 安装 Rust (>= 1.70)
3. 安装 C++ 编译器 (支持 C++17)
4. （可选）安装 [Calibre](https://calibre-ebook.com/) 用于 DRM 移除

### 编译运行

```bash
# 安装依赖
npm install

# 开发模式
npm run tauri:dev

# 构建发布版本
npm run tauri:build
```

## 项目结构

```
ebook-drm-styler/
├── src/                          # Svelte 前端
│   ├── components/              # 可复用组件
│   │   ├── Sidebar.svelte
│   │   └── StylePanel.svelte
│   ├── views/                   # 页面视图
│   │   ├── LibraryView.svelte   # 书库
│   │   ├── ReaderView.svelte    # 阅读器（双栏对比）
│   │   ├── BatchView.svelte     # 批处理
│   │   ├── SearchView.svelte    # 搜索
│   │   └── SettingsView.svelte  # 设置
│   ├── stores/                  # 状态管理
│   ├── types/                   # TypeScript 类型定义
│   ├── utils/                   # 工具函数
│   └── styles/                  # 全局样式
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── core/               # 核心解析引擎
│   │   ├── drm/                # DRM 移除模块
│   │   ├── layout/             # 样式重排 FFI
│   │   ├── search/             # 全文检索
│   │   ├── batch/              # 批处理
│   │   ├── commands.rs         # Tauri 命令
│   │   └── types.rs            # Rust 类型定义
│   └── tauri.conf.json         # Tauri 配置
├── cpp/                          # C++ 排版引擎
│   ├── style_rearranger.h
│   ├── style_rearranger.cpp
│   └── nlohmann/
│       └── json.hpp            # JSON 解析库
└── Cargo.toml                   # Rust 依赖
```

## 使用说明

### 1. 打开电子书
- 点击侧边栏的「打开文件」按钮
- 选择 PDF/EPUB/AZW3/MOBI 文件
- 应用将自动解析并进入阅读器

### 2. 双栏对比阅读
- 左侧：原始版式
- 右侧：智能重排版
- 可切换视图模式（原版/重排/双栏）
- 滚动同步

### 3. 样式调整
- 点击右上角设置按钮打开样式面板
- 调整字体、字号、行高、边距等
- 选择预设主题（明亮/护眼/夜间）
- 实时预览效果

### 4. DRM 移除
- 首次使用需在设置中配置 Calibre 路径
- 打开受 DRM 保护的书籍时会自动检测
- 点击「移除 DRM」按钮进行处理

### 5. 全文搜索
- 切换到搜索页面
- 输入关键词进行搜索
- 支持中英文混合搜索
- 点击结果可跳转至对应位置

### 6. 批处理
- 切换到批处理页面
- 选择输入目录和输出目录
- 配置处理选项
- 点击「开始处理」

## 法律声明

⚠️ **重要提示**

本软件的 DRM 移除功能**仅供个人对合法拥有的书籍进行备份使用**。请确保您：

1. 拥有待处理书籍的合法使用权
2. 仅用于个人备份目的
3. 遵守您所在地区的相关法律法规

**禁止**：
- 用于商业用途
- 侵犯他人版权
- 传播受版权保护的作品

## 许可证

本项目采用 MIT 许可证。

## 贡献

欢迎提交 Issue 和 Pull Request！

---

*For legal backup purposes only.*
