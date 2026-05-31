# 数据血缘追踪平台

数据血缘追踪平台，用于监控数据管道中每个字段从源表到目标表的完整转换路径。

## 项目架构

```
├── backend/                 # 后端Python项目
│   ├── api/                 # FastAPI REST API服务
│   ├── sql_parser/          # Spark SQL字段级血缘解析器
│   ├── dagger_integration/  # Dagger任务插桩代理
│   ├── graph_db/            # Neo4j图数据库适配器
│   ├── services/            # 业务服务（影响分析等）
│   ├── models/              # 数据模型定义
│   ├── examples/            # 示例代码
│   └── requirements.txt     # Python依赖
└── frontend/                # 前端React项目
    ├── src/
    │   ├── components/      # 组件（血缘图等）
    │   ├── pages/           # 页面组件
    │   └── utils/           # 工具函数（API封装）
    └── package.json         # Node.js依赖
```

## 核心功能

### 1. SQL解析模块 (`backend/sql_parser/`)
- 支持Spark SQL字段级血缘解析
- 解析join、filter、aggregate、project等操作
- 识别表别名和子查询
- 输出字段映射关系和转换类型

### 2. Dagger集成层 (`backend/dagger_integration/`)
- ETL任务装饰器 `@proxy.etl_job()`
- SQL操作装饰器 `@proxy.sql_operation()`
- 自动插桩记录字段映射
- Dagger容器包装器用于任务监控

### 3. Neo4j图数据库 (`backend/graph_db/`)
- 存储表、字段节点和转换关系边
- 支持上游/下游血缘查询
- 图遍历算法用于影响分析
- 任务元数据管理

### 4. 影响分析服务 (`backend/services/`)
- 字段级影响分析
- 表级影响汇总
- 批量变更影响对比
- 影响路径可视化

### 5. 前端血缘图谱 (`frontend/`)
- DAG可视化展示
- 字段点击查看详情
- 转换SQL溯源
- 上游/下游双向追踪

## 快速开始

### 前置要求

- Python 3.9+
- Node.js 16+
- Neo4j 5.x
- Docker（可选，用于Dagger）

### 启动后端服务

1. 安装依赖：
```bash
cd backend
pip install -r requirements.txt
```

2. 启动Neo4j（使用Docker）：
```bash
docker run -d \
  --name neo4j-lineage \
  -p 7474:7474 \
  -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:5.15.0
```

3. 启动API服务：
```bash
python -m backend.main
```

API文档地址：http://localhost:8000/docs

### 启动前端服务

1. 安装依赖：
```bash
cd frontend
npm install
```

2. 启动开发服务器：
```bash
npm start
```

前端地址：http://localhost:3000

## 使用示例

### 1. SQL解析演示

```bash
python backend/examples/sql_parser_demo.py
```

### 2. Dagger ETL任务演示

```bash
python backend/examples/dagger_etl_example.py
```

### 3. 通过API导入血缘

```bash
curl -X POST http://localhost:8000/api/lineage/store \
  -H "Content-Type: application/json" \
  -d '{
    "sql": "CREATE TABLE sales_summary AS SELECT o.order_date, c.customer_name, SUM(oi.amount) AS total FROM orders o JOIN customers c ON o.customer_id = c.customer_id GROUP BY o.order_date, c.customer_name",
    "job_id": "demo_job_001"
  }'
```

## API接口

### 血缘相关
- `POST /api/parse/sql` - 解析SQL获取血缘
- `POST /api/lineage/store` - 解析并存储血缘
- `GET /api/lineage/column` - 查询字段血缘
- `GET /api/lineage/graph` - 获取完整血缘图

### 元数据查询
- `GET /api/tables` - 获取所有表
- `GET /api/tables/{table}/columns` - 获取表字段

### 影响分析
- `POST /api/impact/analyze` - 分析影响
- `GET /api/impact/summary` - 获取影响摘要
- `POST /api/impact/batch` - 批量影响分析

### 其他
- `GET /api/transformation` - 获取转换详情
- `DELETE /api/data/clear` - 清空数据

## 核心技术栈

**后端：**
- FastAPI - REST API框架
- sqlglot - SQL解析库
- Neo4j - 图数据库
- Dagger - 任务编排

**前端：**
- React 18 - UI框架
- Ant Design - 组件库
- React Flow - 图可视化
- Dagre - 图布局算法

## 血缘数据模型

### 节点类型
- **Table** - 表节点
- **Column** - 字段节点  
- **Job** - ETL任务节点

### 关系类型
- `(Column)-[:TRANSFORMS_TO]->(Column)` - 字段转换关系
- `(Job)-[:READS_FROM]->(Table)` - 任务读表
- `(Job)-[:WRITES_TO]->(Table)` - 任务写表

### 属性
- 转换类型：select/join/aggregate/filter/project
- 转换逻辑描述
- SQL片段
- 关联Job ID

## 扩展开发

### 添加新的SQL方言支持

修改 `backend/sql_parser/spark_sql_parser.py` 中的 `dialect` 参数，或创建新的解析器类。

### 自定义Dagger任务模板

参考 `backend/examples/dagger_etl_example.py` 扩展装饰器功能。

### 前端定制可视化

修改 `frontend/src/components/LineageGraph.js` 中的节点渲染逻辑。

## 许可证

MIT License
