# LSB 图像隐写术 (WebAssembly + React + Node.js)

一个基于 WebAssembly 的图像 LSB（最低有效位）隐写术应用，支持将文本信息隐藏进 PNG 图片像素中，并能无损提取。

## 技术栈

- **前端**: React 18 + Vite
- **Wasm**: Rust (编译为 WebAssembly)
- **后端**: Node.js + Express
- **鉴权**: JWT (JSON Web Token)
- **隐写算法**: LSB (Least Significant Bit)

## 项目结构

```
lsb-steganography/
├── backend/              # Node.js 后端
│   ├── server.js        # 主服务器文件
│   ├── middleware/
│   │   └── auth.js      # JWT 认证中间件
│   ├── routes/
│   │   ├── auth.js      # 用户认证路由
│   │   └── images.js    # 图片管理路由
│   ├── uploads/         # 图片临时存储目录
│   └── package.json
├── frontend/             # React 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── HideMessage.jsx
│   │   │   ├── ExtractMessage.jsx
│   │   │   └── ImageGallery.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── wasm/                 # Rust Wasm 模块
│   ├── src/
│   │   └── lib.rs       # LSB 隐写算法实现
│   └── Cargo.toml
└── package.json          # 根目录配置
```

## 安装前置依赖

### 必需
- Node.js (v16+)
- npm 或 yarn

### 可选（用于编译 Wasm）
- Rust (https://www.rust-lang.org/tools/install)
- wasm-pack (https://rustwasm.github.io/wasm-pack/installer/)

## 安装步骤

### 1. 安装后端依赖
```bash
cd backend
npm install
```

### 2. 安装前端依赖
```bash
cd frontend
npm install
```

### 3. 编译 Wasm 模块（可选）

如果不编译 Wasm，前端会自动使用 JavaScript 备用实现。

```bash
cd wasm
wasm-pack build --target web --out-dir ../frontend/src/wasm
```

或者在项目根目录运行：
```bash
npm run build:wasm
```

## 运行项目

### 方式一：分别运行

**启动后端服务器** (端口 5000):
```bash
cd backend
npm run dev
```

**启动前端开发服务器** (端口 3000):
```bash
cd frontend
npm run dev
```

### 方式二：同时运行（需要先安装根目录依赖）
```bash
npm install
npm run dev
```

## 使用说明

### 1. 注册账号
- 访问 http://localhost:3000
- 点击「立即注册」
- 输入用户名和密码（密码至少6位）

### 2. 隐藏消息
- 登录后进入「隐藏消息」选项卡
- 上传一张 PNG 格式图片
- 输入要隐藏的文本消息
- 点击「隐藏消息」按钮
- 下载处理后的图片或保存到服务器

### 3. 提取消息
- 进入「提取消息」选项卡
- 上传包含隐藏消息的 PNG 图片
- 点击「提取隐藏消息」按钮
- 查看提取的文本内容

### 4. 图片库
- 进入「图片库」选项卡
- 查看所有已保存到服务器的图片
- 支持下载和删除图片

## LSB 隐写算法原理

### 隐藏过程
1. 将文本消息转换为字节数组
2. 在图片像素数据开头写入 4 字节的消息长度头
3. 将消息的每一位依次存储到每个像素通道（RGBA）的最低有效位
4. 每个字节需要 8 个像素通道来存储

### 提取过程
1. 读取前 4 个字节获取消息长度
2. 根据消息长度从像素的最低有效位中提取每一位
3. 将位组合成字节，再解码为文本

### 容量计算
```
最大消息字节数 = (像素总数 × 4 通道 / 8) - 4 字节头部
```

例如：一张 1000×1000 的图片
- 总像素数: 1,000,000
- 总通道数: 4,000,000
- 最大可隐藏: 500,000 - 4 = 499,996 字节 (约 488 KB)

## 安全说明

1. **用户密码**：使用 bcrypt 加密存储
2. **API 鉴权**：使用 JWT token 进行身份验证
3. **图片格式**：仅支持 PNG 格式（无损压缩）
4. **临时存储**：图片存储在服务器 `uploads` 目录

## 注意事项

1. 仅支持 PNG 格式图片，JPG 等有损压缩会破坏隐藏的消息
2. 图片容量限制：每张图片最多隐藏约 (像素数/2 - 4) 字节的消息
3. 服务器存储的图片为临时存储，重启服务器后用户数据会重置
4. Wasm 模块为可选，缺失时自动使用 JavaScript 实现

## 开发说明

### 后端 API

| 方法 | 路径 | 说明 | 鉴权 |
|------|------|------|------|
| POST | /api/auth/register | 用户注册 | 否 |
| POST | /api/auth/login | 用户登录 | 否 |
| GET | /api/images | 获取图片列表 | 是 |
| POST | /api/images/upload | 上传图片 | 是 |
| POST | /api/images/save-stego | 保存隐写图片 | 是 |
| DELETE | /api/images/:id | 删除图片 | 是 |

## License

MIT
