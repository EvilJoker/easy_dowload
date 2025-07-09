# Easy Translate 前端开发指南

## 📋 目录

- [开发环境搭建](#开发环境搭建)
- [项目结构说明](#项目结构说明)
- [本地开发流程](#本地开发流程)
- [代码规范](#代码规范)
- [调试方法](#调试方法)
- [构建与部署](#构建与部署)
- [常见问题](#常见问题)

---

## 🛠️ 开发环境搭建

### 环境要求

- **Node.js**: >= 14.0.0
- **npm**: >= 6.0.0
- **编辑器**: VS Code (推荐)
- **浏览器**: Chrome/Edge (用于测试扩展)

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/username/easy_translate.git
cd easy_translate/01frontend
```

2. **安装依赖**
```bash
npm install
```

3. **验证安装**
```bash
# 检查版本
node --version
npm --version

# 构建项目
npm run build
```

### 开发工具推荐

- **VS Code 插件**:
  - JavaScript and TypeScript
  - Webpack
  - Chrome Debugger
  - Live Server
  - Prettier
  - ESLint

---

## 📁 项目结构说明

```
01frontend/
├── src/                    # 源代码目录
│   ├── background/        # 后台脚本
│   │   └── background.js  # 扩展核心逻辑
│   ├── content/           # 内容脚本
│   │   ├── content.js     # 页面交互逻辑
│   │   └── content.css    # 内容脚本样式
│   ├── popup/             # 弹出窗口
│   │   ├── popup.html     # 弹出窗口HTML
│   │   └── popup.js       # 弹出窗口逻辑
│   ├── icons/             # 图标文件
│   │   ├── icon16.png     # 16x16 图标
│   │   ├── icon32.png     # 32x32 图标
│   │   ├── icon48.png     # 48x48 图标
│   │   ├── icon128.png    # 128x128 图标
│   │   └── icon.svg       # SVG 图标
│   └── manifest.json      # 扩展清单文件
├── dist/                  # 构建输出目录
├── package.json           # 项目配置和依赖
├── package-lock.json      # 依赖锁定文件
├── webpack.config.js      # Webpack 配置
└── postcss.config.js      # PostCSS 配置
```

### 核心文件说明

- **manifest.json**: 浏览器扩展的配置文件
- **background.js**: 扩展的后台脚本，处理扩展生命周期
- **content.js**: 注入到网页的脚本，处理页面交互
- **popup.html/js**: 扩展弹出窗口的界面和逻辑
- **webpack.config.js**: 构建配置，处理资源打包

---

## 🚀 本地开发流程

### 1. 启动开发模式

```bash
# 启动开发模式（监听文件变化）
npm run dev
```

### 2. 构建生产版本

```bash
# 构建生产版本
npm run build
```

### 3. 清理构建文件

```bash
# 清理 dist 目录
npm run clean
```

### 4. 安装扩展到浏览器

1. 打开浏览器扩展管理页面
2. 开启开发者模式
3. 点击"加载解压缩的扩展"
4. 选择 `dist/` 目录

---

## 📝 代码规范

### JavaScript 规范

- 使用 ES6+ 语法
- 使用 const/let，避免 var
- 使用箭头函数
- 使用模板字符串
- 使用解构赋值

```javascript
// ✅ 推荐
const config = {
  name: 'Easy Translate',
  version: '1.0.0'
};

const createServer = (host, port) => {
  return `${host}:${port}`;
};

const { name, version } = config;

// ❌ 避免
var config = {
  name: 'Easy Translate',
  version: '1.0.0'
};

function createServer(host, port) {
  return host + ':' + port;
}
```

### HTML 规范

```html
<!-- ✅ 推荐 -->
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Easy Translate</title>
</head>
<body>
    <div class="container">
        <h1>Easy Translate</h1>
    </div>
</body>
</html>
```

### CSS 规范

```css
/* ✅ 推荐 */
.container {
    width: 400px;
    height: 500px;
    margin: 0;
    padding: 0;
    overflow: hidden;
}

.header {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #dee2e6;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

/* ❌ 避免 */
.container{width:400px;height:500px;margin:0;padding:0;overflow:hidden}
```

---

## 🐛 调试方法

### 1. 浏览器扩展调试

1. **打开扩展管理页面**
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`

2. **开启开发者模式**

3. **点击扩展的"检查视图"**
   - 后台脚本: 点击"service worker"
   - 弹出窗口: 点击"popup"
   - 内容脚本: 在目标页面右键检查

### 2. 控制台调试

```javascript
// 在代码中添加调试信息
console.log('调试信息:', data);
console.error('错误信息:', error);
console.warn('警告信息:', warning);

// 使用 debugger 断点
debugger;
```

### 3. 网络请求调试

```javascript
// 在 background.js 中调试 API 请求
async function testAPI() {
    try {
        const response = await fetch('http://localhost:5000/health');
        const data = await response.json();
        console.log('API 响应:', data);
    } catch (error) {
        console.error('API 错误:', error);
    }
}
```

### 4. 存储调试

```javascript
// 调试 chrome.storage
chrome.storage.local.get(['servers'], (result) => {
    console.log('存储的服务器:', result.servers);
});

chrome.storage.local.set({ servers: [] }, () => {
    console.log('存储已更新');
});
```

---

## 🏗️ 构建与部署

### 开发构建

```bash
# 开发模式（监听文件变化）
npm run dev
```

### 生产构建

```bash
# 生产构建
npm run build

# 清理构建文件
npm run clean
```

### 构建产物

构建后的 `dist/` 目录包含：

- `manifest.json` - 扩展清单
- `background.js` - 后台脚本
- `content.js` - 内容脚本
- `popup.html` - 弹出窗口
- `content-styles.css` - 样式文件
- `icons/` - 图标文件

### 发布扩展

1. **构建生产版本**
   ```bash
   npm run build
   ```

2. **打包扩展**
   - 将 `dist/` 目录压缩为 ZIP 文件
   - 或直接使用 `dist/` 目录

3. **发布到应用商店**
   - Chrome Web Store
   - Microsoft Edge Add-ons

---

## ❓ 常见问题

### Q: npm install 失败？

**A**: 检查以下几点：
1. 确认 Node.js 版本 >= 14.0.0
2. 检查网络连接
3. 清除 npm 缓存: `npm cache clean --force`
4. 删除 node_modules 重新安装

### Q: 构建失败？

**A**: 可能的原因：
1. 检查 webpack.config.js 配置
2. 确认所有依赖已安装
3. 查看构建错误信息

### Q: 扩展无法加载？

**A**: 检查方法：
1. 确认 manifest.json 格式正确
2. 检查文件路径是否正确
3. 查看浏览器控制台错误信息

### Q: API 请求失败？

**A**: 解决方法：
1. 确认后端服务已启动
2. 检查 CORS 配置
3. 确认 API 地址正确
4. 查看网络请求日志

### Q: 扩展权限问题？

**A**: 检查 manifest.json 中的权限配置：
```json
{
  "permissions": [
    "activeTab",
    "storage",
    "downloads"
  ],
  "host_permissions": [
    "http://*/*",
    "https://*/*"
  ]
}
```

---

## 📚 相关资源

- [Chrome Extension 开发文档](https://developer.chrome.com/docs/extensions/)
- [Webpack 文档](https://webpack.js.org/)
- [JavaScript 教程](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript)
- [CSS 教程](https://developer.mozilla.org/zh-CN/docs/Web/CSS)

---

## 🛠️ 开发工具配置

### VS Code 设置

创建 `.vscode/settings.json`:
```json
{
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.fixAll": true
    },
    "files.associations": {
        "*.js": "javascript",
        "*.html": "html",
        "*.css": "css"
    },
    "emmet.includeLanguages": {
        "javascript": "html"
    }
}
```

### 代码质量工具

项目已配置以下代码质量工具：

- **Webpack**: 模块打包
- **PostCSS**: CSS 处理
- **Autoprefixer**: CSS 前缀自动添加

### 使用 npm 管理依赖

```bash
# 安装新依赖
npm install package-name

# 安装开发依赖
npm install --save-dev package-name

# 更新依赖
npm update

# 查看依赖
npm list
```

---

## 🚀 快速开始

1. **克隆项目**
```bash
git clone <repository-url>
cd easy_translate/01frontend
```

2. **安装依赖**
```bash
npm install
```

3. **启动开发模式**
```bash
npm run dev
```

4. **构建生产版本**
```bash
npm run build
```

5. **安装扩展**
- 打开浏览器扩展管理页面
- 开启开发者模式
- 加载 `dist/` 目录

---

**Happy Coding! 🎉** 