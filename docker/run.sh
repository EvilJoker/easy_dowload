#!/bin/bash

set -e
 
# 配置
IMAGE_NAME="easy-download/backend"
VERSION=${1:-latest}

echo "🚀 启动 Easy Translate 后端服务..."

echo "📋 启动服务..."
docker-compose -f docker-compose.yml up --build

echo "✅ 服务启动完成!"
echo "🌐 访问地址: http://localhost:5000"
echo "🔍 健康检查: http://localhost:5000/health" 