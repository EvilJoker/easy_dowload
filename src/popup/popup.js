// popup.js - Easy Translate插件的popup页面脚本 - 页面级控制版本

class PopupController {
    constructor() {
        this.toggle = null;
        this.statusIndicator = null;
        this.statusText = null;
        this.currentTab = null;
        this.init();
    }

    async init() {
        console.log('Easy Translate popup loaded - page-level control');
        
        // 获取当前标签页信息
        await this.getCurrentTab();
        
        // 获取DOM元素
        this.toggle = document.getElementById('domModificationToggle');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        
        if (!this.toggle || !this.statusIndicator || !this.statusText) {
            console.error('Failed to find required DOM elements');
            return;
        }

        // 显示当前页面信息
        this.displayPageInfo();

        // 加载当前页面的设置
        await this.loadPageSettings();
        
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
            // 创建页面信息显示区域
            const pageInfoContainer = document.querySelector('.page-info');
            if (pageInfoContainer) {
                const domain = new URL(this.currentTab.url).hostname;
                pageInfoContainer.innerHTML = `
                    <div style="font-size: 12px; color: #666; margin-bottom: 8px;">
                        <strong>当前页面:</strong> ${domain}
                    </div>
                `;
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
            // 使用页面URL作为key来存储页面级设置
            const pageKey = this.getPageKey(this.currentTab.url);
            const result = await chrome.storage.local.get([`pageSettings_${pageKey}`]);
            const pageSettings = result[`pageSettings_${pageKey}`];
            
            const isEnabled = pageSettings?.domModificationEnabled || false;
            
            this.toggle.checked = isEnabled;
            this.updateStatus(isEnabled);
            
            // 更新插件图标的badge显示
            await this.updateBadge(isEnabled);
            
            console.log(`Page settings loaded for ${pageKey}:`, { domModificationEnabled: isEnabled });
        } catch (error) {
            console.error('Failed to load page settings:', error);
            // 默认状态
            this.toggle.checked = false;
            this.updateStatus(false);
            await this.updateBadge(false);
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
            
            // 更新插件图标的badge显示
            await this.updateBadge(isEnabled);
            
            console.log(`Page settings saved for ${pageKey}:`, pageSettings);
        } catch (error) {
            console.error('Failed to save page settings:', error);
        }
    }

    updateStatus(isEnabled) {
        if (isEnabled) {
            this.statusIndicator.classList.add('active');
            this.statusText.textContent = '此页面功能已启用';
        } else {
            this.statusIndicator.classList.remove('active');
            this.statusText.textContent = '此页面功能已禁用';
        }
    }

    async notifyContentScript(isEnabled) {
        if (!this.currentTab) return;

        try {
            // 发送消息给当前标签页的content script
            chrome.tabs.sendMessage(this.currentTab.id, {
                type: 'DOM_MODIFICATION_TOGGLE',
                enabled: isEnabled,
                pageLevel: true // 标识这是页面级控制
            }).catch(error => {
                // 忽略连接错误，可能是页面还没有content script
                console.log('Content script not ready:', error.message);
            });
        } catch (error) {
            console.error('Failed to notify content script:', error);
        }
    }

    // 生成页面唯一key（基于域名）
    getPageKey(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            return 'unknown_page';
        }
    }

    // 更新插件图标的badge
    async updateBadge(isEnabled) {
        try {
            if (isEnabled) {
                // 显示绿色的"ON"标签
                await chrome.action.setBadgeText({
                    text: "ON",
                    tabId: this.currentTab.id
                });
                await chrome.action.setBadgeBackgroundColor({
                    color: "#059669", // 绿色
                    tabId: this.currentTab.id
                });
            } else {
                // 显示灰色的"OFF"标签
                await chrome.action.setBadgeText({
                    text: "OFF",
                    tabId: this.currentTab.id
                });
                await chrome.action.setBadgeBackgroundColor({
                    color: "#6b7280", // 灰色
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