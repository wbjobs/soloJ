# 🔐 LSB 图像隐写工具 - WebAssembly 版

基于 Rust + WebAssembly 实现的最低有效位（LSB）图像隐写应用，支持在图片中隐藏和提取秘密信息。

## ✨ 功能特性

- **🔒 编码模式**：将秘密文本信息隐藏到图片中
- **🔓 解码模式**：从隐写图片中提取隐藏的秘密信息
- **⚡ 高性能**：核心算法使用 Rust 编写，编译为 WebAssembly 在浏览器端运行
- **🎨 精美 UI**：深色科技风格界面，玻璃拟态效果
- **📁 后端支持**：Node.js 后端提供图片暂存和下载服务

## 🏗️ 技术栈

### 前端
- React 18 + Vite 5
- TailwindCSS 3
- WebAssembly (Rust compiled)

### WebAssembly 模块
- Rust + wasm-bindgen
- 核心 LSB 隐写算法

### 后端
- Node.js + Express 4
- Multer (文件上传)
- CORS 支持

## 📁 项目结构

```
j42/
├── frontend/              # 前端 React 应用
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── wasm/          # WASM 模块包装
│   │   ├── utils/         # 工具函数
│   │   └── App.jsx        # 主应用
│   ├── package.json
│   └── vite.config.js
├── wasm/                  # Rust WebAssembly 模块
│   ├── src/
│   │   └── lib.rs         # LSB 算法实现
│   └── Cargo.toml
├── backend/               # Node.js 后端服务
│   ├── server.js
│   ├── uploads/           # 图片暂存目录
│   └── package.json
└── README.md
```

## 🚀 快速开始

### 前置要求

- Node.js >= 16
- Rust (可选，用于重新编译 WASM)
- wasm-pack (可选，用于重新编译 WASM)

### 1. 安装依赖

**后端依赖：**
```bash
cd backend
npm install
```

**前端依赖：**
```bash
cd frontend
npm install
```

### 2. 启动服务

**启动后端服务 (端口 3001)：**
```bash
cd backend
npm start
```

**启动前端开发服务器 (端口 3000)：**
```bash
cd frontend
npm run dev
```

### 3. 访问应用

打开浏览器访问：`http://localhost:3000`

## 🔧 编译 WebAssembly 模块

如果需要重新编译 Rust 代码为 WASM：

```bash
cd wasm
wasm-pack build --target web --out-dir ../frontend/src/wasm/pkg
```

或者使用前端 npm 脚本：
```bash
cd frontend
npm run build:wasm
```

## 📖 使用说明

### 编码（隐藏信息）

1. 切换到「编码模式」
2. 上传一张 PNG/BMP/GIF 格式的图片
3. 在文本框中输入要隐藏的秘密信息
4. 点击「开始编码」按钮
5. 等待处理完成后，下载隐写后的图片

### 解码（提取信息）

1. 切换到「解码模式」
2. 上传包含隐藏信息的隐写图片
3. 点击「开始解码」按钮
4. 查看提取出的秘密信息

## 🔬 LSB 算法原理

1. **编码过程**：
   - 将秘密信息转换为二进制数据流
   - 在前 32 位（4 字节）存储消息长度
   - 依次将每一位数据嵌入到像素 RGB 通道的最低有效位
   - 人眼无法察觉这种微小的颜色变化

2. **解码过程**：
   - 从前 32 位读取消息长度
   - 根据长度从后续像素的最低有效位中提取数据
   - 重组二进制数据为原始文本信息

## ⚠️ 注意事项

- 仅支持 **PNG、BMP、GIF** 等无损压缩格式
- JPEG 格式的有损压缩会破坏隐藏的信息
- 图片越大，可隐藏的信息越多
- 最大隐藏容量 = (宽度 × 高度 × 3) / 8 - 4 字节

## 📡 API 接口

### 上传图片
```
POST /api/upload
Content-Type: multipart/form-data

Response:
{
  "success": true,
  "filename": "uuid_image.png",
  "url": "/api/download/uuid_image.png",
  "size": 12345
}
```

### 下载图片
```
GET /api/download/:filename
```

### 获取文件列表
```
GET /api/list
```

## 🎯 核心代码参考

- WASM 算法实现：[lib.rs](file:///e:/soloJ/j42/wasm/src/lib.rs)
- 后端服务：[server.js](file:///e:/soloJ/j42/backend/server.js)
- 前端主组件：[App.jsx](file:///e:/soloJ/j42/frontend/src/App.jsx)
- WASM 加载器：[wasmLoader.js](file:///e:/soloJ/j42/frontend/src/wasm/wasmLoader.js)

## 📝 License

MIT
