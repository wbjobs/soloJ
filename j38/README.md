# 多模态抑郁倾向筛查系统 (Multimodal Depression Screening System)

**⚠️ 仅供研究使用 - 不得用于临床诊断 ⚠️**

## 系统概述

本系统采用多模态融合技术，通过采集用户的视频、语音和文本数据，结合深度学习模型进行抑郁倾向分析。系统集成了联邦学习框架确保隐私保护，并提供完整的模型可解释性功能。

### 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     前端采集端 (React Native Web)       │
│  视频采集  │  音频采集  │  打字节奏采集  │  文本输入    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    后端AI服务 (FastAPI)                │
├─────────────┬─────────────┬─────────────┬─────────────┤
│  视觉模态   │  语音模态   │  文本模态   │   融合层    │
│ MediaPipe  │  Wav2Vec2.0│  BERT微调   │ 多头注意力 │
├─────────────┴─────────────┴─────────────┼─────────────┤
│              联邦学习 (Flower)          │  可解释性   │
│              本地训练 / 梯度上传        │  SHAP分析   │
├─────────────────────────────────────────┴─────────────┤
│              数据库 (MongoDB + Redis)                  │
│      历史记录存储      │     特征缓存 / 会话管理        │
└─────────────────────────────────────────────────────────┘
```

## 功能模块

### 1. 前端采集端 (React Native Web)

#### 页面组件
- **HomeScreen** - 系统首页，展示系统介绍、统计数据和功能入口
- **DataCollectionScreen** - 数据采集页面，整合视频、音频、打字三个采集模块
- **ResultsScreen** - 分析结果展示，包含评分仪表盘、置信度分析、各模态贡献
- **ExplainabilityScreen** - 可解释性可视化，SHAP特征重要性、决策路径追踪
- **HistoryScreen** - 历史记录查看，评分趋势图表、记录详情

#### 采集组件
- **VideoRecorder** - 视频采集组件，使用MediaRecorder API，实时预览、录制控制
- **AudioRecorder** - 音频采集组件，Web Audio API波形可视化
- **TypingCapture** - 打字节奏采集，记录按键时间、间隔、退格率等特征

### 2. 视觉模态分析
- **面部动作单元（AU）提取** - 使用MediaPipe FaceMesh检测17个关键AU
- **眼神回避时长统计** - 分析 gaze 方向和回避时间占比
- **微笑频率分析** - AU6和AU12组合检测
- **头部姿态估计** - Pitch/Yaw/Roll三角度分析
- **眨眼频率、皱眉频率** - 辅助特征

### 3. 语音模态分析
- **语速计算** - 每分钟音节数
- **基频范围分析** - F0均值、标准差、范围
- **停顿模式识别** - 停顿次数、平均时长、占比
- **语音质量特征** - Jitter、Shimmer、HNR
- **Wav2Vec 2.0** - 深度语音特征提取 + 自训练分类头

### 4. 文本模态分析
- **消极词汇频率统计** - 基于情感词典的负向词频
- **第一人称单数使用频率** - "我"、"我的"等词频分析
- **情感倾向分析** - 微调BERT模型
- **时态特征** - 过去/现在时态占比
- **语义复杂性** - 词汇丰富度、平均句长

### 5. 多模态融合层
- **特征投影** - 将视觉(23维)、语音(23维)、文本(18维)投影到统一64维空间
- **跨模态注意力** - Cross-Modal Attention捕捉模态间依赖
- **自注意力融合** - Self-Attention融合全局上下文
- **输出层** - 抑郁倾向评分(0-100)、置信区间、严重程度分类

### 6. 隐私保护 (联邦学习)
- **Flower框架集成** - 联邦学习客户端实现
- **本地训练** - 模型训练在本地完成
- **梯度上传** - 仅上传匿名梯度，原始数据不出本地
- **差分隐私** - 梯度扰动保护

### 7. 模型可解释性
- **SHAP值分析** - 基于博弈论的特征重要性量化
- **模态贡献权重** - 各模态对最终评分的贡献占比
- **特征重要性排序** - Top 10关键特征可视化
- **决策路径追踪** - 多步骤决策过程可视化

## 项目结构

```
.
├── backend/                          # 后端AI服务
│   ├── main.py                       # FastAPI入口
│   ├── requirements.txt              # Python依赖
│   └── app/
│       ├── config.py                 # 系统配置
│       ├── models.py                 # Pydantic数据模型
│       ├── database.py               # MongoDB + Redis封装
│       ├── api/
│       │   └── routes.py             # API路由定义
│       └── modules/
│           ├── visual.py             # 视觉模态分析
│           ├── audio.py              # 语音模态分析
│           ├── text.py               # 文本模态分析
│           ├── fusion.py             # 多头注意力融合
│           ├── explainability.py     # SHAP可解释性引擎
│           └── federated.py          # 联邦学习客户端
├── frontend/                         # 前端采集端
│   ├── package.json                  # Node.js依赖
│   ├── webpack.config.js             # Webpack配置
│   └── src/
│       ├── index.tsx                 # 应用入口
│       ├── types/                    # TypeScript类型定义
│       ├── services/api.ts           # API服务封装
│       ├── context/                  # React Context状态管理
│       ├── components/               # 采集组件
│       │   ├── VideoRecorder.tsx
│       │   ├── AudioRecorder.tsx
│       │   └── TypingCapture.tsx
│       └── screens/                  # 页面组件
│           ├── HomeScreen.tsx
│           ├── DataCollectionScreen.tsx
│           ├── ResultsScreen.tsx
│           ├── ExplainabilityScreen.tsx
│           └── HistoryScreen.tsx
├── docker-compose.yml                # Docker编排配置
└── README.md                         # 项目文档
```

## API接口说明

### 核心分析接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/analyze` | 完整多模态分析 |
| POST | `/api/v1/analyze/visual` | 视觉模态分析 |
| POST | `/api/v1/analyze/audio` | 语音模态分析 |
| POST | `/api/v1/analyze/text` | 文本模态分析 |
| POST | `/api/v1/fuse` | 多模态特征融合 |
| POST | `/api/v1/explain` | 获取可解释性分析 |

