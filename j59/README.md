# 3D 点云可视化编辑器

一个基于 Three.js 和 React 构建的 3D 点云可视化编辑器，后端使用 FastAPI 提供 LAS/LAZ 格式点云数据服务。

## 功能特性

- ✅ **大规模点云渲染**：使用自定义 WebGL Shader 渲染数百万级点云数据
- ✅ **LAS/LAZ 格式支持**：后端使用 laspy 读取标准激光雷达点云格式
- ✅ **八叉树 LOD 动态加载**：基于视距的细节层次加载，有效控制显存占用
- ✅ **视锥体剔除**：仅加载可视区域内的点云节点
- ✅ **3D 框选工具**：改进的拾取算法，支持稀疏区域点云选择
- ✅ **点云智能分类**：基于 RGB 颜色或反射强度自动分类
- ✅ **分类图例控制**：实时切换分类显示，支持单独显示/隐藏
- ✅ **实时统计计算**：计算选定点云区域的点数量、平均高度、体积等
- ✅ **结果持久化**：将统计结果保存到后端数据库
- ✅ **多种着色模式**：高度着色、原始颜色、强度、分类
- ✅ **文件上传**：支持上传自定义 LAS/LAZ 文件


## 🔧 问题修复

### 1. 显存溢出问题修复
**问题**：加载超过 1000 万个点时，显存溢出导致浏览器崩溃

**解决方案**：
- 实现了基于八叉树的空间分区和 LOD（细节层次）系统
- 根据相机距离动态加载不同精度的点云节点
- 仅加载视锥体内的可见节点，不可见区域自动卸载
- 默认配置下，每帧渲染点数控制在约 150 万以内

