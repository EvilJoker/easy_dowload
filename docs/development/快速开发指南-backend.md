# easy-translate 快速开发指南

## 📋 目录

- [开发环境搭建](#开发环境搭建)
- [项目结构说明](#项目结构说明)
- [本地开发流程](#本地开发流程)
- [代码规范](#代码规范)
- [测试指南](#测试指南)
- [调试方法](#调试方法)
- [提交规范](#提交规范)
- [常见问题](#常见问题)

---

## 🛠️ 开发环境搭建

### 环境要求

- **Python**: >= 3.9
- **uv**: 最新版本 (推荐)
- **编辑器**: VS Code (推荐)
- **操作系统**: Linux/macOS/Windows

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/username/easy_translate.git
cd easy_translate
```

2. **安装 uv (如果未安装)**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

3. **初始化开发环境**
```bash
# 同步依赖并创建虚拟环境
uv sync

# 安装开发依赖
uv pip install -e .[dev]
```

4. **验证安装**
```bash
# 运行测试
./test.sh

# 启动开发服务器
uv run python src/main.py
```

### 开发工具推荐

- **VS Code 插件**:
  - Python
  - Pylance
  - Black Formatter
  - isort
  - Ruff
  - Test Explorer UI

---

## 📁 项目结构说明

```
easy-translate/
├── src/                    # 源代码目录 (DDD 架构)
│   ├── domain/            # 领域层
│   │   ├── models/        # 领域模型
│   │   ├── repositories/  # 仓储接口
│   │   └── services/      # 领域服务
│   ├── application/       # 应用层
│   │   ├── handlers/      # 处理器
│   │   └── services/      # 应用服务
│   ├── infrastructure/    # 基础设施层
│   │   ├── crypto/        # 加密工具
│   │   ├── network/       # 网络组件
│   │   └── storage/       # 存储组件
│   ├── interfaces/        # 接口层
│   │   ├── api/           # API 接口
│   │   └── web/           # Web 界面
│   └── shared/            # 共享组件
│       └── utils/         # 工具类
├── tests/                 # 测试代码
│   ├── unit/             # 单元测试
│   │   ├── domain/       # 领域层测试
│   │   ├── application/  # 应用层测试
│   │   ├── infrastructure/ # 基础设施层测试
│   │   └── interfaces/   # 接口层测试
│   └── integration/      # 集成测试
├── docs/                  # 项目文档
├── scripts/               # 构建脚本
└── config/                # 配置文件
```

### 核心文件说明

- **pyproject.toml**: 项目配置和依赖管理
- **uv.lock**: 依赖锁定文件
- **src/main.py**: 应用入口点
- **test.sh**: 测试脚本

---

## 🚀 本地开发流程

### 1. 启动开发模式

```bash
# 启动开发服务器 
uv run python -m src.main

或者 run.sh
访问 http://localhost:5000/demo 后端的测试页面
```

### 2. 代码开发

```bash
# 格式化代码
./test.sh -q
```

### 3. 运行测试

```bash
# 运行所有测试
./test.sh

# 仅运行单元测试
./test.sh -u

# 仅运行集成测试
./test.sh -i

# 生成测试报告
./test.sh -r

# 生成覆盖率报告
./test.sh -v

# 运行代码质量检查
./test.sh -q

# 清理测试缓存
./test.sh -c
```

### 4. 构建生产版本

```bash
# 构建项目
uv run python -m build

# 安装到系统
uv pip install dist/*.whl
```

---

## 📝 代码规范

### Python 规范

- 使用 Python 3.9+ 语法
- 遵循 PEP 8 规范
- 使用类型注解
- 使用 f-strings
- 使用 dataclasses

```python
# ✅ 推荐
from typing import Dict, List, Optional
from dataclasses import dataclass

@dataclass
class ServerConfig:
    name: str
    host: str
    port: int
    username: str
    password: str

def create_server_config(config_data: Dict[str, str]) -> ServerConfig:
    return ServerConfig(**config_data)

# ❌ 避免
def create_server_config(config_data):
    return config_data
```

### 导入规范

```python
# ✅ 推荐 (使用 isort 自动排序)
import os
import sys
from typing import Dict, List, Optional

from fastapi import FastAPI
from pydantic import BaseModel

from src.domain.models import ServerConfig
from src.application.services import ConfigManager

# ❌ 避免
from src.application.services import ConfigManager
from fastapi import FastAPI
import os
```

### 文档字符串规范

```python
def create_server_config(config_data: Dict[str, str]) -> ServerConfig:
    """创建服务器配置
    
    Args:
        config_data: 服务器配置信息
        
    Returns:
        服务器配置对象
        
    Raises:
        ValueError: 配置数据无效时抛出
    """
    # 实现代码
    pass
```

---

## 🧪 测试指南

### 使用 test.sh 脚本

```bash
# 运行所有测试
./test.sh

# 仅运行单元测试
./test.sh -u

# 仅运行集成测试
./test.sh -i

# 生成覆盖率报告
./test.sh -v

# 运行代码质量检查
./test.sh -q

# 生成测试报告
./test.sh -r

# 清理测试缓存
./test.sh -c
```

### 直接使用 uv 运行测试

```bash
# 运行单元测试
uv run pytest tests/unit/

# 运行特定测试文件
uv run pytest tests/unit/application/services/test_config_manager.py

# 运行测试并生成覆盖率报告
uv run pytest --cov=src --cov-report=html

# 运行集成测试
uv run pytest tests/integration/

# 运行所有测试
uv run pytest tests/
```

### 测试文件结构

```
tests/
├── unit/                 # 单元测试
│   ├── domain/          # 领域层测试
│   ├── application/     # 应用层测试
│   ├── infrastructure/  # 基础设施层测试
│   └── interfaces/      # 接口层测试
└── integration/         # 集成测试
    └── test_api_integration.py
```

### 测试编写规范

```python
import pytest
from unittest.mock import Mock, patch

from src.application.services import ConfigManager

class TestConfigManager:
    """配置管理器测试类"""
    
    def setup_method(self):
        """每个测试方法前的设置"""
        self.config_manager = ConfigManager()
    
    def test_create_server_config_success(self):
        """测试成功创建服务器配置"""
        config_data = {
            "name": "Test Server",
            "host": "192.168.1.100",
            "port": 22,
            "username": "testuser",
            "password": "testpass"
        }
        
        result = self.config_manager.create_server_config(config_data)
        
        assert result["success"] is True
        assert "config_id" in result
```

---

## 🐛 调试方法

### 1. 日志调试

```python
import logging

# 设置日志
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def some_function():
    logger.debug("调试信息")
    logger.info("一般信息")
    logger.warning("警告信息")
    logger.error("错误信息")
```

### 2. API 调试

```bash
# 启动开发服务器
uv run uvicorn src.interfaces.api.main:app --reload --port 8000

# 访问 API 文档
# http://localhost:8000/docs
```

---

## 📤 提交规范

### 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 类型说明

- **feat**: 新功能
- **fix**: 修复bug
- **docs**: 文档更新
- **style**: 代码格式调整
- **refactor**: 代码重构
- **test**: 测试相关
- **chore**: 构建过程或辅助工具的变动

### 示例

```bash
# 新功能
git commit -m "feat(config): 添加服务器配置管理功能"

# 修复bug
git commit -m "fix(api): 修复配置创建接口返回格式"

# 文档更新
git commit -m "docs(guide): 更新快速开发指南"
```

### 提交前检查

```bash
# 运行测试
./test.sh

# 检查代码格式
./test.sh -q
```

---

## ❓ 常见问题

### Q: uv sync 失败？

**A**: 检查以下几点：
1. 确认 Python 版本 >= 3.9
2. 检查 pyproject.toml 格式是否正确
3. 删除 uv.lock 重新同步

### Q: 测试失败？

**A**: 可能的原因：
1. 检查测试数据是否被污染
2. 确认测试环境配置正确
3. 查看测试日志和错误信息

### Q: 导入模块失败？

**A**: 常见解决方案：
1. 确认在虚拟环境中运行
2. 检查 PYTHONPATH 设置
3. 重新安装依赖 `uv sync`

### Q: API 接口无响应？

**A**: 检查方法：
1. 确认服务器已启动
2. 检查端口是否被占用
3. 查看服务器日志

### Q: 代码格式化问题？

**A**: 解决方法：
```bash
# 自动格式化
./test.sh -q
```

---

## 📚 相关资源

- [Python 官方文档](https://docs.python.org/)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [Pytest 文档](https://docs.pytest.org/)
- [uv 文档](https://docs.astral.sh/uv/)
- [DDD 架构](https://martinfowler.com/bliki/DomainDrivenDesign.html)

---

## 🛠️ 开发工具配置

### VS Code 设置

创建 `.vscode/settings.json`:
```json
{
    "python.defaultInterpreterPath": "./.venv/bin/python",
    "python.testing.pytestEnabled": true,
    "python.testing.pytestArgs": [
        "tests"
    ],
    "python.formatting.provider": "black",
    "python.linting.enabled": true,
    "python.linting.flake8Enabled": false,
    "python.linting.ruffEnabled": true,
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.organizeImports": true
    }
}
```

### 代码质量工具

项目已配置以下代码质量工具：

- **Black**: 代码格式化
- **isort**: 导入排序
- **Ruff**: 代码检查
- **MyPy**: 类型检查
- **Pytest**: 测试框架
- **Coverage**: 测试覆盖率

### 使用 uv 管理依赖

```bash
# 安装新依赖
uv add package-name

# 安装开发依赖
uv add --dev package-name

# 更新依赖
uv sync

# 查看依赖
uv pip list
```

---

## 🚀 快速开始

1. **克隆项目**
```bash
git clone <repository-url>
cd easy-translate
```

2. **设置环境**
```bash
uv sync
uv pip install -e .[dev]
```

3. **运行测试**
```bash
./test.sh
```

4. **启动开发服务器**
```bash
uv run python src/main.py
```

5. **开始开发**
- 修改代码
- 运行测试 `./test.sh`
- 提交代码

---

**Happy Coding! 🎉**

