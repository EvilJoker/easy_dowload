# Easy Translate

一个基于 DDD 架构的文件传输工具，包含浏览器扩展前端和 Flask 后端服务。

## 📋 目录

- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [开发指南](#开发指南)
- [API 接口](#api-接口)
- [测试](#测试)
- [部署](#部署)

## 📁 项目结构

```
easy_translate/
├── 01frontend/           # 浏览器扩展前端
│   ├── src/             # 前端源代码
│   │   ├── background/  # 后台脚本
│   │   ├── content/     # 内容脚本
│   │   ├── popup/       # 弹出窗口
│   │   ├── icons/       # 图标文件
│   │   └── manifest.json # 扩展清单
│   ├── dist/            # 构建输出
│   ├── package.json     # 前端依赖
│   └── webpack.config.js # 构建配置
├── 02backend/            # Python 后端服务
│   ├── src/             # 后端源代码
│   │   ├── interfaces/  # 接口层
│   │   ├── application/ # 应用层
│   │   ├── domain/      # 领域层
│   │   ├── infrastructure/ # 基础设施层
│   │   └── main.py      # 后端入口
│   ├── tests/           # 测试文件
│   ├── main.py          # 服务器启动脚本
│   ├── pyproject.toml   # 后端依赖
│   └── uv.lock          # 依赖锁定文件
├── shared/              # 共享资源
│   ├── config/          # 配置文件
│   ├── docs/            # 文档
│   └── scripts/         # 脚本文件
└── README.md            # 项目说明
```

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 14.0.0
- **Python**: >= 3.9
- **uv**: 最新版本 (推荐)

### 1. 克隆项目

```bash
git clone <repository-url>
cd easy_translate
```

### 2. 启动后端服务

```bash
cd 02backend
uv sync
uv run python main.py
```

后端服务将在 `http://localhost:5000` 启动。

### 3. 构建前端扩展

```bash
cd 01frontend
npm install
npm run build
```

构建后的文件在 `01frontend/dist/` 目录中。

### 4. 安装浏览器扩展

1. 打开浏览器扩展管理页面
2. 开启开发者模式
3. 点击"加载解压缩的扩展"
4. 选择 `01frontend/dist/` 目录

## 📚 开发指南

### 后端开发

详细的后端开发指南请参考：[后端开发指南](shared/docs/development/快速开发指南-backend.md)

包含：
- 开发环境搭建
- 项目结构说明
- 本地开发流程
- 代码规范
- 测试指南
- 调试方法

### 前端开发

详细的前端开发指南请参考：[前端开发指南](shared/docs/development/快速开发指南-frontend.md)

包含：
- 开发环境搭建
- 项目结构说明
- 本地开发流程
- 代码规范
- 调试方法

## 🔧 测试

### 后端测试

```bash
cd 02backend
bash test.sh
```

### 前端测试

```bash
cd 01frontend
npm run build
```

## 📡 API 接口

后端提供以下主要接口：

- `GET /health` - 健康检查
- `POST /transfer` - 发起文件传输
- `GET /progress/<task_id>` - 查询传输进度
- `GET /servers` - 获取服务器列表
- `POST /servers` - 创建服务器配置
- `GET /history` - 获取传输历史
- `GET /tasks` - 获取任务列表

详细 API 文档请参考：[API 文档](shared/docs/api/)

## 🏗️ 部署

### 后端部署

```bash
cd 02backend
uv run python main.py --host 0.0.0.0 --port 5000
```

### 前端部署

```bash
cd 01frontend
npm run build
```

将 `dist/` 目录中的文件打包为浏览器扩展。


## 🤝 贡献

欢迎贡献代码！请阅读相应的开发指南了解如何参与开发。

### 贡献流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

MIT License

---

**Happy Coding! 🎉**
