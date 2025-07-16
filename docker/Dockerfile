# 多阶段构建 Dockerfile
FROM python:3.11-slim as builder

# 安装构建依赖
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制依赖文件
COPY ../02backend/pyproject.toml ../02backend/uv.lock ./

# 安装 uv 并同步依赖
RUN pip install uv && \
    uv sync --frozen --no-dev

# 生产镜像
FROM python:3.11-slim

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制虚拟环境
COPY --from=builder /app/.venv /app/.venv

# 复制整个 02backend 目录内容到 /app
COPY ../02backend/ ./

# 复制 api-client.js 到 static 目录
COPY ../01frontend/src/shared/api-client.js ./static/

# 设置环境变量
ENV PYTHONPATH=/app
ENV PATH="/app/.venv/bin:$PATH"

# 暴露端口
EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# 启动命令：直接使用 python
CMD ["python", "-m", "src.main"] 