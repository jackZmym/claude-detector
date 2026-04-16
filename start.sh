#!/bin/bash

# Claude 模型检测器 - 一键启动脚本
# ========================================

PORT=3000
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Claude 模型检测器 - 启动中...      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

cd "$PROJECT_DIR"

# 检查 node 是否安装
if ! command -v node &> /dev/null; then
  echo "[错误] 未检测到 Node.js，请先安装: https://nodejs.org"
  exit 1
fi

echo "[✓] Node.js 版本: $(node -v)"

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
  echo "[*] 首次运行，正在安装依赖..."
  npm install
  if [ $? -ne 0 ]; then
    echo "[错误] 依赖安装失败"
    exit 1
  fi
  echo "[✓] 依赖安装完成"
else
  echo "[✓] 依赖已就绪"
fi

# 检查端口是否占用
if lsof -i :$PORT &> /dev/null; then
  echo "[!] 端口 $PORT 已被占用，尝试关闭..."
  kill -9 $(lsof -t -i :$PORT) 2>/dev/null
  sleep 1
fi

echo "[*] 启动服务 (端口: $PORT)..."
echo ""
echo "  ┌──────────────────────────────────────┐"
echo "  │  浏览器打开: http://localhost:$PORT   │"
echo "  │  按 Ctrl+C 停止服务                  │"
echo "  └──────────────────────────────────────┘"
echo ""

# 自动打开浏览器 (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  sleep 2 && open "http://localhost:$PORT" &
fi

# 启动 Next.js
npx next dev -p $PORT
