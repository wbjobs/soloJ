# 威胁情报知识图谱系统

## 项目概述

这是一个基于 Python（Flask + Neo4j + SpaCy）和 Cytoscape.js 的威胁情报知识图谱系统。该系统能够：
- 接收非结构化的威胁情报文本
- 使用 SpaCy NLP 提取实体（IP 地址、域名、攻击组织）
- 将实体和关系存储到 Neo4j 图数据库
- 使用 Cytoscape.js 在前端渲染知识图谱
- 支持节点拖拽、力导向布局、多种视图模式

## 技术栈

### 后端
- **Python 3.8+**
- **Flask 3.0** - Web 框架
- **Neo4j 5.x** - 图数据库
- **SpaCy 3.7** - NLP 实体提取
- **Flask-CORS** - 跨域支持
- **python-dotenv** - 环境变量管理

### 前端
- **Cytoscape.js 3.28** - 图谱渲染
- **cytoscape-dagre** - 布局算法
- **纯 HTML/CSS/JavaScript** - 无需构建工具

## 项目结构

```
j78/
├── backend/
│   ├── app.py              # Flask 应用主入口
│   ├── neo4j_db.py         # Neo4j 数据库连接和操作
│   ├── nlp_extractor.py    # SpaCy NLP 实体提取模块
│   ├── graph_service.py    # 知识图谱构建服务
│   ├── requirements.txt    # Python 依赖
│   └── .env                # 环境变量配置
└── frontend/
    └── index.html          # 前端页面（集成 Cytoscape.js）
```

## 快速开始

### 1. 安装 Neo4j 数据库

请确保已安装并启动 Neo4j 数据库：
- 下载地址：https://neo4j.com/download/
- 默认配置：`bolt://localhost:7687`
- 默认用户名：`neo4j`
- 默认密码：`password`（请修改为实际密码）

### 2. 安装 Python 依赖

```bash
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### 3. 配置环境变量

编辑 `backend/.env` 文件：

```
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
FLASK_HOST=0.0.0.0
FLASK_PORT=5000
```

### 4. 启动应用

```bash
cd backend
python app.py
```

### 5. 访问系统

打开浏览器访问：http://localhost:5000

## API 接口

### 1. 实体提取
- **接口**: `POST /api/extract`
- **描述**: 从威胁情报文本中提取 IP、域名、攻击组织实体
- **请求体**:
  ```json
  {
    "text": "APT28（Fancy Bear）使用 IP 192.168.1.100 和域名 malicious.com 进行攻击。"
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "entities": {
      "ips": ["192.168.1.100"],
      "domains": ["malicious.com"],
      "organizations": ["APT28", "Fancy Bear"]
    }
  }
  ```

### 2. 构建知识图谱
- **接口**: `POST /api/build-graph`
- **描述**: 提取实体并构建知识图谱，存储到 Neo4j
- **请求体**: 同上
- **响应**: 返回创建的节点和关系详情

### 3. 获取图谱数据
- **接口**: `GET /api/graph`
- **描述**: 获取所有图谱数据（节点和边）
- **响应**:
  ```json
  {
    "success": true,
    "data": {
      "nodes": [
        {"id": "...", "type": "ip", "name": "192.168.1.100", "label": "IP"}
      ],
      "edges": [
        {"source": "...", "target": "...", "relationship": "USES_IP"}
      ]
    }
  }
  ```

### 4. 清空图谱
- **接口**: `DELETE /api/graph/clear`
- **描述**: 清空 Neo4j 数据库中的所有数据

### 5. 健康检查
- **接口**: `GET /api/health`
- **描述**: 检查服务运行状态

## 前端功能

### 主要功能
1. **文本输入**: 输入非结构化威胁情报文本
2. **示例文本**: 内置 3 个示例文本，一键加载
3. **实体提取**: 点击按钮提取并显示提取到的实体
4. **构建图谱**: 将实体和关系存储到数据库并渲染
5. **图谱渲染**: 使用 Cytoscape.js 可视化展示
6. **节点拖拽**: 拖拽节点调整位置，释放后锁定
7. **多种布局**: 支持 cose、concentric、breadthfirst、circle 四种布局
8. **缩放控制**: 支持滚轮缩放和按钮缩放
9. **图谱统计**: 实时显示节点数和关系数
10. **清空图谱**: 一键清空所有数据

### 节点类型
- **🔵 IP 地址** - 蓝色圆形
- **🟢 域名** - 绿色圆形
- **🟣 攻击组织** - 紫色圆形（较大）

### 关系类型
- **USES_IP**: 组织 → IP
- **USES_DOMAIN**: 组织 → 域名
- **RESOLVES_TO**: IP → 域名

## 实体提取规则

### IP 地址提取
- 使用正则表达式匹配 IPv4 地址
- 匹配格式：`xxx.xxx.xxx.xxx`（0-255）

### 域名提取
- 支持常见顶级域名：.com, .org, .net, .io, .cn 等
- 支持多级域名：example.com, sub.example.com.cn

### 攻击组织提取
1. **SpaCy NER**: 识别 ORG、PERSON、GPE 类型实体
2. **关键词匹配**: 内置 80+ 已知攻击组织名称（APT 系列、勒索软件团伙等）
3. **模式匹配**: 匹配包含 "APT"、"Bear"、"Team"、"Group" 等关键词的组织名

### 关系推断
- 基于实体共现（窗口大小约 400 字符）
- 组织与 IP/域名在相近位置出现 → USES_IP/USES_DOMAIN
- IP 与域名在相近位置出现 → RESOLVES_TO

## 使用示例

### 示例 1：APT 组织攻击

输入文本：
```
APT28（也称为Fancy Bear）是一个俄罗斯黑客组织。该组织使用IP地址192.168.1.100
和域名command-control-server.com进行攻击活动。Cozy Bear组织（APT29）使用IP
8.8.8.8和域名cozybear-apt29.org对政府机构发起间谍活动。
```

提取结果：
- IP: `192.168.1.100`, `8.8.8.8`
- 域名: `command-control-server.com`, `cozybear-apt29.org`
- 组织: `APT28`, `Fancy Bear`, `Cozy Bear`, `APT29`

### 示例 2：勒索软件攻击

输入文本：
```
Conti勒索软件团伙使用IP地址185.220.101.33和域名conti-ransomware.com进行
勒索攻击。REvil团伙使用IP 91.121.85.103和域名revil-group.org进行双重勒索。
```

## 故障排除

### Neo4j 连接失败
1. 确认 Neo4j 服务已启动
2. 检查 `.env` 中的连接配置
3. 确认用户名密码正确

### SpaCy 模型加载失败
```bash
python -m spacy download en_core_web_sm
```

### 端口被占用
修改 `.env` 中的 `FLASK_PORT` 或关闭占用端口的程序

## 注意事项

1. 本系统使用简单的 NLP 方法进行实体提取，对于复杂文本可能存在误识别
2. 关系推断基于共现规则，可能存在误关联
3. 建议在生产环境中：
   - 使用更专业的威胁情报 NLP 模型
   - 添加人工审核机制
   - 实现增量更新而非全量重建
   - 添加用户认证和权限控制

## License

MIT License
