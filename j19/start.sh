#!/usr/bin/env bash
# ------------------------------------------------------------
# FPGA 远程烧录与在线调试平台 - Linux / macOS 一键启动脚本
# 使用方式:
#     chmod +x start.sh
#     ./start.sh
# ------------------------------------------------------------

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo "[*] 正在关闭服务进程 ..."
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
        wait "$FRONTEND_PID" 2>/dev/null || true
    fi
    # 兜底清理残留的 python / node
    pkill -f "python app.py" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    echo "[√] 服务已停止，再见。"
    exit 0
}

trap cleanup INT TERM

separator() {
    echo "========================================================"
}

separator
echo "  FPGA 远程烧录与在线调试平台 - Linux/macOS 启动脚本"
separator
echo ""

# ---------- 1. 检测 Python ----------
if ! command -v python3 >/dev/null 2>&1 && ! command -v python >/dev/null 2>&1; then
    echo "[错误] 未检测到 Python，请先安装 Python 3.10+ 并加入 PATH。"
    exit 1
fi
PY_BIN="python3"
command -v python3 >/dev/null 2>&1 || PY_BIN="python"
PY_VER=$($PY_BIN --version 2>&1)
echo "[√] Python 已检测: $PY_VER"

# ---------- 2. 检测 Node ----------
if ! command -v node >/dev/null 2>&1; then
    echo "[错误] 未检测到 Node.js，请先安装 Node.js 18+ 并加入 PATH。"
    exit 1
fi
NODE_VER=$(node --version 2>&1)
echo "[√] Node.js 已检测: $NODE_VER"

echo ""
echo "---------- 安装后端依赖 ----------"
if [ ! -f "$BACKEND_DIR/requirements.txt" ]; then
    echo "[错误] 未找到 backend/requirements.txt"
    exit 1
fi
$PY_BIN -m pip install --upgrade pip >/dev/null 2>&1 || true
$PY_BIN -m pip install -r "$BACKEND_DIR/requirements.txt" || {
    echo "[错误] 后端依赖安装失败"
    exit 1
}
echo "[√] 后端依赖安装完成"

echo ""
echo "---------- 安装前端依赖 ----------"
if [ ! -f "$FRONTEND_DIR/package.json" ]; then
    echo "[错误] 未找到 frontend/package.json"
    exit 1
fi
(cd "$FRONTEND_DIR" && npm install --no-audit --no-fund) || {
    echo "[错误] 前端依赖安装失败"
    exit 1
}
echo "[√] 前端依赖安装完成"

echo ""
echo "---------- 启动后端服务 (后台) ----------"
(cd "$BACKEND_DIR" && $PY_BIN app.py) &
BACKEND_PID=$!
echo "[√] 后端已后台启动 (PID=$BACKEND_PID): http://localhost:5000"

sleep 2

echo ""
echo "---------- 启动前端服务 (后台) ----------"
(cd "$FRONTEND_DIR" && npm run dev) &
FRONTEND_PID=$!
echo "[√] 前端已后台启动 (PID=$FRONTEND_PID): http://localhost:3000"

sleep 3

echo ""
separator
echo "  服务启动完成"
echo "--------------------------------------------------------"
echo "  前端地址 : http://localhost:3000"
echo "  后端地址 : http://localhost:5000"
echo "  默认账号 : admin / admin"
echo "--------------------------------------------------------"
echo "  提示: 按 Ctrl+C 将停止所有服务并退出"
separator
echo ""

# 阻塞等待
while true; do
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "[!] 后端进程已退出"
        break
    fi
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo "[!] 前端进程已退出"
        break
    fi
    sleep 2
done

cleanup
