// popup.js - Easy Translate插件的popup页面脚本 - 简化版本

class PopupController {
    constructor() {
        this.toggle = null;
        this.statusIndicator = null;
        this.currentTab = null;
        this.currentPatterns = [];
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
        console.log('Easy Translate popup loaded - simplified version');
        
        // 获取当前标签页信息
        await this.getCurrentTab();
        
        // 获取DOM元素
        this.toggle = document.getElementById('domModificationToggle');
        this.statusIndicator = document.getElementById('statusIndicator');
        
        if (!this.toggle || !this.statusIndicator) {
            console.error('Failed to find required DOM elements');
            return;
        }

        // 显示当前页面信息
        this.displayPageInfo();

        // 加载当前页面的设置
        await this.loadPageSettings();
        
        // 加载并显示当前后缀列表
        await this.loadAndDisplaySuffixes();
        
        // 绑定事件
        this.bindEvents();
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

        // 模态框事件
        this.bindModalEvents();
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
        const listContainer = document.getElementById('suffixList');
        listContainer.innerHTML = '';

        this.currentPatterns.forEach((pattern, index) => {
            const item = document.createElement('div');
            item.className = 'suffix-item';
            item.innerHTML = `
                <span>${pattern}</span>
                <button class="remove-suffix-btn" data-index="${index}">删除</button>
            `;
            listContainer.appendChild(item);
        });

        // 绑定删除事件
        listContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-suffix-btn')) {
                const index = parseInt(e.target.dataset.index);
                this.currentPatterns.splice(index, 1);
                this.updateModalList();
            }
        });
    }

    async savePatterns() {
        try {
            await chrome.storage.local.set({
                customDownloadPatterns: this.currentPatterns
            });

            // 通知content script更新模式
            if (this.currentTab) {
                try {
                    const response = await chrome.tabs.sendMessage(this.currentTab.id, {
                        action: 'updateCustomPatterns'
                    });
                    console.log('Patterns update response:', response);
                } catch (error) {
                    console.log('Content script not ready, patterns saved locally:', error.message);
                }
            }

            console.log('Patterns saved successfully:', this.currentPatterns);
            
            // 立即更新显示
            this.displaySuffixes();
            
            // 显示保存成功提示
            this.showSaveSuccess();
            
        } catch (error) {
            console.error('Failed to save patterns:', error);
            this.showSaveError();
        }
    }

    // 显示保存成功提示
    showSaveSuccess() {
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '已保存';
        saveBtn.style.background = '#10b981';
        
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.background = '#3b82f6';
        }, 1500);
    }

    // 显示保存错误提示
    showSaveError() {
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.textContent;
        saveBtn.textContent = '保存失败';
        saveBtn.style.background = '#ef4444';
        
        setTimeout(() => {
            saveBtn.textContent = originalText;
            saveBtn.style.background = '#3b82f6';
        }, 1500);
    }

    async savePageSettings(isEnabled) {
        if (!this.currentTab) return;

        try {
            const pageKey = this.getPageKey(this.currentTab.url);
            const settingsKey = `pageSettings_${pageKey}`;
            
            const pageSettings = {
                domModificationEnabled: isEnabled,
                url: this.currentTab.url,
                domain: new URL(this.currentTab.url).hostname,
                lastUpdated: new Date().toISOString()
            };
            
            await chrome.storage.local.set({ 
                [settingsKey]: pageSettings 
            });
            
            await this.updateBadge(isEnabled);
            
            console.log(`Page settings saved for ${pageKey}:`, pageSettings);
        } catch (error) {
            console.error('Failed to save page settings:', error);
        }
    }

    updateStatus(isEnabled) {
        if (isEnabled) {
            this.statusIndicator.classList.add('active');
        } else {
            this.statusIndicator.classList.remove('active');
        }
    }

    async notifyContentScript(isEnabled) {
        if (!this.currentTab) return;

        try {
            chrome.tabs.sendMessage(this.currentTab.id, {
                action: 'toggleDomModification',
                enabled: isEnabled
            }).catch(error => {
                console.log('Content script not ready:', error.message);
            });
        } catch (error) {
            console.error('Failed to notify content script:', error);
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
        try {
            if (isEnabled) {
                await chrome.action.setBadgeText({
                    text: "ON",
                    tabId: this.currentTab.id
                });
                await chrome.action.setBadgeBackgroundColor({
                    color: "#10b981",
                    tabId: this.currentTab.id
                });
            } else {
                await chrome.action.setBadgeText({
                    text: "OFF",
                    tabId: this.currentTab.id
                });
                await chrome.action.setBadgeBackgroundColor({
                    color: "#6b7280",
                    tabId: this.currentTab.id
                });
            }
        } catch (error) {
            console.error('Failed to update badge:', error);
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    new PopupController();
});

// 示例：点击页面时的简单交互
document.addEventListener('click', function() {
    console.log('Popup clicked');
}); 