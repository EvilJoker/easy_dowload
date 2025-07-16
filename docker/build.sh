#!/bin/bash

set -e

# 配置
IMAGE_NAME="easy-translate-backend"
REGISTRY="your-registry"
VERSION=${1:-latest}

echo "🚀 构建多架构 Docker 镜像..."

# 检查是否安装了 buildx
if ! docker buildx version > /dev/null 2>&1; then
    echo "❌ Docker buildx 未安装，请先安装 Docker buildx"
    exit 1
fi

# 创建 buildx builder
docker buildx create --use --name multiarch-builder || true

# 构建并推送多架构镜像
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag ${REGISTRY}/${IMAGE_NAME}:${VERSION} \
    --tag ${REGISTRY}/${IMAGE_NAME}:latest \
    --push \
    -f docker/Dockerfile ..

echo "✅ 镜像构建完成: ${REGISTRY}/${IMAGE_NAME}:${VERSION}"
echo "📋 支持的架构: linux/amd64, linux/arm64" 