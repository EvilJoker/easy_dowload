// Easy Translate Background Script
console.log('Easy Translate background script loaded');

// 插件安装时的初始化
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Easy Translate installed:', details.reason);
    
    // 初始化存储
    chrome.storage.local.set({
        servers: [],
        transferHistory: [],
        settings: {
            autoDetect: true,
            showNotifications: true,
            theme: 'light'
        }
    });

    // 创建右键菜单
    chrome.contextMenus.create({
        id: 'easyTranslate',
        title: '传输到服务器',
        contexts: ['link']
    });
});

// 监听来自其他脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background received message:', request);
    
    switch (request.action) {
        case 'getServers':
            handleGetServers(sendResponse);
            break;
        case 'startTransfer':
            handleStartTransfer(request.data, sendResponse);
            break;
        case 'testConnection':
            handleTestConnection(request.data, sendResponse);
            break;
        default:
            console.log('Unknown action:', request.action);
            sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // 保持消息通道开放
});

// 获取服务器列表
async function handleGetServers(sendResponse) {
    try {
        const result = await chrome.storage.local.get(['servers']);
        sendResponse({ 
            success: true, 
            servers: result.servers || [] 
        });
    } catch (error) {
        console.error('Failed to get servers:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

// 开始传输（模拟）
async function handleStartTransfer(data, sendResponse) {
    console.log('Starting transfer:', data);
    
    try {
        // 模拟传输过程
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 记录传输历史
        const transferRecord = {
            id: `transfer_${Date.now()}`,
            fileName: extractFileName(data.url),
            sourceUrl: data.url,
            serverId: data.serverId,
            targetPath: data.targetPath,
            timestamp: new Date().toISOString(),
            status: 'completed',
            fileSize: Math.floor(Math.random() * 10000000) // 模拟文件大小
        };
        
        const result = await chrome.storage.local.get(['transferHistory']);
        const history = result.transferHistory || [];
        history.unshift(transferRecord); // 添加到开头
        
        // 只保留最近100条记录
        if (history.length > 100) {
            history.splice(100);
        }
        
        await chrome.storage.local.set({ transferHistory: history });
        
        sendResponse({ 
            success: true, 
            message: '传输完成！',
            transferId: transferRecord.id
        });
        
    } catch (error) {
        console.error('Transfer failed:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

// 测试连接
async function handleTestConnection(data, sendResponse) {
    console.log('Testing connection:', data);
    
    try {
        // 模拟连接测试
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 随机成功或失败（用于演示）
        const success = Math.random() > 0.3;
        
        if (success) {
            sendResponse({ 
                success: true, 
                message: '连接测试成功！' 
            });
        } else {
            throw new Error('连接超时或认证失败');
        }
        
    } catch (error) {
        console.error('Connection test failed:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'easyTranslate') {
        console.log('Context menu clicked for:', info.linkUrl);
        
        // 向 content script 发送消息
        chrome.tabs.sendMessage(tab.id, {
            action: 'showTransferDialog',
            url: info.linkUrl
        });
    }
});

// 工具函数：从URL提取文件名
function extractFileName(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const fileName = pathname.split('/').pop();
        return fileName && fileName.includes('.') ? fileName : 'unknown_file';
    } catch {
        return 'unknown_file';
    }
} 