### 数据管理接口
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/records/{user_id}` | 获取用户历史记录 |
| GET | `/api/v1/session/{session_id}` | 获取会话详情 |
| DELETE | `/api/v1/session/{session_id}` | 清除会话数据 |
| GET | `/api/v1/statistics` | 获取系统统计数据 |

### 联邦学习接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/federated/train` | 本地训练并上传梯度 |
| GET | `/api/v1/federated/weights` | 获取最新全局模型权重 |

## 快速开始

### 环境要求
- Python 3.10+
- Node.js 18+
- Docker & Docker Compose (推荐)
- 支持WebRTC的现代浏览器

### 使用Docker启动（推荐）

```bash
# 克隆项目
git clone <repository-url>
cd multimodal-depression-screening

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

服务启动后：
- 前端：http://localhost:3000
- 后端API：http://localhost:8000
- API文档：http://localhost:8000/docs

### 手动启动

#### 1. 启动数据库
```bash
# MongoDB
docker run -d -p 27017:27017 mongo:6.0

# Redis
docker run -d -p 6379:6379 redis:7.0-alpine
```

#### 2. 启动后端服务
```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动服务
python main.py
```

#### 3. 启动前端服务
```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

## 评分说明

### 抑郁倾向评分 (0-100)
| 分数范围 | 严重程度 | 建议 |
|----------|----------|------|
| 0-25 | 无抑郁倾向 | 保持健康生活方式 |
| 26-50 | 轻度抑郁倾向 | 关注情绪变化，适当户外活动 |
| 51-75 | 中度抑郁倾向 | 建议寻求心理咨询帮助 |
| 76-100 | 重度抑郁倾向 | 强烈建议尽快就医 |

### 置信度
- 模型置信度：表示模型对本次预测的确定性
- 95%置信区间：真实评分可能的范围区间

## 隐私保护声明

1. **数据最小化**：仅采集分析所需的最少数据
2. **本地处理**：原始数据优先在本地处理
3. **联邦学习**：模型训练使用梯度，不上传原始数据
4. **数据加密**：传输和存储过程全程加密
5. **可删除性**：用户可随时请求删除个人数据

## 浏览器兼容性

| 浏览器 | 版本要求 | 视频采集 | 音频采集 |
|--------|----------|----------|----------|
| Chrome | 72+ | ✅ | ✅ |
| Firefox | 68+ | ✅ | ✅ |
| Safari | 14+ | ✅ | ✅ |
| Edge | 79+ | ✅ | ✅ |

⚠️ 注意：浏览器API需要HTTPS环境（localhost除外）

## 常见问题

**Q: 为什么浏览器请求摄像头/麦克风权限？**
A: 系统需要采集视频和音频数据进行多模态分析，所有数据仅用于本次分析。

**Q: 我的数据会被上传吗？**
A: 原始数据仅用于本次分析，联邦学习模式下仅上传匿名梯度用于模型改进。

**Q: 分析结果可以作为诊断依据吗？**
A: 不可以。本系统仅供研究使用，不能替代专业医疗诊断。

**Q: 如何删除我的数据？**
A: 可以通过API接口或联系管理员请求删除您的所有数据。

## 技术栈

### 后端
- **FastAPI** - 高性能Python Web框架
- **PyTorch** - 深度学习框架
- **Transformers** - HuggingFace模型库
- **MediaPipe** - 面部特征提取
- **Flower** - 联邦学习框架
- **SHAP** - 模型可解释性库
- **MongoDB** - 文档数据库
- **Redis** - 内存缓存

### 前端
- **React 18** - UI框架
- **React Native Web** - 跨平台组件库
- **React Navigation** - 页面导航
- **Lucide React** - 图标库
- **Axios** - HTTP客户端
- **Webpack** - 模块打包器

## 免责声明

本系统仅供学术研究使用，不构成任何医疗建议。如有抑郁相关症状，请及时咨询专业医疗机构。

研究用途说明：
- 本系统的预测结果仅用于研究目的
- 所有分析结果需要由专业人士解读
- 我们不对基于本系统结果做出的任何决策负责

## 引用

如在研究中使用本系统，请引用：
```
@software{multimodal_depression_screening,
  title = {Multimodal Depression Screening System},
  year = {2024},
  url = {<repository-url>}
}
```

## 许可证

MIT License

## 联系方式

如有问题或合作意向，请通过以下方式联系：
- 项目Issue：<repository-url>/issues
- 研究合作：research@example.com
