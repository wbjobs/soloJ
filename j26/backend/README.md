# WASM Python Debugger - Backend Service

## 功能说明

后端服务为 WASM Python 调试器提供预编译的 Python 包支持和包管理功能。

## 技术栈

- Node.js + Express
- CORS 支持
- 提供 Pyodide 兼容的 WASM 包信息

## 启动方式

```bash
cd backend
npm install
npm start
```

服务将在 http://localhost:8080 启动。

## API 接口

### 健康检查
```
GET /api/health
```

### 获取所有包
```
GET /api/packages
```

查询参数:
- `category`: 按类别过滤
- `search`: 搜索包名或描述

### 获取单个包详情
```
GET /api/packages/:name
```

### 获取所有类别
```
GET /api/categories
```

## 支持的包

| 包名 | 类别 | 版本 |
|------|------|------|
| numpy | 科学计算 | 1.24.0 |
| pandas | 数据分析 | 2.1.0 |
| matplotlib | 可视化 | 3.7.0 |
| scipy | 科学计算 | 1.11.0 |
| scikit-learn | 机器学习 | 1.3.0 |
| requests | 网络 | 2.31.0 |
| beautifulsoup4 | 网络 | 4.12.0 |
| sympy | 数学 | 1.12 |

## 目录结构

```
backend/
├── server.js          # 主服务文件
├── package.json       # 依赖配置
├── packages/          # 本地包存储目录
└── static/            # 静态文件目录
```
