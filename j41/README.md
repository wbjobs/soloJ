# 分布式 Cron 任务调度系统

一个基于 Node.js + Redis 的分布式 Cron 任务调度系统，包含调度中心、多个 Worker 节点和前端管理面板。

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     前端管理面板 (React)                  │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│                    调度中心 (Node.js)                     │
│  - 任务管理 API (CRUD)                                    │
│  - Cron 调度触发                                          │
│  - Redis 分布式锁                                         │
│  - 任务队列分发                                           │
└────────────────────────────┬────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   Redis Server  │
                    │  - 任务队列      │
                    │  - 分布式锁      │
                    │  - 结果发布      │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
┌─────────▼────────┐ ┌───────▼────────┐ ┌──────▼────────┐
│   Worker 节点 1   │ │  Worker 节点 2  │ │  Worker 节点 N │
│  - 领取任务        │ │  - 领取任务      │ │  - 领取任务    │
│  - 执行 Shell 命令 │ │  - 执行命令      │ │  - 执行命令    │
│  - 返回执行结果    │ │  - 返回结果      │ │  - 返回结果    │
└───────────────────┘ └────────────────┘ └───────────────┘
```

## 功能特性

### 调度中心
- ✅ 任务管理 (增删改查)
  - Cron 表达式配置
  - Shell 执行命令
  - 超时时间设置
- ✅ 任务分发
  - 使用 Redis 分布式锁
  - 确保同一任务只被一个 Worker 领取
  - 基于队列的任务分发

### Worker 节点
- ✅ 两个独立的 Worker 服务
- ✅ 从 Redis 队列领取任务
- ✅ 执行 Shell 命令
- ✅ 超时控制
- ✅ 执行结果上报

### 前端管理面板
- ✅ 任务列表展示
- ✅ 最近执行状态显示
- ✅ 任务统计信息
- ✅ 执行日志查看
- ✅ 任务启停控制

## 快速开始

### 环境要求
- Node.js >= 16
- Redis >= 6 (或使用 Docker)
- Docker (可选，用于运行 Redis)

### 1. 安装依赖

```bash
npm run install:all
```

或者手动安装：

```bash
# 后端
cd backend && npm install

# Worker 1
cd ../worker1 && npm install

# Worker 2
cd ../worker2 && npm install

# 前端
cd ../frontend && npm install
```

### 2. 启动 Redis

使用 Docker：

```bash
npm run redis
```

或使用本地已安装的 Redis。

### 3. 启动服务

需要打开 4 个终端窗口：

**终端 1 - 调度中心:**
```bash
npm run backend
```

**终端 2 - Worker 1:**
```bash
npm run worker1
```

**终端 3 - Worker 2:**
```bash
npm run worker2
```

**终端 4 - 前端面板:**
```bash
npm run frontend
```

### 4. 访问系统

打开浏览器访问: http://localhost:5173

## API 接口

### 任务管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/tasks | 获取所有任务 |
| GET | /api/tasks/:id | 获取单个任务 |
| POST | /api/tasks | 创建任务 |
| PUT | /api/tasks/:id | 更新任务 |
| DELETE | /api/tasks/:id | 删除任务 |
| GET | /api/tasks/logs | 获取执行日志 |

### 创建任务示例

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试任务",
    "cronExpression": "*/10 * * * * *",
    "command": "echo Hello World",
    "timeout": 30
  }'
```

## Cron 表达式

标准 5 位 Cron 表达式:

```
┌───────────── 分钟 (0 - 59)
│ ┌───────────── 小时 (0 - 23)
│ │ ┌───────────── 日 (1 - 31)
│ │ │ ┌───────────── 月 (1 - 12)
│ │ │ │ ┌───────────── 星期 (0 - 7) (0 或 7 是周日)
│ │ │ │ │
* * * * *
```

扩展格式 (支持秒):

```
* * * * * *
│ │ │ │ │ │
│ │ │ │ │ └── 星期 (0 - 7)
│ │ │ │ └──── 月 (1 - 12)
│ │ │ └────── 日 (1 - 31)
│ │ └──────── 小时 (0 - 23)
│ └────────── 分钟 (0 - 59)
└──────────── 秒 (0 - 59)
```

## 分布式锁原理

系统使用 Redis 的 `SET NX EX` 命令实现分布式锁：

1. 调度中心触发任务时，尝试获取锁
2. `SET cron:lock:{taskId} {lockValue} NX EX {timeout}`
3. 如果获取锁成功，将任务放入队列
4. Worker 领取任务执行
5. 执行完成后，释放锁（验证锁持有者）

## 项目结构

```
j41/
├── backend/                 # 调度中心
│   ├── src/
│   │   ├── index.js         # 入口文件
│   │   ├── models/
│   │   │   └── TaskStore.js # 任务存储
│   │   ├── services/
│   │   │   ├── RedisService.js
│   │   │   └── SchedulerService.js
│   │   ├── controllers/
│   │   └── routes/
│   └── package.json
├── worker1/                 # Worker 节点 1
│   └── src/index.js
├── worker2/                 # Worker 节点 2
│   └── src/index.js
├── frontend/                # 前端管理面板
│   └── src/
│       ├── components/
│       └── App.jsx
├── docker-compose.yml
└── README.md
```

## 扩展建议

- [ ] 持久化存储任务 (MySQL/PostgreSQL/MongoDB)
- [ ] 任务重试机制
- [ ] 邮件/短信告警
- [ ] 任务依赖关系
- [ ] 动态扩容 Worker
- [ ] 任务执行统计报表
- [ ] 权限管理
