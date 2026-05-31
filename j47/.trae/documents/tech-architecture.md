## 1. 架构设计

```mermaid
flowchart TB
    subgraph "前端 (React + Three.js)"
        "A[文件上传组件]" --> "B[API调用 - 文件上传]"
        "C[Three.js 渲染引擎]" --> "D[OrbitControls 视角控制]"
        "C" --> "E[点云渲染器]"
        "C" --> "F[框选工具 - BoxSelector]"
        "G[Zustand 状态管理]" --> "C"
        "G" --> "H[信息面板]"
    end
    subgraph "后端 (Express)"
        "I[文件上传接口 /api/upload]" --> "J[multer 文件处理]"
        "J" --> "K[PLY解析器]"
        "J" --> "L[OBJ解析器]"
        "K" --> "M[点云数据格式化]"
        "L" --> "M"
        "M" --> "N[返回JSON/Buffer]"
    end
    "B" --> "I"
    "N" --> "G"
```

## 2. 技术说明

- **前端**：React@18 + Three.js + @react-three/fiber + @react-three/drei + tailwindcss@3 + vite
- **初始化工具**：vite-init (react-express-ts 模板)
- **后端**：Express@4 + TypeScript (ESM)
- **3D渲染**：Three.js (通过 @react-three/fiber 封装)
- **状态管理**：Zustand
- **文件解析**：后端使用自定义解析器处理 PLY/OBJ 格式
- **文件上传**：multer 中间件

## 3. 路由定义

| 路由 | 用途 |
|------|------|
| / | 查看器主页面 |

## 4. API 定义

### 4.1 文件上传接口

```typescript
// POST /api/upload
// Content-Type: multipart/form-data
interface UploadRequest {
  file: File; // .ply 或 .obj 文件
}

interface UploadResponse {
  success: boolean;
  data?: {
    points: number;          // 点数量
    positions: Float32Array;  // 顶点坐标 [x,y,z, x,y,z, ...]
    colors?: Float32Array;    // 顶点颜色 [r,g,b, r,g,b, ...] (0-1)
    normals?: Float32Array;   // 法线向量
    boundingBox: {
      min: [number, number, number];
      max: [number, number, number];
    };
  };
  error?: string;
}
```

### 4.2 健康检查接口

```typescript
// GET /api/health
interface HealthResponse {
  status: 'ok';
  timestamp: number;
}
```

## 5. 服务端架构图

```mermaid
flowchart LR
    "A[Express Router]" --> "B[Upload Controller]"
    "B" --> "C[PLY Parser Service]"
    "B" --> "D[OBJ Parser Service]"
    "C" --> "E[Response Formatter]"
    "D" --> "E"
```

## 6. 数据模型

本项目无需数据库，数据流为：用户上传文件 → 后端解析 → 返回点云数据 → 前端渲染。所有数据仅在请求生命周期内处理，不做持久化存储。

### 6.1 前端状态模型

```typescript
interface PointCloudState {
  file: File | null;
  isLoading: boolean;
  pointCloudData: {
    positions: Float32Array;
    colors: Float32Array | null;
    normals: Float32Array | null;
    boundingBox: { min: [number, number, number]; max: [number, number, number] };
    pointCount: number;
  } | null;
  selectionMode: boolean;
  selectionBox: { min: [number, number, number]; max: [number, number, number] } | null;
  selectedPointCount: number;
  pointSize: number;
  colorMode: 'original' | 'height' | 'normal';
  setFile: (file: File | null) => void;
  setPointCloudData: (data: PointCloudState['pointCloudData']) => void;
  setSelectionMode: (mode: boolean) => void;
  setSelectionBox: (box: PointCloudState['selectionBox']) => void;
  setSelectedPointCount: (count: number) => void;
  setPointSize: (size: number) => void;
  setColorMode: (mode: PointCloudState['colorMode']) => void;
  reset: () => void;
}
```
