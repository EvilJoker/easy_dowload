# GitHub CI/CD 配置指南

## 📋 概述

本指南介绍 Easy Translate 项目的 GitHub Actions CI/CD 配置，包括自动构建、测试、安全扫描和发布流程。

## 🏗️ 工作流结构

```
.github/
├── workflows/
│   ├── docker-build.yml      # Docker 构建和推送
│   ├── test.yml             # 测试和代码质量检查
│   ├── security.yml         # 安全扫描
│   ├── release.yml          # 发布流程
│   └── dependabot.yml       # 依赖更新
└── dependabot.yml           # Dependabot 配置
```

## 🚀 工作流说明

### 1. Docker 构建和推送 (docker-build.yml)

**触发条件：**
- 推送到 main/develop 分支
- 创建版本标签 (v*)
- Pull Request 到 main 分支

**功能：**
- 多架构镜像构建 (linux/amd64, linux/arm64)
- 自动推送到 GitHub Container Registry
- 智能标签管理
- 构建缓存优化

**镜像地址：**
```
ghcr.io/{username}/easy-translate-backend:{tag}
```

### 2. 测试工作流 (test.yml)

**触发条件：**
- 推送到 main/develop 分支
- Pull Request 到 main 分支

**功能：**
- Python 代码质量检查 (flake8)
- 代码格式检查 (black)
- 单元测试执行 (pytest)
- 代码覆盖率报告
- 自动上传到 Codecov

### 3. 安全扫描 (security.yml)

**触发条件：**
- 推送到 main/develop 分支
- Pull Request 到 main 分支
- 每周一凌晨 2 点定时扫描

**功能：**
- Python 依赖漏洞扫描 (safety)
- Docker 镜像安全扫描 (Trivy)
- 自动上传到 GitHub Security 页面

### 4. 发布工作流 (release.yml)

**触发条件：**
- 推送版本标签 (v*)

**功能：**
- 构建生产镜像
- 推送到容器仓库
- 自动创建 GitHub Release
- 生成发布说明

### 5. 依赖更新 (dependabot.yml)

**触发条件：**
- Dependabot 创建的 Pull Request

**功能：**
- 自动合并补丁版本更新
- 对重要更新运行测试
- 智能依赖管理

## 🔧 配置说明

### 环境变量

```yaml
env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/easy-translate-backend
```

### 权限配置

```yaml
permissions:
  contents: read/write
  packages: write
  security-events: write
```

### 缓存策略

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

## 📊 监控和报告

### 构建状态

- **绿色**：所有检查通过
- **黄色**：部分检查通过，需要人工干预
- **红色**：构建失败，需要修复

### 报告位置

- **测试覆盖率**：Codecov
- **安全漏洞**：GitHub Security 页面
- **构建日志**：GitHub Actions 页面
- **镜像仓库**：GitHub Container Registry

## 🛠️ 故障排查

### 常见问题

1. **构建失败**
   ```bash
   # 检查 Dockerfile 语法
   docker build -f docker/Dockerfile .
   
   # 检查依赖安装
   cd 02backend && uv sync
   ```

2. **测试失败**
   ```bash
   # 本地运行测试
   cd 02backend && uv run pytest tests/
   
   # 检查代码格式
   uv run black --check src/
   ```

3. **安全扫描失败**
   ```bash
   # 检查依赖漏洞
   uv run safety check
   
   # 扫描 Docker 镜像
   trivy image easy-translate-backend:latest
   ```

## 🔒 安全最佳实践

### 依赖管理
- 定期更新依赖
- 使用安全扫描工具
- 锁定依赖版本

### 镜像安全
- 使用官方基础镜像
- 定期更新基础镜像
- 扫描镜像漏洞

### 权限管理
- 最小权限原则
- 定期审查权限
- 使用环境变量存储敏感信息

## 📈 性能优化

### 构建优化
- 使用多阶段构建
- 启用构建缓存
- 并行执行任务

### 测试优化
- 并行运行测试
- 使用测试缓存
- 智能测试选择

## 🤝 贡献指南

### 提交代码
1. 创建功能分支
2. 编写测试用例
3. 确保代码质量检查通过
4. 创建 Pull Request

### 发布流程
1. 更新版本号
2. 创建版本标签
3. 等待 CI/CD 完成
4. 验证发布结果

## 📚 相关文档

- [Easy Translate 容器化方案文档](../feature/Easy-Translate-容器化方案文档-v1.0.md)
- [Docker 部署指南](./docker/README.md)
- [GitHub Actions 官方文档](https://docs.github.com/en/actions)

---

## 📝 变更记录

| 版本 | 日期 | 变更内容 | 负责人 |
|------|------|----------|--------|
| v1.0 | 2025-07-15 | 初始版本，完成 CI/CD 配置 | 开发团队 | 