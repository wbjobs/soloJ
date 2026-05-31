# 🎨 实时视频风格迁移应用

基于 ONNX.js + WebGL + MediaPipe 的纯浏览器端实时视频风格迁移应用。

## ✨ 特性

- **10种预置艺术风格**：马赛克、糖果、雨公主、乌迪内、点彩画、呐喊、缪斯、海浪、星夜、神奈川冲浪里
- **实时风格切换**：点击风格卡片即可实时切换
- **风格强度调节**：0-100% 滑动条线性插值控制
- **人脸区域保护**：基于 MediaPipe 人脸检测，只对背景应用风格
- **人脸边缘羽化**：可调节人脸mask的模糊半径，实现自然过渡
- **WebGL加速渲染**：使用WebGL Shader进行后处理混合
- **性能监控面板**：实时显示FPS、推理时间、总耗时、分辨率
- **多分辨率支持**：480p / 720p / 1080p

## 🚀 快速开始

### 前置要求

- 现代浏览器（Chrome/Edge/Firefox 最新版本）
- 摄像头设备
- 本地Web服务器（由于使用了ES Modules，不能直接打开HTML文件）

### 本地运行

#### 方式1：使用 Python
```bash
cd e:\soloJ\j20
python -m http.server 8000
```

#### 方式2：使用 Node.js
```bash
npx serve .
```

#### 方式3：使用 VS Code Live Server 插件

然后在浏览器访问 `http://localhost:8000`

## 📁 项目结构

```
j20/
├── index.html                    # 主页面
├── styles/
│   └── main.css                  # 样式文件
├── src/
│   ├── main.js                   # 主应用入口
│   ├── videoCapture.js           # 视频采集组件
│   ├── modelManager.js           # 模型管理模块
│   ├── inferencePipeline.js      # 推理流水线
│   ├── faceMaskGenerator.js      # 人脸mask生成器
│   ├── styleProcessor.js         # WebGL风格处理器
│   └── performanceMonitor.js     # 性能监控面板
└── README.md
```

## 🎮 使用说明

1. **开启摄像头**：点击"📹 开启摄像头"按钮
2. **选择风格**：点击右侧风格卡片选择喜欢的艺术风格（首次选择需要下载模型）
3. **调节强度**：拖动"风格强度"滑动条调节风格化程度
4. **人脸保护**：开启/关闭人脸区域保护开关
5. **调节羽化**：调整人脸边缘羽化值使人脸与背景过渡更自然
6. **切换分辨率**：在摄像头设置中选择合适的分辨率

## ⚙️ 技术架构

### 核心组件

| 组件 | 功能 | 技术栈 |
|------|------|--------|
| VideoCapture | 摄像头视频流采集 | MediaDevices API |
| ModelManager | ONNX模型加载与管理 | ONNX Runtime Web |
| InferencePipeline | 视频帧预处理、推理、后处理 | ONNX.js |
| FaceMaskGenerator | 人脸检测与mask生成 | MediaPipe Face Detection |
| StyleProcessor | 风格混合、Shader后处理 | WebGL |
| PerformanceMonitor | 性能指标监控 | performance API |

### 处理流程

```
摄像头视频流
    ↓
[VideoCapture]
    ↓
┌──────────────────────────────────┐
│         并行处理                 │
│    ┌─────────┐     ┌─────────┐   │
│    │  推理   │     │ 人脸检测│   │
│    └────┬────┘     └────┬────┘   │
│         ↓                ↓        │
│    风格化图像        人脸mask     │
└───────────┬────────────┬─────────┘
            ↓            ↓
        [StyleProcessor]  ← 风格强度
            ↓
        WebGL Shader 混合
            ↓
        输出画布
```

## 🎨 风格说明

应用内置10种艺术风格：

1. **马赛克** - 几何拼接风格
2. **糖果** - 明亮柔和的糖果色
3. **雨公主** - 柔和的人像风格
4. **乌迪内** - 现代艺术风格
5. **点彩画** - 点彩派绘画风格
6. **呐喊** - 表现主义风格
7. **缪斯** - 古典艺术风格
8. **海浪** - 波浪纹理风格
9. **星夜** - 梵高星空风格
10. **神奈川冲浪里** - 浮世绘风格

## 🔧 性能优化

- **WebGL推理**：ONNX Runtime Web 使用 WebGL backend 加速
- **帧降采样**：推理前将图像缩放到480p，提升推理速度
- **跳帧检测**：人脸检测每2帧执行一次，降低CPU负载
- **GPU后处理**：风格混合使用WebGL Shader并行计算
- **内存复用**：Tensor和画布对象复用，减少GC开销

## 📊 性能指标

在现代GPU（如NVIDIA RTX 30系列）上的预期性能：

| 分辨率 | FPS | 推理时间 |
|--------|-----|----------|
| 480p | 40-50 | 15-20ms |
| 720p | 30-40 | 20-30ms |
| 1080p | 15-25 | 30-50ms |

## 🛠️ 开发说明

### 模型来源

风格迁移模型来自 Hugging Face 的 `onnx-models` 组织，使用 Fast Neural Style 架构。

### 自定义模型

如需添加自定义风格模型，修改 `src/modelManager.js` 中的 `STYLES` 数组：

```javascript
{
    id: 'your-style-id',
    name: '风格名称',
    url: 'https://your-model-url/model.onnx',
    color: '#HEXCOLOR',
    preview: 'data:image/svg+xml,...' // SVG预览图
}
```

## 📝 注意事项

1. **HTTPS要求**：摄像头访问需要HTTPS或localhost环境
2. **模型下载**：首次选择风格需要下载模型（约6-10MB每个）
3. **浏览器兼容性**：建议使用Chrome 90+或Edge 90+
4. **WebGL支持**：需要支持WebGL 2.0的显卡

## 🔗 相关资源

- [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/)
- [MediaPipe Face Detection](https://developers.google.com/mediapipe/solutions/vision/face_detector)
- [Fast Neural Style](https://github.com/jcjohnson/fast-neural-style)
