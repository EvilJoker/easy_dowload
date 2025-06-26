# Easy Translate

<div align="center">
  <img src="src/icons/icon.svg" alt="Easy Translate Logo" width="128" height="128">
  
  **智能下载链接传输工具 - 让文件直达目标服务器**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Edge Extension](https://img.shields.io/badge/Edge-Extension-blue.svg)](https://microsoftedge.microsoft.com/addons/)
  [![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](https://github.com/username/easy_translate/releases)
</div>

## 🎯 简介

Easy Translate 是一个现代化的浏览器插件，专为提升文件传输效率而生。当您遇到需要下载文件到服务器的场景时，无需再经历"下载到本地 → 上传到服务器"的繁琐流程，只需一键即可将网页上的文件直接传输到目标服务器。

**核心价值：省时间，提效率，简化操作**

## ✨ 主要特性

### 🔍 智能识别
- 自动检测网页中的下载链接
- 支持主流文件格式：压缩包、软件、文档、媒体文件等
- 识别GitHub Releases、带参数的下载链接

### ⚡ 一键传输
- 在下载链接旁自动显示传输按钮
- 支持右键菜单快速传输
- 无需先下载到本地，直接传输到服务器

### 🔧 多服务器管理
- 支持 SFTP、FTP、SCP 协议
- 便捷的服务器配置管理
- 一次配置，长期使用

### 📊 传输监控
- 实时传输状态显示
- 完整的传输历史记录
- 直观的进度反馈

## 🚀 快速开始

### 安装插件
1. 下载项目并构建：
```bash
git clone https://github.com/username/easy_translate.git
cd easy_translate
npm install
npm run build
```

2. 在浏览器中加载：
   - 打开 `edge://extensions/`
   - 开启"开发人员模式"
   - 点击"加载解压缩的扩展"
   - 选择 `dist` 文件夹

### 配置服务器
1. 点击浏览器工具栏中的插件图标
2. 点击"添加服务器"
3. 填写服务器信息：
   - 服务器名称：如"生产服务器"
   - 主机地址：服务器IP或域名
   - 端口：22 (SSH) 或 21 (FTP)
   - 协议：SFTP/FTP/SCP
   - 用户名密码
   - 默认上传路径

### 开始使用
1. **自动检测**：插件会在下载链接旁显示 ⬇️ 传输按钮
2. **点击传输**：选择目标服务器和路径
3. **完成传输**：文件直接传输到服务器，无需经过本地

## 🎨 界面预览

### 传输按钮
网页上的下载链接会自动显示黄色背景的黑色箭头按钮：
```
📄 重要文档.pdf  [⬇️]  <!-- 自动添加的传输按钮 -->
💾 软件安装包.exe [⬇️]
📦 源码压缩包.zip [⬇️]
```

### 传输对话框
点击按钮后弹出简洁的配置界面：
- 文件链接预览
- 服务器选择下拉菜单
- 目标路径设置
- 一键开始传输

## 📋 支持的文件类型

| 类型 | 扩展名 | 说明 |
|------|--------|------|
| 压缩文件 | `.zip` `.rar` `.7z` `.tar` `.gz` | 各种压缩格式 |
| 可执行文件 | `.exe` `.msi` `.deb` `.rpm` `.dmg` | 软件安装包 |
| 文档文件 | `.pdf` `.doc` `.docx` `.xls` `.xlsx` `.ppt` `.pptx` | Office文档 |
| 媒体文件 | `.mp4` `.avi` `.mkv` `.mp3` `.wav` | 音视频文件 |
| 其他 | `.iso` | 镜像文件 |
| 特殊链接 | 包含 `download`、`attachment` 关键词的URL | 动态下载链接 |

## 🛠️ 使用场景

### 开发运维
- 下载开源软件到服务器
- 部署应用程序包
- 传输配置文件和脚本

### 内容管理
- 上传媒体文件到CDN
- 备份重要文档
- 批量文件传输

### 日常办公
- 共享大文件到公司服务器
- 远程文件同步
- 云端存储管理

## 🧪 测试功能

项目包含完整的测试页面 `test/demo.html`，包括：
- 各种文件类型的下载链接示例
- 功能验证步骤
- 兼容性测试工具

在浏览器中打开测试页面即可验证插件功能。

## 🔒 隐私与安全

- **本地存储**：服务器配置仅保存在本地浏览器中
- **最小权限**：仅申请必要的浏览器权限
- **无数据收集**：不收集用户使用数据
- **开源透明**：所有代码公开可审查

## 🆘 常见问题

### 看不到传输按钮？
1. 确认插件已安装并启用
2. 检查链接是否为支持的文件类型
3. 刷新页面重新检测

### 传输失败？
1. 检查服务器配置是否正确
2. 确认网络连接正常
3. 验证服务器认证信息

### 兼容性问题？
- 支持基于 Chromium 的浏览器（Edge、Chrome）
- 需要浏览器版本 88 或更高
- 部分网站可能有特殊的安全策略限制

## 📝 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

<div align="center">
  <strong>让文件传输更简单，让工作更高效</strong>
</div>
