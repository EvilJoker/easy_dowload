#!/bin/bash

set -e

# 配置
ENVIRONMENT=${1:-dev}
IMAGE_NAME="easy-translate-backend"
VERSION=${2:-latest}

echo "🚀 启动 Easy Translate 后端服务..."

case $ENVIRONMENT in
    "dev")
        echo "📋 启动开发环境..."
        docker-compose -f docker/docker-compose.yml up --build
        ;;
    "prod")
        echo "📋 启动生产环境..."
        docker-compose -f docker/docker-compose.yml --profile production up --build
        ;;
    "local")
        echo "📋 启动本地镜像..."
        docker run -d \
            --name easy-translate-backend \
            -p 5000:5000 \
            -e FLASK_ENV=production \
            -e PYTHONPATH=/app \
            ${IMAGE_NAME}:${VERSION}
        ;;
    *)
        echo "❌ 无效的环境参数: $ENVIRONMENT"
        echo "📋 可用选项:"
        echo "  - dev: 开发环境 (docker-compose)"
        echo "  - prod: 生产环境 (docker-compose)"
        echo "  - local: 本地镜像运行"
        exit 1
        ;;
esac

echo "✅ 服务启动完成!"
echo "🌐 访问地址: http://localhost:5000"
echo "🔍 健康检查: http://localhost:5000/health" 