## 1. 架构设计

```mermaid
graph TD
    subgraph "前端 (React + Vite)"
        A["日志看板页面"]
        B["WebSocket 连接管理"]
        C["日志状态管理 (Zustand)"]
        D["过滤逻辑"]
        E["日志列表组件"]
    end
    
    subgraph "后端 (Node.js + Express + TypeScript)"
        F["Express HTTP 服务器"]
        G["WebSocket 服务 (ws)"]
        H["日志模拟器 (3个服务)"]
        I["日志存储服务"]
        J["数据库连接池"]
    end
    
    subgraph "数据层"
        K["SQLite 数据库"]
    end
    
    subgraph "共享"
        L["类型定义 (shared/types)"]
    end
    
    A --> B
    B --> C
    C --> D
    D --> E
    
    B <-->|WebSocket| G
    H -->|日志数据| G
    H -->|日志数据| I
    I --> J
    J --> K
    
    L --> A
    L --> H
    L --> I
```

## 2. 技术描述

- 前端：React@18 + TypeScript + Vite + TailwindCSS@3 + Zustand + lucide-react
- 后端：Express@4 + TypeScript + ws (WebSocket) + better-sqlite3
- 数据库：SQLite (better-sqlite3)
- 构建工具：Vite
- 包管理器：npm

## 3. 路由定义

| 路由 | 用途 |
|-------|---------|
| / | 日志看板主页 |
| /ws | WebSocket 连接端点 |
| /api/logs | HTTP 获取历史日志 (REST API) |

## 4. API 定义

### 4.1 WebSocket 消息协议

```typescript
// 共享类型定义 shared/types.ts
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: number;
  serviceName: string;
  level: LogLevel;
  message: string;
}

export interface WebSocketMessage {
  type: 'log' | 'history' | 'status';
  data: LogEntry | LogEntry[] | { connected: boolean; count: number };
}
```

### 4.2 HTTP API

```typescript
// GET /api/logs
interface GetLogsRequest {
  serviceName?: string;
  level?: LogLevel;
  limit?: number;
  offset?: number;
}

interface GetLogsResponse {
  logs: LogEntry[];
  total: number;
}
```

## 5. 服务器架构图

```mermaid
graph TD
    A["HTTP 服务器 (Express)"] --> B["静态文件服务"]
    A --> C["REST API 路由"]
    A --> D["WebSocket 升级"]
    
    D --> E["WebSocket 连接管理器"]
    E --> F["客户端连接池"]
    
    G["日志模拟器"] --> H["日志生成器 (服务A/B/C)"]
    H --> I["日志分发器"]
    I --> E
    I --> J["日志持久化服务"]
    
    C --> K["日志查询控制器"]
    K --> L["日志仓储层"]
    J --> L
    L --> M["SQLite 数据库"]
```

## 6. 数据模型

### 6.1 数据模型定义

```mermaid
erDiagram
    LOGS {
        string id PK "主键 UUID"
        datetime timestamp "日志时间戳"
        string service_name "服务名称"
        string level "日志级别"
        text message "原始消息"
        datetime created_at "入库时间"
    }
```

### 6.2 数据定义语言

```sql
-- migrations/001_init.sql
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  service_name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
  message TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_service_name ON logs(service_name);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);

-- 初始化完成标记
INSERT INTO schema_migrations (version, name) VALUES ('001', 'init');
```

### 6.3 数据库初始化脚本

```typescript
// api/db/init.ts
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  
  // 执行迁移脚本
  const migrationsDir = path.join(__dirname, '../../migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
    
  for (const file of migrationFiles) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
  }
  
  return db;
}
```
