#!/bin/bash

set -e

# 配置
IMAGE_NAME="easy-translate-backend"
VERSION=${1:-dev}

echo "🚀 构建本地 Docker 镜像..."

# 构建镜像
docker build -f docker/Dockerfile -t ${IMAGE_NAME}:${VERSION} ..

echo "✅ 镜像构建完成: ${IMAGE_NAME}:${VERSION}"

echo "📋 可用镜像:"
echo "  - ${IMAGE_NAME}:${VERSION} (统一环境)" 