**核心文件**：
- 后端：[octree.py](file:///e:/soloJ/j59/backend/app/octree.py)
- 前端 Hook：[useLODPointCloud.js](file:///e:/soloJ/j59/frontend/src/hooks/useLODPointCloud.js)
- 前端组件：[LODPointCloud.jsx](file:///e:/soloJ/j59/frontend/src/components/LODPointCloud.jsx)

### 2. 框选稀疏区域无法选中 Bug 修复
**问题**：射线检测 (Raycaster) 在点云稀疏区域无法命中任何点

**解决方案**：
- 改进的混合拾取算法：先尝试拾取最近点（带阈值），失败则回退到选择平面
- 增加 5 个单位的拾取距离阈值，提高命中率
- 最小选择框保护（小于 0.5 单位自动扩展）
- 半透明选择平面提供视觉参考和交互基准

**核心文件**：
- [ImprovedBoxSelection.jsx](file:///e:/soloJ/j59/frontend/src/components/ImprovedBoxSelection.jsx)

## 技术架构

### 后端 (Python)
- **FastAPI**：高性能 Web API 框架
- **laspy**：LAS/LAZ 点云文件读写
- **NumPy**：数值计算和点云处理
- **SQLAlchemy**：ORM 数据库操作
- **SQLite**：轻量级数据库存储结果

### 前端 (React)
- **React 18**：UI 框架
- **Three.js**：3D 渲染引擎
- **@react-three/fiber**：Three.js React 渲染器
- **@react-three/drei**：Three.js 辅助组件库
- **Zustand**：轻量级状态管理
- **自定义 GLSL Shader**：优化点云渲染性能

## 项目结构

```
j59/
├── backend/                          # 后端服务
│   ├── main.py                      # FastAPI 入口
│   ├── requirements.txt             # Python 依赖
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py              # 数据库配置
│   │   ├── models.py                # SQLAlchemy 模型
│   │   ├── schemas.py               # Pydantic 数据模型
│   │   ├── pointcloud_service.py    # 点云处理核心逻辑
│   │   └── routers.py               # API 路由
│   ├── data/                        # 点云数据目录
│   ├── uploads/                     # 上传文件临时目录
│   └── scripts/
│       ├── generate_sample_data.py  # 示例数据生成器
│       └── test_backend.py          # 后端测试脚本
└── frontend/                         # 前端应用
    ├── package.json                 # Node.js 依赖
    ├── vite.config.js               # Vite 配置
    ├── index.html                   # HTML 入口
    └── src/
        ├── main.jsx                 # React 入口
        ├── App.jsx                  # 主应用组件
        ├── store.js                 # Zustand 状态管理
        ├── services/
        │   └── api.js               # API 服务封装
        ├── utils/
        │   └── pointCloudLoader.js  # 点云加载和处理工具
        ├── shaders/
        │   ├── pointCloudVertex.glsl    # 顶点着色器
        │   └── pointCloudFragment.glsl  # 片段着色器
        └── components/
            ├── Scene.jsx              # 3D 场景组件
            ├── PointCloud.jsx         # 点云渲染组件
            ├── PointCloudMaterial.jsx # 自定义材质
            ├── SelectionBox.jsx       # 选择框显示组件
            ├── BoxSelectionTool.jsx   # 框选交互工具
            └── ControlPanel.jsx       # UI 控制面板
```

## 快速开始

### 1. 生成示例点云数据

```powershell
cd backend/scripts
python generate_sample_data.py
```

这将在 `backend/data/` 目录生成两个示例文件：
- `sample_terrain.las`（20万点，地形+建筑）
- `sample_sphere.las`（15万点，球体）

### 2. 启动后端服务

```powershell
cd backend
pip install -r requirements.txt
python main.py
```

后端将在 `http://localhost:8000` 启动。

API 文档：`http://localhost:8000/docs`

### 3. 启动前端服务

```powershell
cd frontend
npm install
npm run dev
```

前端将在 `http://localhost:3000` 启动。

## 使用说明

### 1. 加载点云
- 在左侧面板点击点云文件列表中的项目
- 或点击"上传 LAS/LAZ"按钮上传自定义文件

### 2. 3D 导航
- **鼠标左键拖动**：旋转视角
- **鼠标右键拖动**：平移视角
- **滚轮**：缩放

### 3. 框选区域
1. 点击"📦 开启选择模式"按钮
2. 在 3D 视图中按住鼠标左键拖动
3. 释放鼠标完成选择
4. 查看统计结果（点数量、平均高度、体积等）

### 4. 保存结果
1. 选择区域后，可添加备注
2. 点击"💾 保存结果"按钮提交到后端
3. 在"已保存的结果"列表中查看历史记录

### 5. 渲染设置
- **点大小**：调整点云渲染点的尺寸
- **着色模式**：
  - 高度着色：根据 Z 坐标显示渐变色
  - 原始颜色：使用点云自带的 RGB 颜色
  - 强度：使用激光反射强度（灰度）
  - 分类：使用点云分类码（地面、植被、建筑等）

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/pointclouds` | 获取点云文件列表 |
| GET | `/api/pointclouds/{name}` | 获取点云基本信息 |
| GET | `/api/pointclouds/{name}/tile` | 获取点云切片数据 |
| POST | `/api/pointclouds/{name}/compute-stats` | 计算选定区域统计信息 |
| POST | `/api/selection` | 保存选择结果 |
| GET | `/api/selection` | 获取所有保存的结果 |
| DELETE | `/api/selection/{id}` | 删除指定结果 |
| POST | `/api/upload` | 上传 LAS/LAZ 文件 |

## 自定义着色器说明

项目使用自定义 GLSL 着色器优化点云渲染：

**顶点着色器** (`pointCloudVertex.glsl`)：
- 实现基于距离的点大小衰减
- 支持多种着色模式切换
- 高度着色使用 6 色渐变（蓝→青→绿→黄→橙→红）
- 分类着色遵循 ASPRS 标准

**片段着色器** (`pointCloudFragment.glsl`)：
- 圆形点渲染（丢弃方形边角）
- 平滑边缘抗锯齿
- 加法混合提升视觉效果

## 大规模点云优化策略

1. **LOD（细节层次）**：根据视图距离动态调整点密度
2. **空间切片**：仅加载可视范围内的点云数据
3. **中心化坐标**：将点云移到原点附近，减少浮点数精度问题
4. **WebGL 实例化**：使用 BufferGeometry 批量渲染
5. **加法混合**：提升密集点云区域的视觉效果

## 🏷️ 点云分类功能

### 分类方法

1. **RGB 颜色分类**
   - 基于 HSV 颜色空间分析
   - 绿色识别：植被（树木、草地）
   - 红色主导：建筑物
   - 蓝色主导：水体
   - 低饱和度：地面、道路

2. **反射强度分类**
   - 基于激光返回强度值
   - 结合高度信息辅助判断
   - 高强度：建筑、硬表面
   - 中强度：植被
   - 低强度：噪声、水面

### 分类类型

| ID | 名称 | 颜色 | 说明 |
|----|------|------|------|
| 1 | 未分类 | 灰色 | 未分类点云 |
| 2 | 地面 | 棕色 | 地表、土壤 |
| 3 | 低植被 | 深绿色 | 草地、低矮灌木 |
| 4 | 中植被 | 绿色 | 中等高度灌木 |
| 5 | 高植被 | 墨绿色 | 树木、森林 |
| 6 | 建筑 | 红色 | 建筑物、房屋 |
| 7 | 噪声 | 紫色 | 异常点、噪声 |
| 9 | 水体 | 蓝色 | 水域、河流 |
| 11 | 道路 | 灰色 | 道路、铺装地面 |

### 使用方法

1. 加载点云后，在右上角分类图例中选择分类方法
2. 点击「执行分类」按钮开始分类
3. 完成后会显示各类别的统计信息和占比
4. 勾选/取消勾选复选框可控制单个类别的显示
5. 在左侧控制面板选择「分类」着色模式查看分类效果

### 新增 API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/classification/rules` | 获取分类规则列表 |
| POST | `/api/pointclouds/{name}/classify` | 执行点云分类 |
| GET | `/api/pointclouds/{name}/classification` | 获取分类结果 |


## 扩展建议

- [ ] 实现真正的 Potree 八叉树层次结构
- [ ] 添加点云编辑功能（手动调整分类）
- [ ] 支持测量工具（距离、面积）
- [ ] 添加剖面分析功能
- [ ] 实现点云密度动态调整
- [ ] 添加导出功能（CSV、LAS）
- [ ] 训练自定义分类模型
- [ ] 支持分类结果导入导出

## 许可证

MIT License
