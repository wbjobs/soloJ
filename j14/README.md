# ODE 符号求解引擎

基于 **Python + SymPy + Flask** 的常微分方程（ODE）符号求解 Web 服务。

## 功能特性

- **LaTeX / SymPy 双格式输入**：自动识别并解析方程
- **30+ 种 ODE 类型识别**：模式匹配引擎按匹配度排序
  - 一阶：可分离、齐次、线性、全微分、Bernoulli、Riccati、Clairaut、d'Alembert
  - **扩展类型**：Abel 第一类 / 第二类、Chini 方程
  - 二阶常系数齐次 / 非齐次、Euler
  - 特殊方程：Bessel、Legendre、Hermite、Laguerre、Chebyshev、Airy、Weber、Mathieu、Hill
  - 非线性：Emden-Fowler、Lane-Emden、Thomas-Fermi、Blasius
  - 可约化类型：不显含 y、不显含 x、自治
- **求解步骤中间过程**：积分因子、特征方程、变量替换等逐步展示
- **特解与通解分离**：自动按是否含常数 C1, C2, … 分类
- **解的验证**：代入原方程计算残差
- **Redis 缓存**：相同方程命中缓存，加速重复查询

## 目录结构

```
j14/
├── app.py                  # Flask Web API + 序列化
├── config.py               # 配置（Redis、端口）
├── requirements.txt
├── run.bat / run.sh        # 启动脚本
├── backend/
│   ├── __init__.py
│   ├── parser.py           # 方程解析与规范化（LaTeX→SymPy）
│   ├── matchers.py         # 30+ 种方程类型模式匹配
│   ├── solver.py           # 求解策略引擎 + 步骤记录
│   └── verify.py           # 解验证 + 通解/特解分离
└── static/
    ├── index.html          # 前端页面
    ├── app.js              # 交互逻辑
    └── styles.css
```

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
# Windows
run.bat

# Linux / macOS
bash run.sh

# 或直接
python app.py
```

访问 <http://127.0.0.1:5000>

### 启用 Redis 缓存

```bash
# 启动 Redis 后设置环境变量
export REDIS_ENABLED=true
export REDIS_HOST=localhost
export REDIS_PORT=6379
python app.py
```

## API 说明

### `POST /api/parse`
解析方程，不求解。
```json
{ "equation": "y'' + y = 0", "format": "sympy" }
```

### `POST /api/solve`
求解并返回类型识别、步骤、解、验证结果。
```json
{
  "ok": true,
  "ode_input": { ... },
  "primary_type": { "code": "linear_const_coeff", "name_cn": "常系数线性齐次方程", ... },
  "matched_types": [ ... ],
  "steps": [ { "title": "...", "description": "...", "math": "..." }, ... ],
  "general_solutions": [ { "latex": "...", "str": "..." } ],
  "particular_solutions": [ ... ],
  "verification": [ { "verified": true, "residual": { "latex": "0" } }, ... ]
}
```

### `GET /api/types`
列出所有支持的方程类型。

## 示例方程

| 类型 | 输入 |
| --- | --- |
| 一阶线性 | `y' + y = 0` |
| 二阶常系数 | `y'' + y = 0` |
| Riccati | `y' = y**2 + x` |
| Bernoulli | `y' + y = y**3` |
| Abel 第一类 | `y' = y**3 + y**2 + y` |
| Chini (n=5) | `y' = y**5 + y` |
| Bessel | `x**2*y'' + x*y' + (x**2 - 1)*y = 0` |
| Legendre | `(1-x**2)*y'' - 2*x*y' + 2*y = 0` |
