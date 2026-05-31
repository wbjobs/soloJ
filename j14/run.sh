#!/usr/bin/env bash
set -e
echo "============================================"
echo "  ODE 符号求解引擎 - 启动脚本"
echo "============================================"
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未检测到 python3"
    exit 1
fi
PY=python3
$PY -c "import flask, sympy" 2>/dev/null || {
    echo "[安装] 首次运行，正在安装依赖..."
    $PY -m pip install -r requirements.txt
}
echo "[启动] Web 服务 http://127.0.0.1:5000"
$PY app.py
