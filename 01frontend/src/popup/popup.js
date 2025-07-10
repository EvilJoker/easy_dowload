// popup.js - Easy Translate插件的popup页面脚本 - 带任务管理版本

// 导入API客户端
import ApiClient from '../shared/api-client.js';
const apiClient = new ApiClient();
apiClient.setBaseUrl('http://localhost:5000');

class PopupController {
    constructor() {
        this.toggle = null;
        this.statusIndicator = null;
        this.currentTab = null;
        this.currentPatterns = [];
        this.activeTasks = [];
        this.taskHistory = [];
        this.defaultPatterns = [
            '.zip', '.rar', '.7z', '.tar', '.gz', '.exe', '.msi', 
            '.deb', '.rpm', '.dmg', '.iso', '.pdf', '.doc', '.docx', 
            '.xls', '.xlsx', '.ppt', '.pptx', '.mp4', '.avi', '.mkv', 
            '.mp3', '.wav', '/download/', 'download?', 'attachment', 
            'file?', 'releases/download/'
        ];
        this.init();
    }

    async init() {
        console.log('Easy Translate popup loaded - with task management');
        
        // 获取当前标签页信息
        await this.getCurrentTab();
        
        // 获取DOM元素
        this.toggle = document.getElementById('domModificationToggle');
        this.statusIndicator = document.getElementById('statusIndicator');
        
        if (!this.toggle || !this.statusIndicator) {
            console.error('Failed to find required DOM elements');
            return;
        }

        // 初始化标签页切换
        this.initTabSwitching();

        // 显示当前页面信息
        this.displayPageInfo();

        // 加载当前页面的设置
        await this.loadPageSettings();
        
        // 加载并显示当前后缀列表
        await this.loadAndDisplaySuffixes();
        
        // 加载服务器列表
        await this.loadServers();
        
        // 从存储加载历史记录
        await this.loadTaskHistoryFromStorage();
        
        // 加载任务数据
        await this.loadTasks();
        
        // 绑定事件
        this.bindEvents();
    }

