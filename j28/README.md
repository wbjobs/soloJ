# 混沌工程实验平台

一个基于Spring Boot和Vue 3的混沌工程实验管理平台，支持通过YAML配置文件定义实验场景，集成服务发现，提供实时指标监控和实验审批流程。

## 功能特性

### 核心功能
- **YAML实验配置**: 支持通过YAML配置文件定义各种实验场景
- **多种故障注入**:
  - 延迟注入（Latency Injection）
  - Pod杀掉（Pod Kill）
  - CPU负载（CPU Load）
  - 内存负载（Memory Load）
  - 异常注入（Exception Injection）
- **服务发现集成**: 支持Consul和Etcd服务发现
- **实验生命周期管理**: 从创建、审批、执行到回滚的完整流程
- **实时指标监控**: 记录实验前后的业务指标和系统指标
- **自动回滚机制**: 支持基于阈值的自动故障停止
- **审批流程**: 实验需管理员审批后才能执行

### 指标监控
- 业务指标：RPS、P99延迟、错误率
- 系统指标：CPU使用率、内存使用率
- 实时图表对比展示

## 技术栈

### 后端
- Java 17
- Spring Boot 3.2.0
- Spring Data JPA
- H2 Database（开发）/ MySQL 8.0（生产）
- Chaos Monkey for Spring Boot
- Consul / Etcd 客户端
- JWT 认证

### 前端
- Vue 3
- Vite
- Element Plus
- ECharts + vue-echarts
- Pinia
- Axios
- YAML 解析

## 项目结构

```
.
├── backend/                 # Spring Boot 后端项目
│   ├── src/main/java/com/chaos/platform/
│   │   ├── controller/      # REST API 控制器
│   │   ├── service/         # 业务逻辑服务
│   │   ├── repository/      # 数据访问层
│   │   ├── entity/          # 实体类
│   │   ├── dto/             # 数据传输对象
│   │   ├── chaos/           # 故障注入策略
│   │   ├── config/          # 配置类
│   │   └── exception/       # 异常处理
│   └── pom.xml
│
├── frontend/                # Vue 3 前端项目
│   ├── src/
│   │   ├── views/           # 页面组件
│   │   ├── components/      # 通用组件
│   │   ├── api/             # API 接口
│   │   ├── router/          # 路由配置
│   │   ├── store/           # 状态管理
│   │   ├── utils/           # 工具函数
│   │   └── styles/          # 样式文件
│   └── package.json
│
└── .trae/documents/         # 项目文档
    ├── PRD.md               # 产品需求文档
    └── technical-architecture.md  # 技术架构文档
```

## 快速开始

### 后端启动

```bash
cd backend

# 使用Maven构建
mvn clean package

# 运行应用
mvn spring-boot:run
```

后端服务将在 http://localhost:8080 启动

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建生产版本
npm run build
```

前端开发服务将在 http://localhost:5173 启动

## 主要页面

1. **仪表盘**: 实验统计概览、执行趋势图、故障类型分布
2. **实验列表**: 所有实验的管理页面，支持状态筛选和操作
3. **创建实验**: YAML配置编辑器 + 表单配置
4. **实验详情**: 实时指标图表、配置查看、执行控制
5. **审批中心**: 待审批实验列表和审批历史
6. **服务管理**: 已发现服务实例展示

## YAML 实验配置示例

```yaml
apiVersion: chaos.platform/v1
kind: ChaosExperiment
metadata:
  name: order-service-latency
  description: 对订单服务注入5秒延迟
spec:
  target:
    serviceDiscovery: consul
    serviceName: order-service
    instances: all
  
  chaosType: latency
  duration: 300s
  autoRollback: true
  
  latencyConfig:
    latencyMs: 5000
    percentage: 100
  
  rollbackConditions:
    errorRateThreshold: 50
    timeoutSeconds: 600
```

## API 接口

### 实验管理
- `GET /api/experiments` - 获取实验列表
- `GET /api/experiments/{id}` - 获取实验详情
- `POST /api/experiments` - 创建实验
- `POST /api/experiments/{id}/start` - 开始实验
- `POST /api/experiments/{id}/stop` - 停止实验

### 审批管理
- `GET /api/approvals/pending` - 待审批列表
- `POST /api/approvals/{id}/approve` - 审批通过
- `POST /api/approvals/{id}/reject` - 审批拒绝

### 指标查询
- `GET /api/metrics/experiment/{id}` - 实验指标
- `GET /api/metrics/experiment/{id}/realtime` - 实时指标

### 服务发现
- `GET /api/services` - 所有服务实例
- `POST /api/services/refresh` - 刷新服务列表

## 数据库设计

### 核心表
- `experiments` - 实验主表
- `experiment_metrics` - 实验指标数据表
- `approvals` - 审批记录表
- `service_instances` - 服务实例表

## 开发说明

### 故障注入扩展
要添加新的故障类型，只需实现 `ChaosInjectionStrategy` 接口：

```java
@Component
public class CustomChaos implements ChaosInjectionStrategy {
    
    @PostConstruct
    public void init() {
        experimentExecutor.registerStrategy(getType(), this);
    }
    
    @Override
    public void inject(String experimentId, String configYaml) {
        // 故障注入逻辑
    }
    
    @Override
    public void rollback(String experimentId) {
        // 回滚逻辑
    }
    
    @Override
    public String getType() {
        return "customChaos";
    }
}
```

## License

MIT License
