#!/bin/bash

# ============================================
# Claude 检测工具箱 - Docker 一键部署
# ============================================

set -e

PORT="${1:-3000}"
IMAGE_NAME="claude-detector"
CONTAINER_NAME="claude-detector"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║   Claude 检测工具箱 - Docker 部署    ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
  echo "[错误] 未安装 Docker，请先安装: https://docs.docker.com/get-docker/"
  exit 1
fi

echo "[✓] Docker 版本: $(docker --version | awk '{print $3}')"

# 停止旧容器
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "[*] 停止旧容器..."
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
  echo "[✓] 旧容器已清理"
fi

# 检查是否有 docker-compose
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null 2>&1; then
  echo "[*] 使用 docker-compose 构建并启动..."
  PORT=$PORT docker compose up -d --build
else
  echo "[*] 构建 Docker 镜像..."
  docker build -t "$IMAGE_NAME" .

  echo "[*] 启动容器..."
  docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "${PORT}:3000" \
    -e NODE_ENV=production \
    -e NEXT_TELEMETRY_DISABLED=1 \
    --memory=512m \
    --cpus=1.0 \
    --read-only \
    --tmpfs /tmp \
    --security-opt no-new-privileges:true \
    "$IMAGE_NAME"
fi

echo ""
echo "[✓] 部署成功!"
echo ""
echo "  ┌──────────────────────────────────────┐"
echo "  │  访问: http://localhost:${PORT}          │"
echo "  │  停止: ./docker-stop.sh              │"
echo "  │  日志: docker logs -f $CONTAINER_NAME │"
echo "  └──────────────────────────────────────┘"
echo ""
