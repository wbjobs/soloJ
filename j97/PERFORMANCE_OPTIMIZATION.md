# 性能优化说明

## 问题分析

在加载大型蛋白质复合物（原子数 > 50,000）时，前端渲染出现以下问题：
- 帧率低于 10 FPS，严重卡顿
- Three.js render 函数占用过高 CPU/GPU
- 显存占用异常飙升

## 根本原因

1. **Draw Call 过多**：每个原子和化学键都创建独立的 Mesh 对象
2. **内存浪费**：相同的几何体和材质被重复创建
3. **阴影计算开销**：所有对象都投射和接收阴影
4. **几何体细分过高**：球体和圆柱体使用过多多边形

## 优化方案

### 1. InstancedMesh 批量渲染 (原子渲染)

**优化前**：
- N 个原子 = N 个 Mesh + N 个 Material + N 个 Geometry
- Draw Call 数量 = 原子数量
- 50,000 原子 = 50,000+ Draw Calls

**优化后**：
- 按元素类型分组（C, H, O, N, S, P）
- 每种元素使用一个 InstancedMesh
- 共享几何体和材质
- Draw Call 数量 = 元素类型数量（通常 4-6 个）
- 50,000 原子 = 4-6 Draw Calls

**代码位置**：[app.js](file:///e:/soloJ/j97/public/app.js#L173-L215) `createBallStick()` 方法

### 2. InstancedMesh 批量渲染 (化学键)

**优化前**：
- M 个化学键 = M 个 CylinderMesh
- Draw Call 数量 = 化学键数量

**优化后**：
- 所有化学键使用一个 InstancedMesh
- Draw Call 数量 = 1

**代码位置**：[app.js](file:///e:/soloJ/j97/public/app.js#L238-L290) `createBondsOptimized()` 方法

### 3. 几何体和材质共享

**优化前**：
- 每个原子创建新的 SphereGeometry
- 每个化学键创建新的 CylinderGeometry
- 大量重复的内存分配

**优化后**：
- 全局缓存共享几何体 (`sharedGeometries`)
- 全局缓存共享材质 (`sharedMaterials`)
- 按质量等级（low/medium/high）区分几何体
- 大幅减少内存占用和 GC 压力

**代码位置**：[app.js](file:///e:/soloJ/j97/public/app.js#L96-L134) `getSharedSphereGeometry()`, `getSharedCylinderGeometry()`, `getSharedMaterial()` 方法

### 4. 自动性能模式

根据原子数量自动切换渲染质量：

| 原子数量 | 模式 | 几何体细分 | 材质类型 | 化学键渲染 | 阴影 |
|---------|------|-----------|----------|-----------|------|
| < 10,000 | 正常模式 | 球体 16段，圆柱 8段 | Phong (高光) | 圆柱体 | 启用 |
| > 10,000 | 性能模式 | 球体 8段，圆柱 6段 | Lambert (无高光) | 线条 | 禁用 |

**代码位置**：[app.js](file:///e:/soloJ/j97/public/app.js#L176-L181)

### 5. 其他优化

1. **像素比限制**：`setPixelRatio(Math.min(devicePixelRatio, 2))`
   - 高 DPI 屏幕显存占用减少 50%+

2. **高性能模式**：`powerPreference: 'high-performance'`
   - 提示浏览器使用独立 GPU

3. **阴影默认禁用**：大幅减少渲染负担

4. **静态绘制优化**：`instanceMatrix.setUsage(THREE.StaticDrawUsage)`
   - 静态对象 GPU 内存优化

## 性能提升预估

| 指标 | 优化前 | 优化后 | 提升倍数 |
|------|--------|--------|---------|
| Draw Calls (50k 原子) | ~50,000+ | ~5 | **10,000x** |
| 内存占用 (几何体) | O(N) | O(1) | **显著** |
| 内存占用 (材质) | O(N) | O(1) | **显著** |
| 帧率 (50k 原子) | < 10 FPS | > 60 FPS | **6x+** |

## 使用说明

应用会自动根据加载的蛋白质大小选择最优的渲染配置：

1. **小分子** (< 10,000 原子)：最高质量渲染
2. **大分子** (> 10,000 原子)：自动启用性能模式

在侧边栏统计信息中可以看到是否启用了性能模式。
