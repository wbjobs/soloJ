# DICOM 医学影像解析与审计系统

这是一个全栈项目，包含：
- **Rust WebAssembly 库**：本地解析 DICOM (.dcm) 文件
- **React 前端**：上传 DICOM 文件、Canvas 渲染影像、提取并发送敏感元数据
- **FastAPI 后端**：接收元数据、哈希化敏感信息、存入 PostgreSQL 审计日志

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
docker-compose up --build
```

访问：http://localhost:3000

### 方式二：本地开发

#### 1. 启动 PostgreSQL
```bash
docker run -d \
  -e POSTGRES_USER=dicom_user \
  -e POSTGRES_PASSWORD=dicom_password \
  -e POSTGRES_DB=dicom_audit \
  -p 5432:5432 \
  -v ./backend/schema.sql:/docker-entrypoint-initdb.d/schema.sql \
  postgres:16-alpine
```

#### 2. 构建 Rust WASM 库
```bash
cd dicom-parser
wasm-pack build --target web
```

#### 3. 启动前端
```bash
cd frontend
npm install
npm start
```

#### 4. 启动后端
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 项目结构

```
.
├── dicom-parser/          # Rust WebAssembly DICOM 解析库
│   ├── src/
│   └── Cargo.toml
├── frontend/              # React 前端应用
│   ├── src/
│   └── package.json
├── backend/               # FastAPI 后端服务
│   ├── app/
│   ├── schema.sql
│   └── requirements.txt
├── scripts/               # 辅助脚本
└── docker-compose.yml
```

## API 接口

### POST /api/audit
接收敏感元数据并哈希化存储。

请求体：
```json
{
  "patient_name": "张三",
  "patient_id": "P12345678",
  "patient_birth_date": "1990-01-15",
  "study_date": "2024-01-20",
  "institution_name": "XX医院"
}
```

响应：
```json
{
  "id": 1,
  "patient_name_hash": "sha256:abc123...",
  "patient_id_hash": "sha256:def456...",
  "created_at": "2024-01-20T10:30:00Z"
}
```

### GET /api/audit
查询所有审计记录（分页）。

### GET /api/audit/{id}
查询单条审计记录。

## 安全说明

- 所有敏感元数据在后端使用 SHA-256 哈希存储
- 原始敏感数据不会持久化存储
- 前端仅在内存中处理 DICOM 文件，不会上传原始影像数据
