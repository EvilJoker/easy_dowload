// Easy Translate Content Script - 页面级控制版本
import ApiClient from '../shared/api-client.js';
// 导入共享的服务器对话框模块
import ServerDialog from '../shared/server-dialog.js';

const apiClient = new ApiClient();
apiClient.setBaseUrl('http://localhost:5000');

class EasyTranslateContent {
    constructor() {
        this.config = {
            // 默认内置的下载模式
            defaultDownloadPatterns: [
                /\.(zip|rar|7z|tar|gz|exe|msi|deb|rpm|dmg|iso|pdf|doc|docx|xls|xlsx|ppt|pptx|mp4|avi|mkv|mp3|wav)$/i,
                /\/download\//i,
                /download\?/i,
                /attachment/i,
                /file\?/i,
                /releases\/download\//i
            ],
            buttonClass: 'easy-translate-btn',
            dialogClass: 'easy-translate-dialog'
        };
        
        this.customPatterns = []; // 用户自定义的匹配模式
        this.isActive = false; // 插件是否处于活动状态
        this.observer = null;
        this.debounceTimer = null;
        this.injectedStyleElement = null; // 跟踪注入的CSS元素
        this.pageKey = this.getPageKey(); // 当前页面的唯一标识
        this.transferButtons = new WeakMap();
        this.isInitialized = false;
        this.monitoredTasks = new Map(); // 添加任务监控映射
        
        // 初始化服务器对话框
        this.serverDialog = new ServerDialog();
        
        // 设置消息监听并检查初始状态
        this.init();
    }

    async init() {
        console.log(`Easy Translate: Initializing for page: ${this.pageKey}`);
        
        // 设置消息监听
        this.setupMessageListener();
        
        // 加载自定义匹配模式
        await this.loadCustomPatterns();
        
        // 检查当前页面的初始设置状态
        try {
            if (chrome?.storage) {
                const result = await chrome.storage.local.get([`pageSettings_${this.pageKey}`]);
                const pageSettings = result[`pageSettings_${this.pageKey}`];
                const isEnabled = pageSettings?.domModificationEnabled || false;
                
                if (isEnabled) {
                    console.log(`Easy Translate: Page ${this.pageKey} initial state is enabled, activating...`);
                    await this.activate();
                } else {
                    console.log(`Easy Translate: Page ${this.pageKey} initial state is disabled, staying inactive`);
                }
                
                // 更新初始badge状态（不阻塞初始化）
                this.updateBadge(isEnabled).catch(error => {
                    console.log(`Easy Translate: Badge update failed during init for page ${this.pageKey}:`, error.message);
                });
            }
        } catch (error) {
            console.log(`Easy Translate: Could not load initial settings for page ${this.pageKey}, staying inactive:`, error.message);
            // 确保badge更新不会因为错误而阻塞
            this.updateBadge(false).catch(badgeError => {
                console.log(`Easy Translate: Badge update failed during error handling for page ${this.pageKey}:`, badgeError.message);
            });
        }
    }

    // 加载自定义匹配模式
    async loadCustomPatterns() {
        try {
            const result = await chrome.storage.local.get(['customDownloadPatterns']);
            const patterns = result.customDownloadPatterns || [];
            
            this.customPatterns = patterns.map(pattern => {
                try {
                    // 如果是正则表达式字符串，转换为RegExp对象
                    if (typeof pattern === 'string') {
                        // 检查是否是正则表达式格式 /pattern/flags
                        const regexMatch = pattern.match(/^\/(.+)\/([gimuy]*)$/);
                        if (regexMatch) {
                            return new RegExp(regexMatch[1], regexMatch[2]);
                        } else {
                            // 普通字符串，创建简单的包含匹配
                            return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                        }
                    }
                    return pattern;
                } catch (error) {
                    console.warn('Invalid custom pattern:', pattern, error);
                    return null;
                }
            }).filter(Boolean);
            
            console.log(`Easy Translate: Loaded ${this.customPatterns.length} custom patterns for page ${this.pageKey}`);
        } catch (error) {
            console.error('Failed to load custom patterns:', error);
            this.customPatterns = [];
        }
    }

    // 检查是否是下载链接（优先使用自定义模式，如果没有自定义模式则使用内置模式）
    isDownloadLink(url) {
        if (!url || url.startsWith('javascript:') || url.startsWith('mailto:')) {
            return false;
        }
        
        // 如果有自定义模式，则只使用自定义模式（完全替换默认模式）
        if (this.customPatterns.length > 0) {
            for (const pattern of this.customPatterns) {
                try {
                    if (pattern.test(url)) {
                        return true;
                    }
                } catch (error) {
                    console.warn('Error testing custom pattern:', pattern, error);
                }
            }
            // 如果有自定义模式但都不匹配，则返回false（不检查默认模式）
            return false;
        }
        
        // 只有在没有自定义模式时才使用默认模式
        return this.config.defaultDownloadPatterns.some(pattern => pattern.test(url));
    }