    initTabSwitching() {
        const tabBtns = document.querySelectorAll('.nav-link');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // 更新按钮状态
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 更新内容显示
                tabContents.forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${targetTab}-tab`).classList.add('active');
                
                // 如果切换到任务页面，刷新任务列表
                if (targetTab === 'tasks') {
                    this.refreshTasks();
                }
            });
        });
    }

    async getCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tab;
            console.log('Current tab:', this.currentTab);
        } catch (error) {
            console.error('Failed to get current tab:', error);
        }
    }

    displayPageInfo() {
        if (this.currentTab) {
            const pageInfoContainer = document.querySelector('.page-info');
            if (pageInfoContainer) {
                const domain = new URL(this.currentTab.url).hostname;
                pageInfoContainer.innerHTML = `当前页面: ${domain}`;
            }
        }
    }

    async loadPageSettings() {
        if (!this.currentTab) {
            this.toggle.checked = false;
            this.updateStatus(false);
            await this.updateBadge(false);
            return;
        }

        try {
            const pageKey = this.getPageKey(this.currentTab.url);
            const result = await chrome.storage.local.get([`pageSettings_${pageKey}`]);
            const pageSettings = result[`pageSettings_${pageKey}`];
            
            const isEnabled = pageSettings?.domModificationEnabled || false;
            
            this.toggle.checked = isEnabled;
            this.updateStatus(isEnabled);
            
            await this.updateBadge(isEnabled);
            
            console.log(`Page settings loaded for ${pageKey}:`, { domModificationEnabled: isEnabled });
        } catch (error) {
            console.error('Failed to load page settings:', error);
            this.toggle.checked = false;
            this.updateStatus(false);
            await this.updateBadge(false);
        }
    }

    async loadAndDisplaySuffixes() {
        try {
            const result = await chrome.storage.local.get(['customDownloadPatterns']);
            this.currentPatterns = result.customDownloadPatterns || [...this.defaultPatterns];
            this.displaySuffixes();
        } catch (error) {
            console.error('Failed to load patterns:', error);
            this.currentPatterns = [...this.defaultPatterns];
            this.displaySuffixes();
        }
    }

    displaySuffixes() {
        const suffixDisplay = document.getElementById('suffixDisplay');
        if (suffixDisplay) {
            const displayPatterns = this.currentPatterns.slice(0, 10); // 只显示前10个
            const tags = displayPatterns.map(pattern => 
                `<span class="suffix-tag">${pattern}</span>`
            ).join(' ');
            
            const moreInfo = this.currentPatterns.length > 10 ? 
                ` <span class="suffix-tag">+${this.currentPatterns.length - 10}更多</span>` : '';
            
            suffixDisplay.innerHTML = tags + moreInfo;
            
            console.log(`Displayed ${displayPatterns.length} patterns out of ${this.currentPatterns.length} total`);
        }
    }

    // 加载服务器列表 - 使用API
    async loadServers() {
        try {
            console.log('[API] Loading servers...');
            const servers = await apiClient.getServers();
            // 转换后端格式到前端格式
            const frontendServers = servers.map(server => apiClient.convertBackendToFrontend(server));
            this.renderServerList(frontendServers);
            console.log('[API] Loaded servers:', frontendServers.length);
        } catch (error) {
            console.error('[API] Failed to load servers:', error);
            this.renderServerList([]);
            // 显示错误提示
            this.showStatusNotification('服务器加载失败，请检查后端连接', 'error');
        }
    }

    // 渲染服务器列表
    renderServerList(servers) {
        const container = document.getElementById('serverList');
        if (!container) return;

        if (servers.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无服务器，点击"添加服务器"开始配置</div>';
            return;
        }

        container.innerHTML = '';
        
        servers.forEach((server, index) => {
            const serverElement = this.createServerItem(server, index);
            container.appendChild(serverElement);
        });
    }

    // 创建服务器项元素
    createServerItem(server, index) {
        const item = document.createElement('div');
        item.className = 'server-item';
        item.innerHTML = `
            <div class="server-info">
                <h6 class="server-name">${server.name}</h6>
                <p class="server-address">${server.host}${server.port !== 22 ? ':' + server.port : ''}</p>
            </div>
            <div class="server-controls">
                <button class="btn btn-outline-dark btn-sm edit-server-btn" data-server-id="${server.id}">编辑</button>
                <button class="btn btn-outline-danger btn-sm delete-server-btn" data-server-id="${server.id}">删除</button>
            </div>
        `;
        
        // 绑定编辑按钮事件
        const editBtn = item.querySelector('.edit-server-btn');
        editBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.editServer(server.id);
        });
        
        // 绑定删除按钮事件
        const deleteBtn = item.querySelector('.delete-server-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.deleteServer(server.id);
        });
        
        return item;
    }

    // 编辑服务器
    async editServer(serverId) {
        try {
            // 通知content script显示编辑服务器对话框
            await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'showEditServerDialog',
                serverId: serverId
            });
            
            // 关闭popup
            window.close();
        } catch (error) {
            console.log('Could not send message to content script:', error.message);
            alert('请在网页上使用此功能，或确保页面已加载Easy Translate扩展。');
        }
    }

    // 删除服务器 - 使用API
    async deleteServer(serverId) {
        try {
            // 先获取服务器信息用于确认
            const server = await apiClient.getServer(serverId);
            const frontendServer = apiClient.convertBackendToFrontend(server);
            
            if (!confirm(`确定要删除服务器 "${frontendServer.name}" 吗？`)) {
                return;
            }
            
            // 通过API删除服务器
            await apiClient.deleteServer(serverId);
            
            // 重新加载服务器列表
            await this.loadServers();
            
            console.log('[API] Server deleted:', serverId);
            this.showStatusNotification('服务器删除成功', 'success');
        } catch (error) {
            console.error('[API] Failed to delete server:', error);
            this.showStatusNotification('删除失败: ' + error.message, 'error');
        }
    }

    // 创建服务器 - 使用API
    async createServer(serverData) {
        try {
            console.log('[API] Creating server:', serverData);
            
            // 转换前端格式到后端格式
            const backendData = apiClient.convertFrontendToBackend(serverData);
            
            // 通过API创建服务器
            const result = await apiClient.createServer(backendData);
            
            // 重新加载服务器列表
            await this.loadServers();
            
            console.log('[API] Server created:', result);
            this.showStatusNotification('服务器创建成功', 'success');
            
            return result;
        } catch (error) {
            console.error('[API] Failed to create server:', error);
            this.showStatusNotification('创建失败: ' + error.message, 'error');
            throw error;
        }
    }

    // 更新服务器 - 使用API
    async updateServer(serverId, serverData) {
        try {
            console.log('[API] Updating server:', serverId, serverData);
            
            // 转换前端格式到后端格式
            const backendData = apiClient.convertFrontendToBackend(serverData);
            
            // 通过API更新服务器
            const result = await apiClient.updateServer(serverId, backendData);
            
            // 重新加载服务器列表
            await this.loadServers();
            
            console.log('[API] Server updated:', result);
            this.showStatusNotification('服务器更新成功', 'success');
            
            return result;
        } catch (error) {
            console.error('[API] Failed to update server:', error);
            this.showStatusNotification('更新失败: ' + error.message, 'error');
            throw error;
        }
    }

    // 任务管理相关方法
    async loadTasks() {
        try {
            // 获取活动任务
            const activeResponse = await chrome.runtime.sendMessage({ action: 'getActiveTasks' });
            let activeTasksData = [];
            if (activeResponse.success) {
                activeTasksData = activeResponse.tasks || [];
            }

            // 获取任务历史
            const historyResponse = await chrome.runtime.sendMessage({ action: 'getTaskHistory' });
            let historyTasks = [];
            if (historyResponse.success) {
                historyTasks = historyResponse.history || [];
            }

            // 合并从后端和本地存储的历史
            this.taskHistory.forEach(localTask => {
                if (!historyTasks.find(task => task.id === localTask.id)) {
                    historyTasks.push(localTask);
                }
            });

            // 合并所有任务并按开始时间排序（最新的在上面）
            const allTasks = [...activeTasksData, ...historyTasks];
            allTasks.sort((a, b) => {
                const timeA = new Date(a.startTime || a.createdAt || 0).getTime();
                const timeB = new Date(b.startTime || b.createdAt || 0).getTime();
                return timeB - timeA; // 降序排列，最新的在前
            });

            // 更新内部状态
            this.activeTasks = activeTasksData;
            this.taskHistory = historyTasks.slice(0, 10); // 限制历史记录为10个
            await this.saveTaskHistory(); // 保存合并后的历史

            this.renderAllTasks(allTasks);
        } catch (error) {
            console.error('Failed to load tasks:', error);
        }
    }

    async refreshTasks() {
        await this.loadTasks();
    }

    renderTasks() {
        // 这个方法现在被 renderAllTasks 替代
        this.refreshTasks();
    }

    renderAllTasks(allTasks) {
        const container = document.getElementById('taskList');
        if (!container) return;

        if (allTasks.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无任务</div>';
            return;
        }

        // 清空容器
        container.innerHTML = '';
        
        // 添加每个任务项
        allTasks.forEach(task => {
            const taskElement = this.createTaskItem(task);
            container.appendChild(taskElement);
        });
    }

    createTaskItem(task) {
        // 显示的文件名（优先显示实际文件名）
        const displayFileName = task.actualFileName || task.fileName;
        // 悬浮显示的下载链接 - 尝试多个可能的字段名
        let downloadUrl = task.url || task.downloadUrl || task.originalUrl || task.sourceUrl || task.link || task.href;
        
        // 如果还是没有找到，尝试从任务对象的其他属性中查找
        if (!downloadUrl) {
            // 打印任务对象以便调试
            console.log('Task object for debugging:', task);
            
            // 尝试查找所有包含 'url' 的属性
            const urlKeys = Object.keys(task).filter(key => 
                key.toLowerCase().includes('url') || 
                key.toLowerCase().includes('link') ||
                key.toLowerCase().includes('href') ||
                key.toLowerCase().includes('src')
            );
            
            if (urlKeys.length > 0) {
                console.log('Found URL-like keys:', urlKeys);
                downloadUrl = task[urlKeys[0]]; // 使用第一个找到的
            }
        }
        
        // 最终回退值
        if (!downloadUrl) {
            downloadUrl = '未知链接';
        }
        
        // 确定下载状态和上传状态 - 使用更简洁的文字
        let downloadStatus, uploadStatus;
        let downloadStatusClass, uploadStatusClass;
        
        // 根据任务状态确定下载和上传状态
        switch (task.status) {
            case 'pending':
                downloadStatus = '待下载';
                downloadStatusClass = 'pending';
                uploadStatus = '未开始';
                uploadStatusClass = 'not-started';
                break;
            case 'downloading':
                const downloadProgress = task.totalBytes > 0 ? 
                    Math.round((task.downloadedBytes / task.totalBytes) * 100) : 0;
                downloadStatus = `下载中 ${downloadProgress}%`;
                downloadStatusClass = 'downloading';
                uploadStatus = '等待下载完成';
                uploadStatusClass = 'not-started';
                break;
            case 'download_complete':
                downloadStatus = '下载完成';
                downloadStatusClass = 'download-complete';
                uploadStatus = '准备上传';
                uploadStatusClass = 'ready-to-upload';
                break;
            case 'transferring':
                const uploadProgress = task.totalBytes > 0 ? 
                    Math.round((task.transferredBytes / task.totalBytes) * 100) : 0;
                downloadStatus = '下载完成';
                downloadStatusClass = 'download-complete';
                uploadStatus = `上传中 ${uploadProgress}%`;
                uploadStatusClass = 'uploading';
                break;
            case 'complete':
                downloadStatus = '下载完成';
                downloadStatusClass = 'download-complete';
                uploadStatus = '上传完成';
                uploadStatusClass = 'upload-complete';
                break;
            case 'failed':
                // 需要判断是下载失败还是上传失败
                if (task.downloadCompleteTime) {
                    downloadStatus = '下载完成';
                    downloadStatusClass = 'download-complete';
                    uploadStatus = '上传失败';
                    uploadStatusClass = 'upload-failed';
                } else {
                    downloadStatus = '下载失败';
                    downloadStatusClass = 'download-failed';
                    uploadStatus = '未开始';
                    uploadStatusClass = 'not-started';
                }
                break;
            case 'cancelled':
                downloadStatus = '已取消';
                downloadStatusClass = 'download-failed';
                uploadStatus = '未开始';
                uploadStatusClass = 'not-started';
                break;
            default:
                downloadStatus = '未知状态';
                downloadStatusClass = 'download-failed';
                uploadStatus = '未开始';
                uploadStatusClass = 'not-started';
        }
        
        // 下载按钮逻辑 - 使用更简洁的文字
        let downloadBtnText = '下载';
        let downloadBtnTitle = '清理并重新下载';
        let downloadBtnDisabled = false;
        
        if (task.status === 'downloading') {
            downloadBtnText = '取消';
            downloadBtnTitle = '取消下载';
        } else if (downloadStatusClass === 'download-complete') {
            downloadBtnText = '重试';
            downloadBtnTitle = '清理并重新下载';
        } else if (downloadStatusClass === 'download-failed') {
            downloadBtnText = '重试';
            downloadBtnTitle = '重试下载';
        }
        
        // 上传按钮逻辑 - 使用更简洁的文字
        let uploadBtnText = '上传';
        let uploadBtnTitle = '重新上传';
        let uploadBtnDisabled = true;
        
        if (task.status === 'download_complete') {
            uploadBtnDisabled = false;
            uploadBtnText = '上传';
            uploadBtnTitle = '开始上传';
        } else if (task.status === 'transferring') {
            uploadBtnDisabled = false;
            uploadBtnText = '取消';
            uploadBtnTitle = '取消上传';
        } else if (uploadStatusClass === 'upload-complete') {
            uploadBtnDisabled = false;
            uploadBtnText = '重试';
            uploadBtnTitle = '重新上传';
        } else if (uploadStatusClass === 'upload-failed') {
            uploadBtnDisabled = false;
            uploadBtnText = '重试';
            uploadBtnTitle = '重试上传';
        }
        
        const item = document.createElement('div');
        item.className = 'task-item';
        item.innerHTML = `
            <div class="task-filename" title="${downloadUrl}">
                ${displayFileName}
            </div>
            <div class="task-download-status ${downloadStatusClass}">
                ${downloadStatus}
            </div>
            <button class="task-download-btn" 
                    title="${downloadBtnTitle}"
                    onclick="popupController.handleDownloadAction('${task.id}', '${task.status}')">
                ${downloadBtnText}
            </button>
            <div class="task-upload-status ${uploadStatusClass}">
                ${uploadStatus}
            </div>
            <button class="task-upload-btn" 
                    title="${uploadBtnTitle}"
                    ${uploadBtnDisabled ? 'disabled' : ''}
                    onclick="popupController.handleUploadAction('${task.id}', '${task.status}')">
                ${uploadBtnText}
            </button>
        `;
        
        return item;
    }

    async handleDownloadAction(taskId, currentStatus) {
        try {
            let action, message;
            
            switch (currentStatus) {
                case 'downloading':
                case 'transferring':
                    action = 'cancelTask';
                    message = '取消任务';
                    if (!confirm('确定要取消这个任务吗？')) return;
                    break;
                case 'download_complete':
                case 'complete':
                    action = 'retryTask';
                    message = '重新下载';
                    if (!confirm('确定要重新下载这个文件吗？')) return;
                    break;
                case 'failed':
                case 'cancelled':
                    action = 'retryTask';
                    message = '重试下载';
                    break;
                default:
                    action = 'retryTask';
                    message = '开始下载';
            }
            
            const response = await chrome.runtime.sendMessage({
                action: action,
                data: { taskId }
            });
            
            if (response.success) {
                console.log(`${message} successful`);
                await this.refreshTasks();
            } else {
                console.error(`Failed to ${message}:`, response.error);
                alert(`${message}失败: ` + response.error);
            }
        } catch (error) {
            console.error(`Error in download action:`, error);
            alert('操作失败: ' + error.message);
        }
    }

    async handleUploadAction(taskId, currentStatus) {
        try {
            let action, message, successMessage;
            
            switch (currentStatus) {
                case 'download_complete':
                    action = 'startTransfer';
                    message = '开始上传';
                    successMessage = '上传已开始，请查看进度';
                    break;
                case 'transferring':
                    action = 'cancelTask';
                    message = '取消上传';
                    successMessage = '上传已取消';
                    if (!confirm('确定要取消上传吗？')) return;
                    break;
                case 'complete':
                    action = 'reuploadTask';
                    message = '重新上传';
                    successMessage = '重新上传已开始';
                    if (!confirm('确定要重新上传这个文件吗？')) return;
                    break;
                case 'failed':
                    // 判断是否是上传失败
                    action = 'reuploadTask';
                    message = '重试上传';
                    successMessage = '重试上传已开始';
                    break;
                default:
                    console.warn('Upload action not available for status:', currentStatus);
                    alert('当前状态下无法执行上传操作');
                    return;
            }
            
            console.log(`Starting ${message} for task ${taskId}`);
            
            const response = await chrome.runtime.sendMessage({
                action: action,
                data: { taskId }
            });
            
            if (response.success) {
                console.log(`${message} successful`);
                await this.refreshTasks();
                
                // 显示成功消息
                if (action === 'startTransfer' || action === 'reuploadTask') {
                    // 对于开始上传的操作，显示更友好的提示
                    this.showUploadNotification(successMessage);
                }
            } else {
                console.error(`Failed to ${message}:`, response.error);
                alert(`${message}失败: ` + response.error);
            }
        } catch (error) {
            console.error(`Error in upload action:`, error);
            alert('操作失败: ' + error.message);
        }
    }

    // 显示上传通知
    showUploadNotification(message) {
        // 创建一个临时的通知元素
        const notification = document.createElement('div');
        notification.className = 'upload-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            font-size: 14px;
            font-weight: 500;
        `;
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    async retryTask(taskId) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'retryTask',
                data: { taskId }
            });
            
            if (response.success) {
                console.log('Task retried successfully');
                await this.refreshTasks();
            } else {
                console.error('Failed to retry task:', response.error);
                alert('重试失败: ' + response.error);
            }
        } catch (error) {
            console.error('Error retrying task:', error);
            alert('重试失败: ' + error.message);
        }
    }

    async reuploadTask(taskId) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'reuploadTask',
                data: { taskId }
            });
            
            if (response.success) {
                console.log('Task reuploaded successfully');
                await this.refreshTasks();
                alert('重新上传已开始');
            } else {
                console.error('Failed to reupload task:', response.error);
                alert('重新上传失败: ' + response.error);
            }
        } catch (error) {
            console.error('Error reuploading task:', error);
            alert('重新上传失败: ' + error.message);
        }
    }

    async startTransfer(taskId) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'startTransfer',
                data: { taskId }
            });
            
            if (response.success) {
                console.log('Transfer started successfully');
                await this.refreshTasks();
                alert('传输已开始');
            } else {
                console.error('Failed to start transfer:', response.error);
                alert('传输失败: ' + response.error);
            }
        } catch (error) {
            console.error('Error starting transfer:', error);
            alert('传输失败: ' + error.message);
        }
    }

    async cancelTask(taskId) {
        if (!confirm('确定要取消这个任务吗？')) return;
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'cancelTask',
                data: { taskId }
            });
            
            if (response.success) {
                console.log('Task cancelled successfully');
                await this.refreshTasks();
            } else {
                console.error('Failed to cancel task:', response.error);
                alert('取消失败: ' + response.error);
            }
        } catch (error) {
            console.error('Error cancelling task:', error);
            alert('取消失败: ' + error.message);
        }
    }

    bindEvents() {
        // 开关变化事件
        this.toggle.addEventListener('change', async (e) => {
            const isEnabled = e.target.checked;
            await this.savePageSettings(isEnabled);
            this.updateStatus(isEnabled);
            
            // 通知content script更新状态
            await this.notifyContentScript(isEnabled);
        });

        // 编辑按钮事件
        document.getElementById('editSuffixBtn').addEventListener('click', () => {
            this.showEditModal();
        });

        // 添加服务器按钮事件
        const addServerBtn = document.getElementById('addServerBtn');
        if (addServerBtn) {
            addServerBtn.addEventListener('click', () => {
                this.showAddServerDialog();
            });
        }

        // 刷新任务按钮事件
        const refreshTasksBtn = document.getElementById('refreshTasksBtn');
        if (refreshTasksBtn) {
            refreshTasksBtn.addEventListener('click', () => {
                this.refreshTasks();
            });
        }

        // 模态框事件
        this.bindModalEvents();

        // 监听任务更新消息
        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === 'taskUpdate') {
                this.handleTaskUpdate(message.taskId, message.task);
            }
        });

        // 监听来自content script的消息
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.action === 'taskUpdated') {
                this.loadTaskHistory();
            } else if (message.action === 'serverListUpdated') {
                // 更新服务器列表
                this.renderServerList(message.servers || []);
            }
        });
    }

    async handleTaskUpdate(taskId, updatedTask) {
        console.log(`Task update received for ${taskId}:`, updatedTask.status);
        
        // 更新活动任务列表
        const taskIndex = this.activeTasks.findIndex(task => task.id === taskId);
        if (taskIndex !== -1) {
            const oldStatus = this.activeTasks[taskIndex].status;
            this.activeTasks[taskIndex] = updatedTask;
            
            // 检查状态变化并显示通知
            this.notifyStatusChange(taskId, oldStatus, updatedTask.status, updatedTask);
            
            // 如果任务完成，移动到历史记录
            if (updatedTask.status === 'complete' || updatedTask.status === 'failed' || updatedTask.status === 'cancelled') {
                this.activeTasks.splice(taskIndex, 1);
                
                // 添加到历史记录开头
                this.taskHistory.unshift(updatedTask);
                
                // 保存历史记录
                await this.saveTaskHistory();
            }
        } else {
            // 如果在活动任务中没找到，可能是新任务
            if (updatedTask.status !== 'complete' && updatedTask.status !== 'failed' && updatedTask.status !== 'cancelled') {
                this.activeTasks.push(updatedTask);
            }
        }
        
        // 重新渲染任务列表
        this.renderTasks();
    }

    // 通知状态变化
    notifyStatusChange(taskId, oldStatus, newStatus, task) {
        const fileName = task.actualFileName || task.fileName;
        
        // 关键状态变化的通知
        if (oldStatus !== newStatus) {
            switch (newStatus) {
                case 'download_complete':
                    if (task.serverId) {
                        this.showStatusNotification(`文件 "${fileName}" 下载完成，准备开始上传...`, 'info');
                    } else {
                        this.showStatusNotification(`文件 "${fileName}" 下载完成`, 'success');
                    }
                    break;
                case 'transferring':
                    this.showStatusNotification(`开始上传文件 "${fileName}"`, 'info');
                    break;
                case 'complete':
                    this.showStatusNotification(`文件 "${fileName}" 上传完成！`, 'success');
                    break;
                case 'failed':
                    const isUploadFailed = task.downloadCompleteTime;
                    const failureType = isUploadFailed ? '上传' : '下载';
                    this.showStatusNotification(`文件 "${fileName}" ${failureType}失败`, 'error');
                    break;
            }
        }
    }

    // 显示状态通知
    showStatusNotification(message, type = 'info') {
        const colors = {
            info: '#3b82f6',
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b'
        };
        
        const notification = document.createElement('div');
        notification.className = 'status-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${colors[type]};
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            font-size: 14px;
            font-weight: 500;
            max-width: 400px;
            text-align: center;
        `;
        
        document.body.appendChild(notification);
        
        // 根据类型决定显示时间
        const duration = type === 'error' ? 5000 : 3000;
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, duration);
    }

    // 保存任务历史到本地存储
    async saveTaskHistory() {
        try {
            await chrome.storage.local.set({
                popupTaskHistory: this.taskHistory
            });
            console.log('Task history saved:', this.taskHistory.length, 'tasks');
        } catch (error) {
            console.error('Failed to save task history:', error);
        }
    }

    // 从本地存储加载任务历史
    async loadTaskHistoryFromStorage() {
        try {
            const result = await chrome.storage.local.get(['popupTaskHistory']);
            if (result.popupTaskHistory && Array.isArray(result.popupTaskHistory)) {
                this.taskHistory = result.popupTaskHistory.slice(0, 10); // 确保不超过10个
                console.log('Task history loaded from storage:', this.taskHistory.length, 'tasks');
            }
        } catch (error) {
            console.error('Failed to load task history from storage:', error);
        }
    }

    bindModalEvents() {
        const modal = document.getElementById('editModal');
        const closeBtn = document.getElementById('closeModalBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const saveBtn = document.getElementById('saveBtn');
        const restoreBtn = document.getElementById('restoreBtn');
        const addBtn = document.getElementById('addSuffixBtn');
        const input = document.getElementById('suffixInput');

        // 关闭模态框
        const closeModal = () => {
            modal.style.display = 'none';
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // 点击背景关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // ESC关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display !== 'none') {
                closeModal();
            }
        });

        // 添加后缀
        const addSuffix = () => {
            const value = input.value.trim();
            if (value && !this.currentPatterns.includes(value)) {
                this.currentPatterns.push(value);
                this.updateModalList();
                input.value = '';
            }
        };

        addBtn.addEventListener('click', addSuffix);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSuffix();
            }
        });
        
        // 保存
        saveBtn.addEventListener('click', async () => {
            const saveBtn = document.getElementById('saveBtn');
            const originalText = saveBtn.textContent;
            
            // 显示保存中状态
            saveBtn.textContent = '保存中...';
            saveBtn.disabled = true;
            
            try {
                await this.savePatterns();
                
                // 延迟关闭模态框，让用户看到保存成功的反馈
                setTimeout(() => {
                    closeModal();
                    saveBtn.disabled = false;
                }, 1000);
                
            } catch (error) {
                console.error('Save failed:', error);
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        });

        // 还原默认
        restoreBtn.addEventListener('click', () => {
            if (confirm('确定要还原到默认设置吗？这将删除所有自定义后缀。')) {
                this.currentPatterns = [...this.defaultPatterns];
                this.updateModalList();
            }
        });
    }

    showEditModal() {
        const modal = document.getElementById('editModal');
        modal.style.display = 'flex';
        this.updateModalList();
    }

    updateModalList() {
        const container = document.getElementById('suffixList');
        container.innerHTML = this.currentPatterns.map((pattern, index) => `
            <div class="suffix-item">
                <span>${pattern}</span>
                <button class="remove-suffix-btn" onclick="popupController.removePattern(${index})">删除</button>
            </div>
        `).join('');
    }

    removePattern(index) {
        this.currentPatterns.splice(index, 1);
        this.updateModalList();
    }

    async savePatterns() {
        try {
            // 保存到存储
            await chrome.storage.local.set({
                customDownloadPatterns: this.currentPatterns
            });

            console.log('Patterns saved:', this.currentPatterns);

            // 更新显示
            this.displaySuffixes();

            // 通知content script更新模式
            if (this.currentTab) {
                try {
                    await chrome.tabs.sendMessage(this.currentTab.id, {
                        action: 'updateCustomPatterns'
                    });
                    console.log('Content script notified of pattern update');
                } catch (error) {
                    console.log('Could not notify content script (page may not have it loaded):', error);
                }
            }

            // 显示保存成功
            this.showSaveSuccess();

        } catch (error) {
            console.error('Failed to save patterns:', error);
            this.showSaveError();
            throw error;
        }
    }

    showSaveSuccess() {
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '✓ 已保存';
        saveBtn.style.backgroundColor = '#10b981';
        
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.backgroundColor = '#3b82f6';
        }, 2000);
    }

    showSaveError() {
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '✗ 失败';
        saveBtn.style.backgroundColor = '#ef4444';
        
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.backgroundColor = '#3b82f6';
        }, 2000);
    }

    async savePageSettings(isEnabled) {
        if (!this.currentTab) return;

        try {
            const pageKey = this.getPageKey(this.currentTab.url);
            await chrome.storage.local.set({
                [`pageSettings_${pageKey}`]: {
                    domModificationEnabled: isEnabled,
                    lastModified: new Date().toISOString()
                }
            });
            console.log(`Page settings saved for ${pageKey}:`, { domModificationEnabled: isEnabled });
        } catch (error) {
            console.error('Failed to save page settings:', error);
        }
    }

    updateStatus(isEnabled) {
        if (this.statusIndicator) {
            this.statusIndicator.classList.toggle('enabled', isEnabled);
            this.statusIndicator.classList.toggle('disabled', !isEnabled);
        }
        
        const statusText = document.getElementById('statusText');
        if (statusText) {
            if (isEnabled) {
                statusText.textContent = '开启';
                statusText.classList.remove('disabled');
                statusText.classList.add('enabled');
            } else {
                statusText.textContent = '关闭';
                statusText.classList.remove('enabled');
                statusText.classList.add('disabled');
            }
        }
    }

    async notifyContentScript(isEnabled) {
        if (!this.currentTab) return;

        try {
            await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'toggleDomModification',
                enabled: isEnabled
            });
            console.log(`Notified content script: ${isEnabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.log('Could not send message to content script (page may not have it loaded):', error.message);
        }
    }

    getPageKey(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            return 'unknown_page';
        }
    }

    async updateBadge(isEnabled) {
        if (!this.currentTab) return;

        try {
            const tabId = this.currentTab.id;
            if (isEnabled) {
                await chrome.action.setBadgeText({ text: "ON", tabId });
                await chrome.action.setBadgeBackgroundColor({ color: "#059669", tabId });
            } else {
                await chrome.action.setBadgeText({ text: "OFF", tabId });
                await chrome.action.setBadgeBackgroundColor({ color: "#6b7280", tabId });
            }
        } catch (error) {
            console.log('Could not update badge:', error.message);
        }
    }

    // 调用网页版的添加服务器对话框
    async showAddServerDialog() {
        try {
            // 通知content script显示添加服务器对话框
            await chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'showAddServerDialog'
            });
            
            // 关闭popup
            window.close();
        } catch (error) {
            console.log('Could not send message to content script:', error.message);
            // 如果content script不可用，显示提示
            alert('请在网页上使用此功能，或确保页面已加载Easy Translate扩展。');
        }
    }
}

// 全局实例，供HTML中的onclick使用
let popupController;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', async () => {
    popupController = new PopupController();
    await popupController.init();
});

// 示例：点击页面时的简单交互
document.addEventListener('click', function() {
    console.log('Popup clicked');
}); 