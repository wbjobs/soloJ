# 3D 分子构建器

一个基于 Three.js 和 RDKit 的交互式 3D 分子构建工具，允许用户在 3D 空间中拖拽原子组合分子，并实时计算化学属性。

## 功能特性

- 🎨 **3D 可视化**：使用 Three.js 渲染高质量的 3D 原子和化学键
- 🖱️ **直观交互**：支持原子拖拽、视角旋转、缩放和平移
- ⚛️ **多种原子**：支持 H, C, N, O, F, P, S, Cl, Br, I 等常见元素
- 🔗 **自动成键**：原子靠近时自动生成化学键
- 🧪 **化学计算**：后端调用 RDKit 计算分子属性：
  - SMILES 字符串
  - 分子式
  - 分子量
  - LogP（脂水分配系数）
  - TPSA（拓扑极性表面积）
  - 氢键供体/受体数量
  - 可旋转键数量

## 项目结构

```
j86/
├── app.py              # Flask 后端服务
├── index.html          # 前端页面（Three.js）
├── requirements.txt    # Python 依赖
├── package.json        # 项目配置
└── README.md           # 说明文档
```

## 安装与运行

### 1. 安装 Python 依赖

```bash
pip install -r requirements.txt
```

**注意**：RDKit 的安装可能需要使用 conda：
```bash
conda install -c conda-forge rdkit
```

### 2. 启动服务

```bash
python app.py
```

或使用 npm 脚本：
```bash
npm run dev
```

### 3. 访问应用

在浏览器中打开：http://localhost:5000

## 使用说明

### 基本操作

| 操作 | 说明 |
|------|------|
| **左键点击** | 在场景中添加选中类型的原子 |
| **左键拖拽原子** | 移动原子位置 |
| **右键拖拽** | 旋转 3D 视角 |
| **滚轮** | 缩放场景 |
| **中键拖拽** | 平移视角 |

### 构建分子

1. 在左侧面板选择原子类型
2. 点击 3D 场景添加原子
3. 拖拽原子调整位置（原子靠近时自动成键）
4. 点击「计算化学属性」按钮获取分子信息

### 支持的元素

- **H** 氢 (白色)
- **C** 碳 (黑色)
- **N** 氮 (蓝色)
- **O** 氧 (红色)
- **F** 氟 (浅绿色)
- **P** 磷 (橙色)
- **S** 硫 (黄色)
- **Cl** 氯 (绿色)
- **Br** 溴 (棕色)
- **I** 碘 (紫色)

## API 接口

### POST /api/calculate

计算分子的化学属性。

**请求体**：
```json
{
  "atoms": [
    {"element": "C", "x": 0, "y": 0, "z": 0},
    {"element": "H", "x": 1, "y": 0, "z": 0}
  ]
}
```

**响应**：
```json
{
  "success": true,
  "smiles": "C",
  "formula": "CH4",
  "molecular_weight": 16.043,
  "logp": 1.09,
  "num_atoms": 5,
  "num_bonds": 4,
  "tpsa": 0.0,
  "h_donors": 0,
  "h_acceptors": 0,
  "rotatable_bonds": 0,
  "bonds": [[0, 1], [0, 2], [0, 3], [0, 4]]
}
```

## 技术栈

**前端**：
- Three.js r128 - 3D 渲染
- 原生 JavaScript - 交互逻辑

**后端**：
- Flask 3.0 - Web 框架
- RDKit - 化学信息学计算
- NumPy - 数值计算

## 注意事项

1. 确保已正确安装 RDKit 库
2. 构建复杂分子时，请确保原子位置符合化学合理性
3. SMILES 生成依赖于原子的连接关系，请确保原子间距适当

## 许可证

MIT License
