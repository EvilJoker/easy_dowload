// server-dialog.js - 共享的服务器对话框模块
import ApiClient from './api-client.js';

class ServerDialog {
    constructor() {
        this.apiClient = new ApiClient();
        this.apiClient.setBaseUrl('http://localhost:5000');
    }

    // 显示添加/编辑服务器对话框
    showAddServerDialog(parentDialog = null, serverData = null, options = {}) {
        // 避免重复弹窗
        const existing = document.querySelector('.easy-translate-add-server-dialog');
        if (existing) existing.remove();

        const addServerDialog = document.createElement('div');
        addServerDialog.className = 'easy-translate-add-server-dialog';
        
        Object.assign(addServerDialog.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '1000000',
            padding: '20px'
        });

        const isEdit = !!serverData;
        const title = isEdit ? '编辑服务器' : '添加服务器';

        addServerDialog.innerHTML = `
            <div style="background: white; border-radius: 8px; padding: 24px; max-width: 450px; width: 90%; box-shadow: 0 4px 25px rgba(0,0,0,0.2);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; font-size: 18px; color: #333;">${title}</h3>
                    <button class="close-btn" style="background: none; border: none; cursor: pointer; font-size: 20px; color: #666;">×</button>
                </div>
                
                <form class="server-form">
                    <input type="hidden" name="serverId" value="${serverData?.id || ''}">
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-size: 14px; color: #555;">服务器名称 *</label>
                        <input type="text" name="name" value="${serverData?.name || ''}" placeholder="例: 我的服务器" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-size: 14px; color: #555;">主机地址 *</label>
                        <input type="text" name="host" value="${serverData?.host || ''}" placeholder="例: 192.168.1.100 或 localhost" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                    
                    <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 6px; font-size: 14px; color: #555;">端口</label>
                            <input type="number" name="port" value="${serverData?.port || 22}" placeholder="22" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                        </div>
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 6px; font-size: 14px; color: #555;">协议</label>
                            <select name="protocol" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                                <option value="SFTP" ${(serverData?.protocol?.toUpperCase() || 'SFTP') === 'SFTP' ? 'selected' : ''}>SFTP</option>
                                <option value="FTP" ${(serverData?.protocol?.toUpperCase() || '') === 'FTP' ? 'selected' : ''}>FTP</option>
                                <option value="SCP" ${(serverData?.protocol?.toUpperCase() || '') === 'SCP' ? 'selected' : ''}>SCP</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-size: 14px; color: #555;">用户名 *</label>
                        <input type="text" name="username" value="${serverData?.username || ''}" placeholder="例: admin 或 root" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-size: 14px; color: #555;">密码 *</label>
                        <input type="password" name="password" value="${serverData?.password || ''}" placeholder="服务器登录密码" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <label style="display: block; margin-bottom: 6px; font-size: 14px; color: #555;">默认路径</label>
                        <input type="text" name="defaultPath" value="${serverData?.defaultPath || '/home/uploads/'}" placeholder="/home/uploads/" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
                    </div>
                    
                    <div style="display: flex; gap: 8px; justify-content: space-between;">
                        <div>
                            ${isEdit ? '<button type="button" class="delete-btn" style="padding: 10px 16px; border: 1px solid #dc2626; border-radius: 4px; background: white; color: #dc2626; cursor: pointer;">删除</button>' : ''}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button type="button" class="cancel-btn" style="padding: 10px 16px; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer;">取消</button>
                            <button type="button" class="test-btn" style="padding: 10px 16px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; cursor: pointer;">测试连接</button>
                            <button type="submit" class="save-btn" style="padding: 10px 16px; border: none; border-radius: 4px; background: #fbbf24; color: black; cursor: pointer;">${isEdit ? '更新' : '保存'}</button>
                        </div>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(addServerDialog);
        this.bindAddServerEvents(addServerDialog, parentDialog, isEdit, options);
        
        return addServerDialog;
    }

    bindAddServerEvents(addServerDialog, parentDialog, isEdit, options = {}) {
        const form = addServerDialog.querySelector('.server-form');
        
        // 关闭按钮
        addServerDialog.querySelector('.close-btn').addEventListener('click', () => {
            addServerDialog.remove();
        });
        
        // 取消按钮
        addServerDialog.querySelector('.cancel-btn').addEventListener('click', () => {
            addServerDialog.remove();
        });
        
        // 删除按钮
        if (isEdit) {
            addServerDialog.querySelector('.delete-btn').addEventListener('click', () => {
                this.deleteServer(addServerDialog, parentDialog, options);
            });
        }
        
        // 测试连接按钮
        addServerDialog.querySelector('.test-btn').addEventListener('click', async () => {
            const testBtn = addServerDialog.querySelector('.test-btn');
            const originalText = testBtn.textContent;
            testBtn.textContent = '测试中...';
            testBtn.disabled = true;
            
            try {
                const formData = new FormData(form);
                const serverConfig = {
                    name: formData.get('name'),
                    host: formData.get('host'),
                    port: parseInt(formData.get('port')) || 22,
                    protocol: (formData.get('protocol') || 'SFTP').toUpperCase(),
                    username: formData.get('username'),
                    password: formData.get('password'),
                    defaultPath: formData.get('defaultPath') || '/home/uploads/'
                };
                
                const response = await chrome.runtime.sendMessage({
                    action: 'testConnection',
                    data: serverConfig
                });
                
                if (response.success) {
                    let message = response.message;
                    if (response.details) {
                        const details = response.details;
                        message += `\n协议: ${details.protocol}`;
                        message += `\n主机: ${details.host}:${details.port}`;
                        if (details.username) {
                            message += `\n用户: ${details.username}`;
                        }
                        if (details.responseTime) {
                            message += `\n响应时间: ${details.responseTime}`;
                        }
                        if (details.connectionTime) {
                            message += `\n连接时间: ${details.connectionTime}`;
                        }
                    }
                    this.showAlert(message, 'success', '连接测试成功');
                } else {
                    this.showAlert(response.error || '连接失败', 'error', '连接测试失败');
                }
            } catch (error) {
                this.showAlert(error.message || '测试过程中发生错误', 'error', '测试失败');
            } finally {
                testBtn.textContent = originalText;
                testBtn.disabled = false;
            }
        });
        
        // 保存按钮
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveServer(addServerDialog, parentDialog, isEdit, options);
        });
        
        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                addServerDialog.remove();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    async saveServer(addServerDialog, parentDialog, isEdit, options = {}) {
        const form = addServerDialog.querySelector('.server-form');
        const formData = new FormData(form);
        
        const serverData = {
            id: formData.get('serverId') || undefined,
            name: formData.get('name'),
            host: formData.get('host'),
            port: parseInt(formData.get('port')) || 22,
            protocol: (formData.get('protocol') || 'SFTP').toUpperCase(),
            username: formData.get('username'),
            password: formData.get('password'),
            defaultPath: formData.get('defaultPath') || '/home/uploads/'
        };
        
        try {
            let result;
            if (isEdit && serverData.id) {
                // 编辑服务器，调用 updateServer
                result = await this.apiClient.updateServer(serverData.id, this.apiClient.convertFrontendToBackend(serverData));
            } else {
                // 新增服务器，调用 createServer
                result = await this.apiClient.createServer(this.apiClient.convertFrontendToBackend(serverData));
            }
            
            addServerDialog.remove();
            
            // 调用回调函数
            if (options.onSaveSuccess) {
                options.onSaveSuccess(result, isEdit);
            }
            
            this.showAlert(isEdit ? '服务器更新成功' : '服务器添加成功', 'success');
        } catch (error) {
            console.error('Failed to save server:', error);
            this.showAlert('保存失败: ' + error.message, 'error');
        }
    }

    async deleteServer(addServerDialog, parentDialog, options = {}) {
        const form = addServerDialog.querySelector('.server-form');
        const serverId = form.querySelector('input[name="serverId"]').value;
        const serverName = form.querySelector('input[name="name"]').value;
        
        if (!confirm(`确定要删除服务器 "${serverName}" 吗？`)) {
            return;
        }
        
        try {
            await this.apiClient.deleteServer(serverId);
            addServerDialog.remove();
            
            // 调用回调函数
            if (options.onDeleteSuccess) {
                options.onDeleteSuccess(serverId);
            }
            
            this.showAlert('服务器删除成功', 'success');
        } catch (error) {
            console.error('Failed to delete server:', error);
            this.showAlert('删除失败: ' + error.message, 'error');
        }
    }

    // 显示编辑服务器对话框
    async showEditServerDialog(serverId, parentDialog = null, options = {}) {
        try {
            const serverData = await this.apiClient.getServer(serverId);
            if (!serverData) {
                this.showAlert('未找到指定的服务器', 'error');
                return;
            }
            this.showAddServerDialog(parentDialog, this.apiClient.convertBackendToFrontend(serverData), options);
        } catch (error) {
            console.error('Failed to load server for editing:', error);
            this.showAlert('加载服务器数据失败: ' + error.message, 'error');
        }
    }

    // 显示提示消息
    showAlert(message, type = 'info', title = 'Easy Translate') {
        const formattedMessage = title ? `${title}: ${message}` : message;
        
        const alert = document.createElement('div');
        alert.textContent = formattedMessage;
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
}

export default ServerDialog; 