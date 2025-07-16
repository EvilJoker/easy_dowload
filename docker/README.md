# Easy Translate Docker 部署指南

## 📋 概述

本目录包含 Easy Translate 后端的 Docker 容器化配置，支持多架构部署和开发/生产环境。

## 🏗️ 目录结构

```
docker/
├── Dockerfile              # 统一 Dockerfile
├── docker-compose.yml      # Docker Compose 配置
├── .dockerignore           # Docker 忽略文件
├── build.sh               # 多架构构建脚本
├── build-local.sh         # 本地构建脚本
├── run.sh                 # 运行脚本
└── README.md              # 本文档
```

## 🚀 快速开始

### 统一环境

```bash
# 启动服务
./docker/run.sh dev

# 或者使用 docker-compose
cd docker
docker-compose up --build
```

### 生产环境

```bash
# 启动生产环境
./docker/run.sh prod

# 或者使用 docker-compose
cd docker
docker-compose --profile production up --build
```

### 本地镜像运行

```bash
# 构建本地镜像
./docker/build-local.sh

# 运行本地镜像
./docker/run.sh local
```

## 🔧 构建镜像

### 本地构建

```bash
# 构建开发镜像
./docker/build-local.sh

# 构建指定版本
./docker/build-local.sh v1.0.0
```

### 多架构构建

```bash
# 构建并推送多架构镜像
./docker/build.sh v1.0.0
```

## 📋 环境配置

### 统一环境特性
- 多阶段构建
- 最小化镜像
- 健康检查
- 资源优化
- api-client.js 自动复制
- 开发/生产环境一致

## 🔍 健康检查

服务启动后，可以通过以下方式检查健康状态：

```bash
# 检查容器状态
docker ps

# 查看健康检查日志
docker inspect easy-translate-backend | grep Health -A 10

# 直接访问健康检查接口
curl http://localhost:5000/health
```

## 📊 监控指标

### 容器指标
- 内存使用 < 512MB
- CPU 使用率 < 80%
- 启动时间 < 30s
- 健康检查响应 < 5s

### 应用指标
- API 响应时间 < 100ms
- 错误率 < 1%
- 可用性 > 99.9%

## 🛠️ 故障排查

### 常见问题

1. **容器启动失败**
   ```bash
   # 查看容器日志
   docker logs easy-translate-backend
   
   # 检查端口占用
   netstat -tlnp | grep 5000
   ```

2. **健康检查失败**
   ```bash
   # 检查网络连接
   curl -f http://localhost:5000/health
   
   # 查看容器状态
   docker inspect easy-translate-backend
   ```

3. **依赖安装失败**
   ```bash
   # 清理缓存重新构建
   docker system prune -f
   docker build --no-cache -f docker/Dockerfile .
   ```

## 🔒 安全配置

### 生产环境安全
- 非 root 用户运行
- 最小权限原则
- 依赖安全扫描
- 镜像签名验证

### 网络安全
- 只暴露必要端口
- 使用内部网络
- 配置防火墙规则
- 定期安全更新

## 📚 相关文档

- [Easy Translate 容器化方案文档](../feature/Easy-Translate-容器化方案文档-v1.0.md)
- [Easy Translate 系统架构设计文档](../architecture/easy-translate-系统架构设计文档-v1.0.md)

## 🤝 贡献指南

1. 修改 Dockerfile 后请测试构建
2. 更新 docker-compose.yml 后验证服务启动
3. 添加新脚本后更新文档
4. 提交前运行健康检查

---

## 📝 变更记录

| 版本 | 日期 | 变更内容 | 负责人 |
|------|------|----------|--------|
| v1.0 | 2025-07-15 | 初始版本，完成容器化配置 | 开发团队 | 