    // 生成页面唯一key（基于域名）
    getPageKey() {
        try {
            const urlObj = new URL(window.location.href);
            return urlObj.hostname;
        } catch {
            return 'unknown_page';
        }
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
            console.log(`Easy Translate: Received message for page ${this.pageKey}:`, request);
            
            if (request.action === 'toggleDomModification') {
                console.log(`Easy Translate: Toggle DOM modification for page ${this.pageKey}:`, request.enabled);
                
                if (request.enabled) {
                    await this.activate();
                } else {
                    await this.deactivate();
                }
                
                // 更新badge状态（不阻塞响应）
                this.updateBadge(request.enabled).catch(error => {
                    console.log(`Easy Translate: Badge update failed during toggle for page ${this.pageKey}:`, error.message);
                });
                
                sendResponse({success: true, active: this.isActive});
            } else if (request.action === 'updateCustomPatterns') {
                console.log(`Easy Translate: Updating custom patterns for page ${this.pageKey}`);
                
                // 重新加载自定义匹配模式
                await this.loadCustomPatterns();
                
                // 如果当前是活动状态，重新评估所有按钮
                if (this.isActive) {
                    console.log(`Easy Translate: Re-evaluating all buttons with new patterns`);
                    this.reEvaluateAllButtons();
                }
                
                sendResponse({success: true, patternsCount: this.customPatterns.length});
            } else if (request.action === 'showAddServerDialog') {
                console.log(`Easy Translate: Show add server dialog for page ${this.pageKey}`);
                
                // 调用网页版的添加服务器对话框
                this.serverDialog.showAddServerDialog();
                
                sendResponse && sendResponse({success: true});
            } else if (request.action === 'showEditServerDialog') {
                console.log(`Easy Translate: Show edit server dialog for page ${this.pageKey}`, request.serverId);
                
                // 调用网页版的编辑服务器对话框
                await this.serverDialog.showEditServerDialog(request.serverId);
                
                sendResponse && sendResponse({success: true});
            } else if (request.action === 'showTransferDialog') {
                console.log(`Easy Translate: Show transfer dialog for page ${this.pageKey}`, request.url);
                
                // 显示传输对话框
                this.showTransferDialog(request.url);
                
                sendResponse({success: true});
            } else if (request.action === 'taskUpdate') {
                console.log(`Easy Translate: Task update received for page ${this.pageKey}:`, request.taskId, request.task.status);
                
                // 处理任务状态更新
                this.handleTaskStatusChange(request.taskId, request.task);
                
                sendResponse({success: true});
            } else if (request.action === 'requestCurrentStatus') {
                console.log(`Easy Translate: Status request for page ${this.pageKey}, active: ${this.isActive}`);
                sendResponse({active: this.isActive});
            }
            
            return true; // Keep message channel open for async response
        });
    }

    async handleToggle(enabled) {
        if (enabled && !this.isActive) {
            // 从关闭切换到开启：初始化所有功能
            console.log(`Easy Translate: Activating for page ${this.pageKey}...`);
            await this.activate();
            // 更新badge（不阻塞）
            this.updateBadge(true).catch(error => {
                console.log(`Easy Translate: Badge update failed during activation for page ${this.pageKey}:`, error.message);
            });
        } else if (!enabled && this.isActive) {
            // 从开启切换到关闭：清理所有DOM修改
            console.log(`Easy Translate: Deactivating for page ${this.pageKey}...`);
            this.deactivate();
            // 更新badge（不阻塞）
            this.updateBadge(false).catch(error => {
                console.log(`Easy Translate: Badge update failed during deactivation for page ${this.pageKey}:`, error.message);
            });
        }
    }

    async activate() {
        try {
            // 检查Chrome APIs可用性
        if (!chrome?.runtime || !chrome?.storage) {
                console.warn(`Easy Translate: Chrome APIs not available for page ${this.pageKey}`);
            return;
        }

            this.isActive = true;

            // 首先注入CSS
            await this.injectCSS();

            // 等待页面完全加载后再开始DOM操作
        if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.startDomOperations());
        } else {
                this.startDomOperations();
            }
        } catch (error) {
            console.error(`Easy Translate: Activation failed for page ${this.pageKey}:`, error);
            this.isActive = false;
        }
    }

    startDomOperations() {
        if (!this.isActive) return; // 双重检查，确保仍然处于激活状态
        
        console.log(`Easy Translate: Starting DOM operations for page ${this.pageKey}...`);
        this.detectAndAddButtons();
        this.setupObserver();
    }

    deactivate() {
        console.log(`Easy Translate: Cleaning up DOM modifications for page ${this.pageKey}...`);
        
        this.isActive = false;
        
        // 清理所有DOM修改
        this.removeAllButtons();
        this.removeAnyDialogs();
        
        // 移除注入的CSS
        this.removeCSS();
        
        // 停止observer
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        
        // 清理定时器
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        
        console.log(`Easy Translate: Deactivated completely for page ${this.pageKey}`);
    }

    setupObserver() {
        if (!this.isActive) return;

        // 清理现有observer
        if (this.observer) {
            this.observer.disconnect();
        }

        this.observer = new MutationObserver((mutations) => {
            if (!this.isActive) return; // 确保仍然处于激活状态
            
            let shouldCheck = false;
            
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE && 
                            (node.tagName === 'A' || node.querySelector('a'))) {
                            shouldCheck = true;
                            break;
                        }
                    }
                    if (shouldCheck) break;
                }
            }
            
            if (shouldCheck) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    if (this.isActive) { // 再次检查状态
                        this.detectAndAddButtons();
                    }
                }, 300);
            }
        });
        
        this.observer.observe(document.body, { childList: true, subtree: true });
    }

    detectAndAddButtons() {
        if (!this.isActive) return; // 安全检查

        const links = document.querySelectorAll('a[href]');
        let addedCount = 0;
        
        for (const link of links) {
            if (!this.isActive) break; // 如果在处理过程中被停用，立即停止
            
            if (this.isDownloadLink(link.href) && !this.hasTransferButton(link)) {
                if (this.addTransferButton(link)) {
                    addedCount++;
                }
            }
        }
        
        if (addedCount > 0) {
            console.log(`Easy Translate: Added ${addedCount} buttons for page ${this.pageKey}`);
        }
    }

    removeAllButtons() {
        const buttons = document.querySelectorAll(`.${this.config.buttonClass}`);
        buttons.forEach(button => button.remove());
        
        if (buttons.length > 0) {
            console.log(`Easy Translate: Removed ${buttons.length} buttons from page ${this.pageKey}`);
        }
    }

    removeAnyDialogs() {
        // 移除任何可能打开的对话框
        const dialogs = document.querySelectorAll(`.${this.config.dialogClass}, .easy-translate-add-server-dialog`);
        dialogs.forEach(dialog => dialog.remove());
        
        if (dialogs.length > 0) {
            console.log(`Easy Translate: Removed ${dialogs.length} dialogs from page ${this.pageKey}`);
        }
    }

    hasTransferButton(link) {
        return link.querySelector(`.${this.config.buttonClass}`) || 
               link.previousElementSibling?.classList.contains(this.config.buttonClass);
    }

    addTransferButton(link) {
        const button = document.createElement('button');
        button.className = this.config.buttonClass;
        button.setAttribute('data-url', link.href);
        button.title = 'Easy Translate - 传输到服务器';
        
        // SVG图标
        button.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7,10 12,15 17,10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
        `;
        
        // 简化的样式设置
        Object.assign(button.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '4px',
            padding: '2px',
            backgroundColor: '#fbbf24',
            color: '#000',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            minWidth: '18px',
            minHeight: '18px'
        });
        
        // 事件处理
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showTransferDialog(link.href);
        });
        
        // 悬停效果
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = '#f59e0b';
            button.style.transform = 'scale(1.1)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = '#fbbf24';
            button.style.transform = 'scale(1)';
        });
        
        // 插入按钮
        try {
            link.parentElement?.insertBefore(button, link);
            return true;
        } catch {
            return false;
        }
    }

    showTransferDialog(url) {
        try {
            this.removeExistingDialog();
            const dialog = this.createTransferDialog(url);
            if (dialog) {
                document.body.appendChild(dialog);
                this.loadServers(dialog);
            }
        } catch (error) {
            console.error('Dialog error:', error);
            alert(`准备传输: ${url}\n请检查插件状态`);
        }
    }

    removeExistingDialog() {
        document.querySelector(`.${this.config.dialogClass}`)?.remove();
    }

    createTransferDialog(url) {
        const dialog = document.createElement('div');
        dialog.className = this.config.dialogClass;
        
        Object.assign(dialog.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '999999',
            padding: '20px'
        });
        
        dialog.innerHTML = `
            <div style="background: white; border-radius: 8px; padding: 24px; max-width: 400px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h3 style="margin: 0; font-size: 16px; color: #333;">Easy Translate</h3>
                    <button class="close-btn" style="background: none; border: none; cursor: pointer; font-size: 18px; color: #666;">×</button>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 6px; font-size: 14px; color: #555;">FROM 文件:</label>
                    <div style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; background: #f9f9f9; font-size: 12px; word-break: break-all; max-height: 60px; overflow-y: auto;">${url}</div>
                </div>
                
                <div style="margin-bottom: 16px;">
                    <label style="display: block; margin-bottom: 6px; font-size: 14px; color: #555;">TO 服务器:</label>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <select class="server-select" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <option disabled selected>加载中...</option>
                        </select>
                        <button class="edit-server-btn" style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; background: #f8f9fa; cursor: pointer; font-size: 12px;" disabled>编辑</button>
                    </div>
                    <div class="server-info" style="margin-top: 6px; padding: 6px 8px; background: #f8f9fa; border-radius: 3px; font-size: 12px; color: #666; min-height: 16px; display: none;">
                        <span class="server-details">请选择服务器以查看详细信息</span>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 6px; font-size: 14px; color: #555;">路径:</label>
                    <input type="text" placeholder="/home/uploads/" class="target-path" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="cancel-btn" style="padding: 8px 16px; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer;">取消</button>
                    <button class="add-server-btn" style="padding: 8px 16px; border: 1px solid #ddd; border-radius: 4px; background: #f0f0f0; cursor: pointer;">添加服务器</button>
                    <button class="transfer-btn" style="padding: 8px 16px; border: none; border-radius: 4px; background: #fbbf24; color: black; cursor: pointer;">开始传输</button>
                </div>
            </div>
        `;
        
        this.bindDialogEvents(dialog, url);
        return dialog;
    }

    bindDialogEvents(dialog, url) {
        // 关闭事件
        const closeDialog = () => dialog.remove();
        
        dialog.querySelector('.close-btn').addEventListener('click', closeDialog);
        dialog.querySelector('.cancel-btn').addEventListener('click', closeDialog);
        
        // 传输按钮
        dialog.querySelector('.transfer-btn').addEventListener('click', () => {
            this.startTransfer(dialog, url);
        });
        
        // 添加服务器
        dialog.querySelector('.add-server-btn').addEventListener('click', () => {
            this.showAddServerDialog(dialog);
        });
        
        // 编辑服务器
        dialog.querySelector('.edit-server-btn').addEventListener('click', () => {
            this.editSelectedServer(dialog);
        });
        
        // 服务器选择
        dialog.querySelector('.server-select').addEventListener('change', (e) => {
            const targetPath = dialog.querySelector('.target-path');
            const editBtn = dialog.querySelector('.edit-server-btn');
            const serverInfo = dialog.querySelector('.server-info');
            const serverDetails = dialog.querySelector('.server-details');
            
            if (e.target.selectedIndex > 0) { // 非默认选项
                const selectedOption = e.target.options[e.target.selectedIndex];
                const defaultPath = selectedOption.getAttribute('data-default-path') || '/home/uploads/';
                
                targetPath.value = defaultPath;  // 修复：从data-default-path获取路径
                editBtn.disabled = false;
                editBtn.style.backgroundColor = '#e3f2fd';
                editBtn.style.color = '#1976d2';
                
                // 显示服务器详细信息
                console.log('Selected option data:', selectedOption.dataset);
                
                try {
                    const serverDataStr = selectedOption.dataset.serverData;
                    if (serverDataStr) {
                        const serverData = JSON.parse(decodeURIComponent(atob(serverDataStr)));
                        console.log('Parsed server data:', serverData);
                        
                        if (serverData.protocol && serverData.username && serverData.port) {
                            serverDetails.innerHTML = `
                                <strong>协议:</strong> ${serverData.protocol.toUpperCase()} | 
                                <strong>用户:</strong> ${serverData.username} | 
                                <strong>端口:</strong> ${serverData.port}
                            `;
                            serverInfo.style.display = 'block';
                        } else {
                            console.warn('Incomplete server data:', serverData);
                            serverDetails.innerHTML = '<span style="color: #999;">服务器信息不完整</span>';
                            serverInfo.style.display = 'block';
                        }
                    } else {
                        console.warn('No server data found in option');
                        serverInfo.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error parsing server data:', error);
                    serverDetails.innerHTML = '<span style="color: #dc2626;">解析服务器信息失败</span>';
                    serverInfo.style.display = 'block';
                }
            } else {
                editBtn.disabled = true;
                editBtn.style.backgroundColor = '#f8f9fa';
                editBtn.style.color = '#6c757d';
                serverInfo.style.display = 'none';
            }
        });
        
        // 背景点击和ESC键关闭
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) closeDialog();
        });
        
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeDialog();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    async loadServers(dialog) {
        try {
            // 通过后端API获取服务器列表
            const servers = await apiClient.getServers();
            this.populateServerList(dialog, servers);
        } catch (error) {
            console.error('Failed to load servers:', error);
            this.populateServerList(dialog, []);
            this.showAlert('服务器列表加载失败: ' + error.message, 'error');
        }
    }

    populateServerList(dialog, servers) {
        const select = dialog.querySelector('.server-select');
        const pathInput = dialog.querySelector('.target-path');
        // 保证每个弹窗 datalist 唯一
        const datalistId = `path-history-list-${Date.now()}-${Math.floor(Math.random()*10000)}`;
        let datalist = document.createElement('datalist');
        datalist.id = datalistId;
        pathInput.setAttribute('list', datalistId);
        // 移除旧的 datalist
        const oldDatalist = pathInput.parentNode.querySelector('datalist');
        if (oldDatalist) oldDatalist.remove();
        pathInput.parentNode.appendChild(datalist);

        // 解绑旧的 change 事件（关键修复）
        if (select._easyTranslateChangeHandler) {
            select.removeEventListener('change', select._easyTranslateChangeHandler);
        }

        // 新的 change 事件
        const handleChange = (e) => {
            if (!document.body.contains(dialog)) return;
            const serverId = select.value;
            const server = servers.find(s => s.id === serverId);
            let paths = [];
            if (server && Array.isArray(server.paths) && server.paths.length > 0) {
                paths = server.paths.map(p => p.path);
            }
            pathInput.value = (paths[0]) ? paths[0] : '/home/uploads/';
            datalist.innerHTML = paths.map(p => `<option value=\"${p}\">`).join('');
        };
        select.addEventListener('change', handleChange);
        select._easyTranslateChangeHandler = handleChange;

        if (servers.length === 0) {
            select.innerHTML = '<option disabled selected>请先添加服务器</option>';
            return;
        }
        select.innerHTML = '<option value="" disabled>选择服务器</option>';
        servers.forEach((server, index) => {
            const option = document.createElement('option');
            option.value = server.id;
            option.setAttribute('data-server-index', index);
            option.textContent = `${server.name} (${server.host})`;
            select.appendChild(option);
        });
        // 自动选择第一个服务器（最近使用）
        select.selectedIndex = 1; // 0是“选择服务器”占位，1是第一个服务器
        // 触发一次change事件，自动填充路径
        select.dispatchEvent(new Event('change'));
    }

    async editSelectedServer(dialog) {
        const select = dialog.querySelector('.server-select');
        const selectedOption = select.options[select.selectedIndex];
        if (!selectedOption || !selectedOption.value) {
            this.showAlert('请先选择要编辑的服务器', 'warning');
            return;
        }
        try {
            const serverId = selectedOption.value;
            const serverData = await apiClient.getServer(serverId);
            if (serverData) {
                this.showAddServerDialog(dialog, apiClient.convertBackendToFrontend(serverData));
            } else {
                this.showAlert('未找到选中的服务器', 'error');
            }
        } catch (error) {
            console.error('Failed to load server for editing:', error);
            this.showAlert('加载服务器数据失败', 'error');
        }
    }

    async startTransfer(dialog, url) {
        const select = dialog.querySelector('.server-select');
        const pathInput = dialog.querySelector('.target-path');
        if (!select.value) {
            this.showAlert('请选择服务器', 'warning');
            return;
        }
        const serverId = select.value;
        const targetPath = pathInput.value || '/home/uploads/';
        const fileUrl = url;
        // 1. 触发浏览器下载
        const filename = this.extractFileName(fileUrl);
        const a = document.createElement('a');
        a.href = fileUrl;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => document.body.removeChild(a), 100);
        this.showAlert('文件已开始下载，请确保下载完成后再进行传输...', 'info');
        // 2. 拼接本地路径并通知后端
        // TODO: 后续支持用户自定义下载路径
        const DOWNLOAD_DIR = '~/Download';
        const localPath = `${DOWNLOAD_DIR}/${filename}`;
        // 3. 通过统一任务流通知后台自动下载和上传
        try {
            chrome.runtime.sendMessage({
                action: 'startDownload',
                url: fileUrl,
                fileName: filename,
                serverId: serverId,
                targetPath: targetPath
            });
            this.showAlert('已通知后台自动下载并上传', 'success');
            dialog.remove();
        } catch (error) {
            this.showAlert('通知后台上传失败: ' + error.message, 'error');
        }
    }

    // 辅助方法：从URL提取文件名
    extractFileName(url) {
        try {
            const urlObj = new URL(url);
            
            // 首先检查查询参数中的文件名
            const urlParams = urlObj.searchParams;
            
            // 常见的文件名参数
            const fileNameParams = ['filename', 'file', 'name', 'download', 'attachment'];
            for (const param of fileNameParams) {
                const fileName = urlParams.get(param);
                if (fileName && this.isValidFileName(fileName)) {
                    return fileName;
                }
            }
            
            // 从URL路径提取文件名
            const pathname = urlObj.pathname;
            const pathSegments = pathname.split('/').filter(Boolean);
            
            // 从路径段中查找看起来像文件名的部分
            for (let i = pathSegments.length - 1; i >= 0; i--) {
                const segment = pathSegments[i];
                if (this.isValidFileName(segment)) {
                    return segment;
                }
            }
            
            // 检查整个路径的最后一部分
            const lastSegment = pathSegments[pathSegments.length - 1];
            if (lastSegment) {
                // 如果最后一段包含文件扩展名的迹象，使用它
                if (lastSegment.includes('.') || lastSegment.length > 3) {
                    return lastSegment;
                }
            }
            
            // 特殊处理：GitHub releases等
            if (urlObj.hostname.includes('github.com') && pathname.includes('/releases/download/')) {
                const releaseSegments = pathname.split('/releases/download/');
                if (releaseSegments.length > 1) {
                    const downloadPath = releaseSegments[1];
                    const fileName = downloadPath.split('/').pop();
                    if (fileName && this.isValidFileName(fileName)) {
                        return fileName;
                    }
                }
            }
            
            // 从Content-Disposition头部获取文件名（这里只能模拟）
            // 实际场景中，这需要从HTTP响应头获取
            
            // 最后的备选方案：基于URL生成一个合理的文件名
            return this.generateFallbackFileName(urlObj);
            
        } catch (error) {
            console.warn('Error extracting filename from URL:', url, error);
            return 'download_file';
        }
    }

    // 检查是否是有效的文件名
    isValidFileName(fileName) {
        if (!fileName || fileName.length < 1) return false;
        
        // 包含文件扩展名
        if (fileName.includes('.') && fileName.split('.').length > 1) {
            const extension = fileName.split('.').pop().toLowerCase();
            // 检查是否是常见的文件扩展名
            const commonExtensions = [
                'zip', 'rar', '7z', 'tar', 'gz', 'exe', 'msi', 'deb', 'rpm', 'dmg', 'iso',
                'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'json', 'xml',
                'mp4', 'avi', 'mkv', 'mp3', 'wav', 'flac', 'jpg', 'png', 'gif', 'svg',
                'apk', 'ipa', 'pkg', 'bin', 'img', 'dll', 'so', 'dylib'
            ];
            return commonExtensions.includes(extension);
        }
        
        // 不包含扩展名但看起来像文件名（避免目录名）
        return fileName.length > 2 && !fileName.includes(' ') && /[a-zA-Z0-9]/.test(fileName);
    }

    // 生成备选文件名
    generateFallbackFileName(urlObj) {
        const hostname = urlObj.hostname.replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = Date.now();
        
        // 尝试从路径推断文件类型
        const pathname = urlObj.pathname.toLowerCase();
        let extension = '';
        
        if (pathname.includes('download') || pathname.includes('file')) {
            if (pathname.includes('.zip') || urlObj.search.includes('zip')) extension = '.zip';
            else if (pathname.includes('.pdf') || urlObj.search.includes('pdf')) extension = '.pdf';
            else if (pathname.includes('.exe') || urlObj.search.includes('exe')) extension = '.exe';
            else if (pathname.includes('.apk') || urlObj.search.includes('apk')) extension = '.apk';
            else extension = '.bin'; // 通用二进制文件扩展名
        }
        
        return `${hostname}_${timestamp}${extension}`;
    }

    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.textContent = message;
        Object.assign(alert.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 16px',
            borderRadius: '6px',
            color: 'white',
            backgroundColor: type === 'success' ? '#10b981' : 
                           type === 'error' ? '#ef4444' : 
                           type === 'warning' ? '#f59e0b' : '#3b82f6',
            zIndex: '1000000',
            fontSize: '14px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            maxWidth: '400px',
            wordWrap: 'break-word',
            lineHeight: '1.4'
        });
        
        document.body.appendChild(alert);
        
        // 根据消息类型设置不同的自动关闭时间
        const autoCloseTime = type === 'error' ? 8000 : type === 'warning' ? 6000 : 4000;
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, autoCloseTime);
    }

    showAddServerDialog(parentDialog, serverData = null) {
        // 使用共享的服务器对话框模块
        return this.serverDialog.showAddServerDialog(parentDialog, serverData, {
            onSaveSuccess: async (result, isEdit) => {
                // 如果有父对话框，重新加载服务器列表
            if (parentDialog) {
                await this.loadServers(parentDialog);
            }
                console.log(`[CONTENT] Server ${isEdit ? 'updated' : 'created'} successfully:`, result);
            },
            onDeleteSuccess: async (serverId) => {
                // 如果有父对话框，重新加载服务器列表
            if (parentDialog) {
                await this.loadServers(parentDialog);
            }
                console.log(`[CONTENT] Server deleted successfully:`, serverId);
        }
        });
    }

    async injectCSS() {
        // 如果CSS已经注入，则不重复注入
        if (this.injectedStyleElement) {
            return;
        }

        try {
            // 获取CSS内容 - 使用webpack生成的CSS文件
            const cssUrl = chrome.runtime.getURL('content-styles.css');
            const response = await fetch(cssUrl);
            const cssText = await response.text();
            
            // 创建style元素并注入CSS
            this.injectedStyleElement = document.createElement('style');
            this.injectedStyleElement.setAttribute('data-easy-translate', 'injected');
            this.injectedStyleElement.textContent = cssText;
            
            // 注入到页面头部
            (document.head || document.documentElement).appendChild(this.injectedStyleElement);
            
            console.log(`Easy Translate: CSS injected dynamically for page ${this.pageKey}`);
        } catch (error) {
            console.error(`Easy Translate: Failed to inject CSS for page ${this.pageKey}:`, error);
        }
    }

    removeCSS() {
        if (this.injectedStyleElement) {
            this.injectedStyleElement.remove();
            this.injectedStyleElement = null;
            console.log(`Easy Translate: CSS removed from page ${this.pageKey}`);
        }
    }

    // 更新插件图标的badge
    async updateBadge(isEnabled) {
        try {
            // 检查Chrome action API是否可用
            if (!chrome?.action || !chrome?.action.setBadgeText || !chrome?.action.setBadgeBackgroundColor) {
                console.warn(`Easy Translate: Chrome action API not available for page ${this.pageKey}`);
                return;
            }

            // 获取当前tab ID（如果可用）
            let tabId = undefined;
            try {
                if (chrome?.tabs) {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    tabId = tab?.id;
                }
            } catch (error) {
                console.log(`Easy Translate: Could not get tab ID for badge update: ${error.message}`);
            }

            if (isEnabled) {
                // 显示绿色的"ON"标签
                await chrome.action.setBadgeText({
                    text: "ON",
                    ...(tabId && { tabId })
                });
                await chrome.action.setBadgeBackgroundColor({
                    color: "#059669", // 绿色
                    ...(tabId && { tabId })
                });
            } else {
                // 显示灰色的"OFF"标签
                await chrome.action.setBadgeText({
                    text: "OFF",
                    ...(tabId && { tabId })
                });
                await chrome.action.setBadgeBackgroundColor({
                    color: "#6b7280", // 灰色
                    ...(tabId && { tabId })
                });
            }
            
            console.log(`Easy Translate: Badge updated for page ${this.pageKey}: ${isEnabled ? 'ON' : 'OFF'}`);
        } catch (error) {
            console.error(`Easy Translate: Failed to update badge for page ${this.pageKey}:`, error);
            // 不再抛出错误，只记录日志
        }
    }

    // 移除所有传输按钮的方法
    removeAllTransferButtons() {
        const existingButtons = document.querySelectorAll(`.${this.config.buttonClass}`);
        existingButtons.forEach(btn => btn.remove());
        console.log(`Easy Translate: Removed ${existingButtons.length} existing transfer buttons`);
    }

    // 重新评估所有按钮 - 智能地移除不匹配的，添加新匹配的
    reEvaluateAllButtons() {
        console.log(`Easy Translate: Starting intelligent re-evaluation of all buttons`);
        
        // 获取所有现有的传输按钮
        const existingButtons = document.querySelectorAll(`.${this.config.buttonClass}`);
        let removedCount = 0;
        let keptCount = 0;
        
        // 检查每个现有按钮是否仍然匹配新的模式
        existingButtons.forEach(button => {
            const url = button.getAttribute('data-url');
            if (url && !this.isDownloadLink(url)) {
                // 如果URL不再匹配任何模式，移除按钮
                button.remove();
                removedCount++;
                console.log(`Easy Translate: Removed button for URL that no longer matches: ${url}`);
            } else {
                keptCount++;
            }
        });
        
        // 重新检测页面上的链接，添加新匹配的按钮
        const addedCount = this.detectAndAddNewButtons();
        
        console.log(`Easy Translate: Re-evaluation complete. Removed: ${removedCount}, Kept: ${keptCount}, Added: ${addedCount}`);
    }

    // 仅添加新匹配的按钮（不重复添加已存在的）
    detectAndAddNewButtons() {
        if (!this.isActive) return 0; // 安全检查

        const links = document.querySelectorAll('a[href]');
        let addedCount = 0;
        
        for (const link of links) {
            if (!this.isActive) break; // 如果在处理过程中被停用，立即停止
            
            if (this.isDownloadLink(link.href) && !this.hasTransferButton(link)) {
                if (this.addTransferButton(link)) {
                    addedCount++;
                }
            }
        }
        
        return addedCount;
    }

    async showEditServerDialog(serverId) {
        try {
            // 使用共享的服务器对话框模块
            await this.serverDialog.showEditServerDialog(serverId, null, {
                onSaveSuccess: async (result, isEdit) => {
                    console.log(`[CONTENT] Server updated successfully:`, result);
                },
                onDeleteSuccess: async (serverId) => {
                    console.log(`[CONTENT] Server deleted successfully:`, serverId);
                }
            });
        } catch (error) {
            console.error('Failed to show edit server dialog:', error);
            this.showAlert('显示编辑服务器对话框失败: ' + error.message, 'error');
        }
    }

    showDetailedAlert(message, type = 'info', title = 'Easy Translate') {
        // 改为使用右上角消息提示
        const formattedMessage = title ? `${title}: ${message}` : message;
        this.showAlert(formattedMessage, type);
        
        // 同时在控制台输出详细日志
        const logLevel = type === 'error' ? 'error' : type === 'warning' ? 'warn' : 'info';
        console[logLevel](`Easy Translate - ${title}:`, message);
    }

    // 开始监控任务状态
    startTaskStatusMonitoring(taskId, fileName) {
        console.log(`[MONITOR] 开始监控任务状态: ${taskId} - ${fileName}`);
        console.log(`[MONITOR] 监控开始时间: ${new Date().toLocaleString()}`);
        
        // 保存任务信息
        this.monitoredTasks.set(taskId, {
            fileName: fileName,
            lastStatus: 'pending',
            startTime: Date.now(),
            statusHistory: ['pending']
        });
        
        // 设置定期检查任务状态
        const checkInterval = setInterval(async () => {
            try {
                console.log(`[MONITOR] ${taskId}: 检查任务状态...`);
                const response = await chrome.runtime.sendMessage({ action: 'getActiveTasks' });
                
                if (response.success) {
                    const task = response.tasks.find(t => t.id === taskId);
                    if (task) {
                        console.log(`[MONITOR] ${taskId}: 在活动任务中找到，状态: ${task.status}`);
                        this.handleTaskStatusChange(taskId, task);
                    } else {
                        console.log(`[MONITOR] ${taskId}: 未在活动任务中找到，检查历史记录...`);
                        // 任务可能已完成，检查历史记录
                        const historyResponse = await chrome.runtime.sendMessage({ action: 'getTaskHistory' });
                        if (historyResponse.success) {
                            const historyTask = historyResponse.history.find(t => t.id === taskId);
                            if (historyTask) {
                                console.log(`[MONITOR] ${taskId}: 在历史记录中找到，状态: ${historyTask.status}`);
                                this.handleTaskStatusChange(taskId, historyTask);
                                // 任务已完成，停止监控
                                console.log(`[MONITOR] ${taskId}: 任务已完成，停止监控`);
                                clearInterval(checkInterval);
                                this.monitoredTasks.delete(taskId);
                            } else {
                                console.warn(`[MONITOR] ${taskId}: 在历史记录中也未找到任务`);
                            }
                        } else {
                            console.error(`[MONITOR] ${taskId}: 获取历史记录失败:`, historyResponse.error);
                        }
                    }
                } else {
                    console.error(`[MONITOR] ${taskId}: 获取活动任务失败:`, response.error);
                }
            } catch (error) {
                console.error(`[MONITOR] ${taskId}: 检查任务状态失败:`, error);
            }
        }, 2000); // 每2秒检查一次
        
        // 10分钟后自动停止监控（防止内存泄漏）
        setTimeout(() => {
            console.log(`[MONITOR] ${taskId}: 监控超时，自动停止 (10分钟)`);
            clearInterval(checkInterval);
            this.monitoredTasks.delete(taskId);
        }, 600000);
    }

    // 处理任务状态变化
    handleTaskStatusChange(taskId, task) {
        const monitoredTask = this.monitoredTasks.get(taskId);
        if (!monitoredTask) {
            console.warn(`[STATUS] ${taskId}: 任务未在监控列表中`);
            return;
        }
        
        const { fileName, lastStatus, statusHistory } = monitoredTask;
        const newStatus = task.status;
        
        // 记录状态变化日志
        console.log(`[STATUS] ${taskId}: 当前状态检查 - 上次: ${lastStatus}, 当前: ${newStatus}`);
        
        // 只在状态真正变化时显示通知
        if (lastStatus === newStatus) {
            console.log(`[STATUS] ${taskId}: 状态未变化，跳过通知`);
            return;
        }
        
        // 记录状态变化历史
        statusHistory.push(newStatus);
        console.log(`[STATUS] ${taskId}: 状态变化历史:`, statusHistory);
        
        // 计算状态持续时间
        const now = Date.now();
        const elapsedTime = now - monitoredTask.startTime;
        const elapsedMinutes = Math.floor(elapsedTime / 60000);
        const elapsedSeconds = Math.floor((elapsedTime % 60000) / 1000);
        
        console.log(`[STATUS] ${taskId}: 状态变化 ${lastStatus} -> ${newStatus}`);
        console.log(`[STATUS] ${taskId}: 任务运行时间: ${elapsedMinutes}分${elapsedSeconds}秒`);
        
        // 记录任务详细信息
        if (task.totalBytes) {
            console.log(`[STATUS] ${taskId}: 文件大小: ${(task.totalBytes / 1024 / 1024).toFixed(2)} MB`);
        }
        if (task.transferredBytes !== undefined) {
            const progress = task.totalBytes ? ((task.transferredBytes / task.totalBytes) * 100).toFixed(1) : '未知';
            console.log(`[STATUS] ${taskId}: 传输进度: ${progress}% (${(task.transferredBytes / 1024 / 1024).toFixed(2)} MB)`);
        }
        if (task.serverId) {
            console.log(`[STATUS] ${taskId}: 目标服务器: ${task.serverId}`);
        }
        if (task.targetPath) {
            console.log(`[STATUS] ${taskId}: 目标路径: ${task.targetPath}`);
        }
        
        // 更新最后状态
        monitoredTask.lastStatus = newStatus;
        
        // 根据状态变化显示相应提示
        switch (newStatus) {
            case 'downloading':
                if (lastStatus === 'pending') {
                    console.log(`[NOTIFY] ${taskId}: 显示下载开始通知`);
                    this.showAlert(`开始下载: ${fileName}`, 'info');
                }
                break;
                
            case 'download_complete':
                console.log(`[NOTIFY] ${taskId}: 下载完成，检查是否需要上传`);
                if (task.serverId) {
                    console.log(`[NOTIFY] ${taskId}: 有服务器配置，显示上传准备通知`);
                    this.showAlert(
                        `下载完成: ${fileName} - 正在准备上传到服务器...`, 
                        'success'
                    );
                } else {
                    console.log(`[NOTIFY] ${taskId}: 无服务器配置，任务完成`);
                    this.showAlert(
                        `下载完成: ${fileName} - 未配置服务器，任务已完成`, 
                        'success'
                    );
                }
                break;
                
            case 'transferring':
                console.log(`[NOTIFY] ${taskId}: 显示上传开始通知`);
                this.showAlert(
                    `开始上传: ${fileName} - 正在上传到服务器，请耐心等待...`, 
                    'info'
                );
                break;
                
            case 'complete':
                console.log(`[NOTIFY] ${taskId}: 显示任务完成通知`);
                this.showAlert(
                    `上传完成: ${fileName} - 文件已成功上传到服务器！`, 
                    'success'
                );
                break;
                
            case 'failed':
                const isUploadFailed = task.downloadCompleteTime;
                const failureType = isUploadFailed ? '上传' : '下载';
                const errorMsg = task.error || '未知错误';
                
                console.error(`[NOTIFY] ${taskId}: ${failureType}失败:`, errorMsg);
                console.error(`[NOTIFY] ${taskId}: 任务详情:`, task);
                
                this.showAlert(
                    `${failureType}失败: ${fileName} - ${errorMsg}`, 
                    'error'
                );
                break;
                
            case 'cancelled':
                console.log(`[NOTIFY] ${taskId}: 显示任务取消通知`);
                this.showAlert(
                    `任务取消: ${fileName}`, 
                    'warning'
                );
                break;
                
            default:
                console.log(`[NOTIFY] ${taskId}: 未知状态: ${newStatus}`);
                break;
        }
    }
}

// 初始化
new EasyTranslateContent();