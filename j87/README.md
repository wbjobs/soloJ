# RAG 本地知识库问答系统

基于 RAG（检索增强生成）的本地知识库问答系统，完全本地化部署，数据安全隐私保护。

## 技术架构

### 后端
- **框架**: FastAPI
- **RAG 框架**: LangChain
- **向量数据库**: FAISS
- **嵌入模型**: BAAI/bge-m3 (HuggingFace)
- **本地 LLM**: Ollama

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **图标**: Lucide React

## 项目结构

```
j87/
├── backend/                    # 后端服务
│   ├── main.py               # FastAPI 主应用
│   ├── rag_engine.py        # RAG 核心引擎
│   ├── config.py           # 配置管理
│   ├── requirements.txt   # Python 依赖
│   ├── .env.example    # 环境变量示例
│   ├── uploads/        # 上传文件存储
│   └── vectorstore/   # 向量数据库存储
└── frontend/              # 前端应用
    ├── src/
    │   ├── components/  # React 组件
    │   ├── services/   # API 服务
    │   ├── types/     # TypeScript 类型
    │   ├── App.tsx
    │   └── main.tsx
    │   └── index.css
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── tsconfig.json
    └── index.html
```

## 快速开始

### 前置要求

1. **安装 Ollama** (本地 LLM 服务)
   ```bash
   # Windows: https://ollama.com/ 下载安装
   # 安装完成后启动 Ollama 服务
   ```

2. **下载 LLM 模型
   ```bash
   ollama pull qwen2.5:7b
   # 或使用其他模型，如 llama3.1:8b, mistral:7b
   ```

3. **Python 3.9+**
4. **Node.js 18+**

### 后端启动

```bash
cd backend

# 1. 创建虚拟环境
python -m venv venv
.\venv\Scripts\activate

# 2. 安装依赖
pip install -r requirements.txt

# 3. 复制配置文件
copy .env.example .env

# 4. 修改 .env 文件中的配置（可选）

# 5. 启动后端服务
python main.py
```

后端服务将在 http://localhost:8000 启动。

### 前端启动

```bash
cd frontend

# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev
```

前端服务将在 http://localhost:5173 启动。

## API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/documents` | 获取文档列表 |
| POST | `/api/upload` | 上传文档 (PDF/TXT) |
| POST | `/api/chat` | 问答接口 |
| POST | `/api/clear` | 清空向量库 |

## 使用流程

1. 启动 Ollama 服务
2. 启动后端服务
3. 启动前端服务
4. 在前端上传 PDF 或 TXT 文档
5. 在聊天界面提问，系统会基于上传的文档生成回答

## 配置说明

### 后端配置项（`.env`）

- `OLLAMA_BASE_URL`: Ollama 服务地址，默认 `http://localhost:11434`
- `OLLAMA_MODEL`: 使用的模型名称，默认 `qwen2.5:7b`
- `EMBEDDING_MODEL`: 嵌入模型，默认 `BAAI/bge-m3`
- `CHUNK_SIZE`: 文本分块大小，默认 `500
- `CHUNK_OVERLAP`: 分块重叠大小，默认 `50`
- `RETRIEVE_TOP_K`: 检索返回的相关片段数，默认 `4`

## 注意事项

- 首次启动时会自动下载嵌入模型（约 1.3GB），请确保网络连接正常
- 建议使用 GPU 加速（如有）以获得更好的性能
- 支持中文文档建议使用支持中文的 LLM 模型（如 Qwen、通义千问等）
