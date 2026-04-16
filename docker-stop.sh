#!/bin/bash

# ============================================
# Claude 检测工具箱 - Docker 停止并清理
# ============================================

CONTAINER_NAME="claude-detector"
IMAGE_NAME="claude-detector"

echo "[*] 停止容器..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true
echo "[✓] 容器已停止"

# 可选：删除镜像
if [ "$1" = "--clean" ]; then
  echo "[*] 清理镜像..."
  docker rmi "$IMAGE_NAME" 2>/dev/null || true
  echo "[✓] 镜像已清理"
fi

echo "[✓] 完成"
