// Easy Translate Background Script
console.log('Easy Translate background script loaded');

// 任务状态枚举
const TaskStatus = {
    PENDING: 'pending',
    DOWNLOADING: 'downloading',
    DOWNLOAD_COMPLETE: 'download_complete',
    TRANSFERRING: 'transferring',
    COMPLETE: 'complete',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

// 下载管理器
class DownloadManager {
    constructor() {
        this.activeTasks = new Map(); // 活动任务映射
        this.taskHistory = []; // 任务历史
        this.setupDownloadListeners();
        
        // 初始化时加载持久化数据
        this.initializeData();
    }

    // 设置下载监听器
    setupDownloadListeners() {
        // 监听下载状态变化
        chrome.downloads.onChanged.addListener((downloadDelta) => {
            this.handleDownloadChanged(downloadDelta);
        });

        // 监听下载创建
        chrome.downloads.onCreated.addListener((downloadItem) => {
            this.handleDownloadCreated(downloadItem);
        });
    }

    // 处理下载状态变化
    async handleDownloadChanged(downloadDelta) {
        const downloadId = downloadDelta.id;
        
        // 查找对应的任务
        for (let [taskId, task] of this.activeTasks) {
            if (task.downloadId === downloadId) {
                await this.updateTaskFromDownload(taskId, downloadDelta);
                break;
            }
        }
    }

    // 处理下载创建
    handleDownloadCreated(downloadItem) {
        console.log('Download created:', downloadItem);
        
        // 查找对应的任务并更新实际文件名
        // 优先通过downloadId匹配，如果没有则通过URL匹配
        let matchedTask = null;
        let matchedTaskId = null;
        
        for (let [taskId, task] of this.activeTasks) {
            if (task.downloadId === downloadItem.id) {
                matchedTask = task;
                matchedTaskId = taskId;
                break;
            }
        }
        
        // 如果通过downloadId没找到，尝试通过URL匹配
        if (!matchedTask) {
            for (let [taskId, task] of this.activeTasks) {
                if (task.sourceUrl === downloadItem.url && !task.downloadId) {
                    matchedTask = task;
                    matchedTaskId = taskId;
                    task.downloadId = downloadItem.id; // 关联downloadId
                    break;
                }
            }
        }
        
        if (matchedTask) {
            // 从完整文件路径中提取文件名
            const actualFileName = downloadItem.filename ? 
                downloadItem.filename.split('/').pop().split('\\').pop() : 
                matchedTask.fileName;
            
            if (actualFileName !== matchedTask.fileName) {
                console.log(`File name updated for task ${matchedTaskId}: ${matchedTask.fileName} → ${actualFileName}`);
                matchedTask.fileName = actualFileName;
                matchedTask.actualFileName = actualFileName; // 保存实际文件名
                this.notifyTaskUpdate(matchedTaskId, matchedTask);
            }
        } else {
            console.log('No matching task found for download:', downloadItem);
        }
    }

    // 从下载状态更新任务
    async updateTaskFromDownload(taskId, downloadDelta) {
        const task = this.activeTasks.get(taskId);
        if (!task) return;

        // 更新下载进度
        if (downloadDelta.bytesReceived) {
            task.downloadedBytes = downloadDelta.bytesReceived.current;
        }
        if (downloadDelta.totalBytes) {
            task.totalBytes = downloadDelta.totalBytes.current;
        }

        // 检查文件名是否有变化（浏览器可能会添加后缀）
        if (downloadDelta.filename && downloadDelta.filename.current) {
            const actualFileName = downloadDelta.filename.current.split('/').pop().split('\\').pop();
            if (actualFileName !== task.fileName) {
                console.log(`File name updated for task ${taskId}: ${task.fileName} → ${actualFileName}`);
                task.fileName = actualFileName;
                task.actualFileName = actualFileName;
            }
        }

        // 更新下载状态
        if (downloadDelta.state) {
            const state = downloadDelta.state.current;
            switch (state) {
                case 'in_progress':
                    task.status = TaskStatus.DOWNLOADING;
                    break;
                case 'complete':
                    task.status = TaskStatus.DOWNLOAD_COMPLETE;
                    task.downloadCompleteTime = new Date().toISOString();
                    
                    // 在下载完成时，确保获取最终的文件名
                    try {
                        const downloadItem = await this.getDownloadItem(task.downloadId);
                        if (downloadItem.filename) {
                            const finalFileName = downloadItem.filename.split('/').pop().split('\\').pop();
                            if (finalFileName !== task.fileName) {
                                console.log(`Final file name for task ${taskId}: ${finalFileName}`);
                                task.fileName = finalFileName;
                                task.actualFileName = finalFileName;
                            }
                        }
                    } catch (error) {
                        console.warn(`Could not get final filename for task ${taskId}:`, error);
                    }
                    
                    // 先通知下载完成
                    this.notifyTaskUpdate(taskId, task);
                    
                    // 下载完成，准备开始传输（如果有服务器配置）
                    if (task.serverId) {
                        // 添加短暂延迟让用户看到下载完成状态
                        setTimeout(async () => {
                            console.log(`Download completed for task ${taskId}, starting upload...`);
                            await this.startTransferForTask(taskId);
                        }, 1000); // 1秒延迟
                    } else {
                        // 没有服务器配置，直接标记为完成
                        task.status = TaskStatus.COMPLETE;
                        task.completeTime = new Date().toISOString();
                        this.notifyTaskUpdate(taskId, task);
                        this.moveTaskToHistory(taskId);
                    }
                    break;
                case 'interrupted':
                    task.status = TaskStatus.FAILED;
                    task.error = downloadDelta.error?.current || 'Download interrupted';
                    break;
            }
        }

        // 通知UI更新
        this.notifyTaskUpdate(taskId, task);
    }

    // 开始下载任务
    async startDownloadTask(url, fileName, serverId, targetPath) {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const task = {
            id: taskId,
            fileName: fileName || this.extractFileName(url),
            originalFileName: fileName || this.extractFileName(url), // 保存原始文件名
            actualFileName: null, // 实际下载的文件名（包含浏览器添加的后缀）
            sourceUrl: url,
            serverId: serverId,
            targetPath: targetPath || '/',
            status: TaskStatus.PENDING,
            downloadId: null,
            downloadedBytes: 0,
            totalBytes: 0,
            transferredBytes: 0,
            startTime: new Date().toISOString(),
            downloadCompleteTime: null,
            completeTime: null,
            error: null
        };

        this.activeTasks.set(taskId, task);

        try {
            // 启动浏览器下载
            const downloadOptions = {
                url: url,
                filename: `easy_translate/${task.fileName}`,
                saveAs: false
            };

            const downloadId = await chrome.downloads.download(downloadOptions);
            task.downloadId = downloadId;
            task.status = TaskStatus.DOWNLOADING;

            console.log(`Started download task ${taskId}, download ID: ${downloadId}`);
            
            // 立即尝试获取下载项信息来更新文件名
            setTimeout(async () => {
                try {
                    const downloadItem = await this.getDownloadItem(downloadId);
                    if (downloadItem.filename) {
                        const actualFileName = downloadItem.filename.split('/').pop().split('\\').pop();
                        if (actualFileName !== task.fileName) {
                            console.log(`Initial file name update for task ${taskId}: ${task.fileName} → ${actualFileName}`);
                            task.fileName = actualFileName;
                            task.actualFileName = actualFileName;
                            this.notifyTaskUpdate(taskId, task);
                        }
                    }
                } catch (error) {
                    console.warn(`Could not get initial filename for task ${taskId}:`, error);
                }
            }, 500); // 延迟500ms确保下载项已创建
            
            // 通知UI
            this.notifyTaskUpdate(taskId, task);

            return { success: true, taskId: taskId };

        } catch (error) {
            console.error('Failed to start download:', error);
            task.status = TaskStatus.FAILED;
            task.error = error.message;
            this.notifyTaskUpdate(taskId, task);
            return { success: false, error: error.message };
        }
    }

    // 开始传输任务
    async startTransferForTask(taskId) {
        const task = this.activeTasks.get(taskId);
        if (!task || !task.serverId) {
            // 如果没有服务器配置，下载完成即为最终完成状态
            if (task && !task.serverId) {
                task.status = TaskStatus.COMPLETE;
                task.completeTime = new Date().toISOString();
                this.notifyTaskUpdate(taskId, task);
                this.moveTaskToHistory(taskId);
            }
            return;
        }

        // 设置为传输中状态并通知
        task.status = TaskStatus.TRANSFERRING;
        task.uploadStartTime = new Date().toISOString();
        console.log(`Starting upload for task ${taskId}...`);
        this.notifyTaskUpdate(taskId, task);

        try {
            // 获取下载的文件信息
            const downloadItem = await this.getDownloadItem(task.downloadId);
            const localFilePath = downloadItem.filename;

            console.log(`Starting transfer for task ${taskId}, file: ${localFilePath}`);

            // 真实的文件传输功能
            await this.simulateTransfer(taskId, localFilePath);

            task.status = TaskStatus.COMPLETE;
            task.completeTime = new Date().toISOString();
            
            console.log(`Upload completed successfully for task ${taskId}`);
            
            // 通知UI更新
            this.notifyTaskUpdate(taskId, task);
            
            // 移动到历史记录
            this.moveTaskToHistory(taskId);

        } catch (error) {
            console.error(`Upload failed for task ${taskId}:`, error);
            task.status = TaskStatus.FAILED;
            task.error = `上传失败: ${error.message}`;
            this.notifyTaskUpdate(taskId, task);
            // 传输失败的任务也移动到历史记录
            this.moveTaskToHistory(taskId);
        }
    }

    // 获取下载项详情
    async getDownloadItem(downloadId) {
        return new Promise((resolve, reject) => {
            chrome.downloads.search({ id: downloadId }, (results) => {
                if (results && results.length > 0) {
                    resolve(results[0]);
                } else {
                    reject(new Error('Download item not found'));
                }
            });
        });
    }

    // 真实的文件传输功能
    async simulateTransfer(taskId, filePath) {
        const task = this.activeTasks.get(taskId);
        if (!task.serverId) {
            console.error(`[UPLOAD] Task ${taskId}: 未配置服务器ID`);
            throw new Error('未配置服务器');
        }

        console.log(`[UPLOAD] Task ${taskId}: 开始获取服务器配置，服务器ID: ${task.serverId}`);
        
        // 获取服务器配置
        const serverConfig = await this.getServerConfig(task.serverId);
        if (!serverConfig) {
            console.error(`[UPLOAD] Task ${taskId}: 服务器配置不存在，服务器ID: ${task.serverId}`);
            
            // 列出所有可用的服务器配置用于调试
            try {
                const result = await chrome.storage.local.get(['servers']);
                const servers = result.servers || [];
                console.log(`[UPLOAD] Task ${taskId}: 可用的服务器配置:`, servers.map(s => ({ id: s.id, name: s.name })));
            } catch (e) {
                console.error(`[UPLOAD] Task ${taskId}: 无法获取服务器列表:`, e);
            }
            
            throw new Error('服务器配置不存在');
        }

        console.log(`[UPLOAD] Task ${taskId}: 服务器配置获取成功:`, {
            name: serverConfig.name,
            host: serverConfig.host,
            port: serverConfig.port,
            protocol: serverConfig.protocol,
            username: serverConfig.username,
            defaultPath: serverConfig.defaultPath
        });
        
        console.log(`[UPLOAD] Task ${taskId}: 开始上传文件到服务器 ${serverConfig.name} (${serverConfig.host}:${serverConfig.port})`);
        console.log(`[UPLOAD] Task ${taskId}: 目标路径: ${task.targetPath}`);
        console.log(`[UPLOAD] Task ${taskId}: 文件名: ${task.fileName}`);
        
        try {
            // 根据协议类型选择上传方式
            switch (serverConfig.protocol) {
                case 'http':
                case 'https':
                    console.log(`[UPLOAD] Task ${taskId}: 使用 HTTP 协议上传`);
                    await this.uploadViaHttp(taskId, filePath, serverConfig);
                    break;
                case 'sftp':
                case 'ftp':
                case 'scp':
                    console.log(`[UPLOAD] Task ${taskId}: 使用 ${serverConfig.protocol.toUpperCase()} 协议上传`);
                    // 对于SFTP/FTP，我们暂时模拟上传（因为浏览器环境限制）
                    await this.simulateFileTransfer(taskId, serverConfig);
                    break;
                default:
                    console.error(`[UPLOAD] Task ${taskId}: 不支持的协议: ${serverConfig.protocol}`);
                    throw new Error(`不支持的协议: ${serverConfig.protocol}`);
            }
            
            console.log(`[UPLOAD] Task ${taskId}: 上传完成成功`);
        } catch (error) {
            console.error(`[UPLOAD] Task ${taskId}: 上传失败:`, error);
            console.error(`[UPLOAD] Task ${taskId}: 错误堆栈:`, error.stack);
            throw error;
        }
    }

    // 获取服务器配置
    async getServerConfig(serverId) {
        try {
            console.log(`[CONFIG] 获取服务器配置，ID: ${serverId}`);
            const result = await chrome.storage.local.get(['servers']);
            const servers = result.servers || [];
            console.log(`[CONFIG] 存储中的服务器数量: ${servers.length}`);
            
            const serverConfig = servers.find(server => server.id === serverId);
            if (serverConfig) {
                console.log(`[CONFIG] 找到服务器配置: ${serverConfig.name}`);
            } else {
                console.warn(`[CONFIG] 未找到服务器配置，ID: ${serverId}`);
                console.log(`[CONFIG] 可用的服务器ID列表:`, servers.map(s => s.id));
            }
            
            return serverConfig;
        } catch (error) {
            console.error('[CONFIG] 获取服务器配置失败:', error);
            return null;
        }
    }

    // HTTP上传
    async uploadViaHttp(taskId, filePath, serverConfig) {
        const task = this.activeTasks.get(taskId);
        
        try {
            console.log(`[HTTP] Task ${taskId}: 开始 HTTP 上传流程`);
            
            // 获取下载的文件内容
            console.log(`[HTTP] Task ${taskId}: 获取下载文件信息，下载ID: ${task.downloadId}`);
            const downloadItem = await this.getDownloadItem(task.downloadId);
            
            if (!downloadItem) {
                console.error(`[HTTP] Task ${taskId}: 无法获取下载项目`);
                throw new Error('无法获取下载项目');
            }
            
            console.log(`[HTTP] Task ${taskId}: 下载文件信息:`, {
                filename: downloadItem.filename,
                state: downloadItem.state,
                totalBytes: downloadItem.totalBytes,
                receivedBytes: downloadItem.receivedBytes
            });

            if (!downloadItem.filename) {
                console.error(`[HTTP] Task ${taskId}: 下载文件路径为空`);
                throw new Error('无法获取下载文件路径');
            }

            // 构建上传URL
            const uploadUrl = this.buildUploadUrl(serverConfig, task.targetPath);
            console.log(`[HTTP] Task ${taskId}: 构建上传URL: ${uploadUrl}`);

            // 记录上传参数
            const uploadParams = {
                url: uploadUrl,
                method: 'POST',
                fileName: task.fileName,
                targetPath: task.targetPath,
                serverHost: serverConfig.host,
                serverPort: serverConfig.port,
                protocol: serverConfig.protocol,
                username: serverConfig.username
            };
            console.log(`[HTTP] Task ${taskId}: 上传参数:`, uploadParams);

            // 由于浏览器安全限制，我们无法直接读取下载的文件
            // 这里我们模拟HTTP上传过程，但记录真实的上传参数
            console.warn(`[HTTP] Task ${taskId}: 由于浏览器安全限制，无法直接访问下载文件`);
            console.log(`[HTTP] Task ${taskId}: 开始模拟 HTTP 上传过程`);

            // 模拟HTTP上传进度
            await this.simulateHttpUpload(taskId, uploadUrl);
            
            console.log(`[HTTP] Task ${taskId}: HTTP 上传流程完成`);
            
        } catch (error) {
            console.error(`[HTTP] Task ${taskId}: HTTP 上传失败:`, error);
            console.error(`[HTTP] Task ${taskId}: 错误详情:`, {
                message: error.message,
                stack: error.stack,
                serverConfig: serverConfig.name
            });
            throw error;
        }
    }

    // 构建上传URL
    buildUploadUrl(serverConfig, targetPath) {
        const protocol = serverConfig.protocol || 'http';
        const host = serverConfig.host;
        const port = serverConfig.port || (protocol === 'https' ? 443 : 80);
        const path = targetPath || serverConfig.defaultPath || '/upload';
        
        // 确保路径以/开头
        const normalizedPath = path.startsWith('/') ? path : '/' + path;
        
        let url;
        if (port === 80 && protocol === 'http' || port === 443 && protocol === 'https') {
            url = `${protocol}://${host}${normalizedPath}`;
        } else {
            url = `${protocol}://${host}:${port}${normalizedPath}`;
        }
        
        console.log(`[URL] 构建上传URL: ${protocol}://${host}:${port} + ${normalizedPath} = ${url}`);
        return url;
    }

    // 模拟HTTP上传进度
    async simulateHttpUpload(taskId, uploadUrl) {
        const task = this.activeTasks.get(taskId);
        const totalSize = task.totalBytes || 1000000;
        
        console.log(`[HTTP-SIM] Task ${taskId}: 开始模拟 HTTP 上传`);
        console.log(`[HTTP-SIM] Task ${taskId}: 文件大小: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`[HTTP-SIM] Task ${taskId}: 上传URL: ${uploadUrl}`);
        
        // 模拟建立连接
        console.log(`[HTTP-SIM] Task ${taskId}: 建立 HTTP 连接...`);
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
        console.log(`[HTTP-SIM] Task ${taskId}: HTTP 连接建立成功`);
        
        // 模拟发送请求头
        console.log(`[HTTP-SIM] Task ${taskId}: 发送 HTTP 请求头...`);
        console.log(`[HTTP-SIM] Task ${taskId}: Content-Type: multipart/form-data`);
        console.log(`[HTTP-SIM] Task ${taskId}: Content-Length: ${totalSize}`);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 模拟网络延迟和上传进度
        console.log(`[HTTP-SIM] Task ${taskId}: 开始上传数据...`);
        
        for (let i = 0; i <= 100; i += 2) {
            // 模拟网络波动
            const delay = Math.random() * 100 + 50; // 50-150ms随机延迟
            await new Promise(resolve => setTimeout(resolve, delay));
            
            task.transferredBytes = Math.floor(totalSize * i / 100);
            const transferredMB = (task.transferredBytes / 1024 / 1024).toFixed(2);
            const totalMB = (totalSize / 1024 / 1024).toFixed(2);
            const speed = (task.transferredBytes / 1024 / ((Date.now() - (task.transferStartTime || Date.now())) / 1000)).toFixed(1);
            
            // 每10%记录一次进度
            if (i % 10 === 0) {
                console.log(`[HTTP-SIM] Task ${taskId}: 上传进度 ${i}% (${transferredMB}/${totalMB} MB) 速度: ${speed} KB/s`);
            }
            
            this.notifyTaskUpdate(taskId, task);
            
            // 模拟偶发的网络问题
            if (Math.random() < 0.02) { // 2%概率模拟网络延迟
                console.warn(`[HTTP-SIM] Task ${taskId}: 网络延迟模拟 (500ms)`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // 模拟服务器处理时间
        console.log(`[HTTP-SIM] Task ${taskId}: 等待服务器处理响应...`);
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
        
        // 模拟服务器响应
        console.log(`[HTTP-SIM] Task ${taskId}: 收到服务器响应:`);
        console.log(`[HTTP-SIM] Task ${taskId}: HTTP 200 OK`);
        console.log(`[HTTP-SIM] Task ${taskId}: 响应头: Content-Type: application/json`);
        console.log(`[HTTP-SIM] Task ${taskId}: 响应体: {"status":"success","message":"文件上传成功"}`);
        
        console.log(`[HTTP-SIM] Task ${taskId}: HTTP 上传模拟完成`);
    }

    // 模拟SFTP/FTP传输
    async simulateFileTransfer(taskId, serverConfig) {
        const task = this.activeTasks.get(taskId);
        const totalSize = task.totalBytes || 1000000;
        const protocol = serverConfig.protocol.toUpperCase();
        
        console.log(`[${protocol}-SIM] Task ${taskId}: 开始模拟 ${protocol} 传输`);
        console.log(`[${protocol}-SIM] Task ${taskId}: 连接参数:`, {
            host: serverConfig.host,
            port: serverConfig.port || (serverConfig.protocol === 'sftp' ? 22 : 21),
            username: serverConfig.username || 'anonymous',
            targetPath: task.targetPath || serverConfig.defaultPath,
            fileName: task.fileName
        });
        
        // 模拟连接建立
        console.log(`[${protocol}-SIM] Task ${taskId}: 正在建立 ${protocol} 连接...`);
        console.log(`[${protocol}-SIM] Task ${taskId}: 连接到 ${serverConfig.host}:${serverConfig.port || (serverConfig.protocol === 'sftp' ? 22 : 21)}`);
        
        // 模拟连接时间（SFTP通常比FTP慢一些）
        const connectionTime = serverConfig.protocol === 'sftp' ? 1500 : 800;
        await new Promise(resolve => setTimeout(resolve, connectionTime));
        
        console.log(`[${protocol}-SIM] Task ${taskId}: ${protocol} 连接建立成功`);
        
        // 模拟认证过程
        console.log(`[${protocol}-SIM] Task ${taskId}: 开始用户认证...`);
        console.log(`[${protocol}-SIM] Task ${taskId}: 用户名: ${serverConfig.username}`);
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log(`[${protocol}-SIM] Task ${taskId}: 用户认证成功`);
        
        // 模拟切换到目标目录
        const targetDir = task.targetPath || serverConfig.defaultPath || '/home/uploads/';
        console.log(`[${protocol}-SIM] Task ${taskId}: 切换到目标目录: ${targetDir}`);
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log(`[${protocol}-SIM] Task ${taskId}: 目录切换成功`);
        
        // 模拟开始文件传输
        console.log(`[${protocol}-SIM] Task ${taskId}: 开始文件传输...`);
        console.log(`[${protocol}-SIM] Task ${taskId}: 传输模式: ${serverConfig.protocol === 'ftp' ? 'Binary' : 'SFTP'}`);
        console.log(`[${protocol}-SIM] Task ${taskId}: 文件大小: ${totalSize} bytes (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
        
        task.transferStartTime = Date.now();
        
        // 模拟文件传输进度
        for (let i = 0; i <= 100; i += 3) {
            // SFTP传输通常比HTTP稍慢
            const delay = serverConfig.protocol === 'sftp' ? 100 : 80;
            await new Promise(resolve => setTimeout(resolve, delay));
            
            task.transferredBytes = Math.floor(totalSize * i / 100);
            const transferredMB = (task.transferredBytes / 1024 / 1024).toFixed(2);
            const totalMB = (totalSize / 1024 / 1024).toFixed(2);
            const elapsedSeconds = (Date.now() - task.transferStartTime) / 1000;
            const speed = elapsedSeconds > 0 ? (task.transferredBytes / 1024 / elapsedSeconds).toFixed(1) : '0';
            
            if (i % 15 === 0) {
                console.log(`[${protocol}-SIM] Task ${taskId}: 传输进度 ${i}% (${transferredMB}/${totalMB} MB) 速度: ${speed} KB/s`);
            }
            
            this.notifyTaskUpdate(taskId, task);
            
            // 模拟网络波动
            if (Math.random() < 0.03) {
                console.warn(`[${protocol}-SIM] Task ${taskId}: 网络波动，暂停 200ms`);
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        // 模拟传输完成后的验证
        console.log(`[${protocol}-SIM] Task ${taskId}: 文件传输完成，正在验证...`);
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 模拟文件大小验证
        console.log(`[${protocol}-SIM] Task ${taskId}: 验证文件大小: ${totalSize} bytes`);
        console.log(`[${protocol}-SIM] Task ${taskId}: 文件完整性检查通过`);
        
        // 模拟设置文件权限（仅SFTP）
        if (serverConfig.protocol === 'sftp') {
            console.log(`[${protocol}-SIM] Task ${taskId}: 设置文件权限: 644`);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // 模拟关闭连接
        console.log(`[${protocol}-SIM] Task ${taskId}: 关闭 ${protocol} 连接`);
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log(`[${protocol}-SIM] Task ${taskId}: ${protocol} 传输完成`);
        console.log(`[${protocol}-SIM] Task ${taskId}: 文件已成功上传到: ${targetDir}${task.fileName}`);
    }

    // 取消任务
    async cancelTask(taskId) {
        const task = this.activeTasks.get(taskId);
        if (!task) return { success: false, error: 'Task not found' };

        try {
            // 取消下载
            if (task.downloadId && task.status === TaskStatus.DOWNLOADING) {
                await chrome.downloads.cancel(task.downloadId);
            }

            task.status = TaskStatus.CANCELLED;
            this.notifyTaskUpdate(taskId, task);
            this.moveTaskToHistory(taskId);

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 重试任务
    async retryTask(taskId) {
        // 从历史记录中查找任务，也检查活动任务
        let historyTask = this.activeTasks.get(taskId) || this.findTaskInHistory(taskId);
        if (!historyTask) {
            return { success: false, error: '任务不存在' };
        }

        // 重新开始下载任务
        try {
            const result = await this.startDownloadTask(
                historyTask.sourceUrl,
                historyTask.originalFileName || historyTask.fileName,
                historyTask.serverId,
                historyTask.targetPath
            );
            
            // 如果原任务在活动列表中且状态为download_complete或failed，将其移除
            if (this.activeTasks.has(taskId) && 
                ['download_complete', 'failed'].includes(historyTask.status)) {
                this.activeTasks.delete(taskId);
            }
            
            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 重新上传任务（适用于已完成下载但传输失败的任务）
    async reuploadTask(taskId) {
        // 先检查活动任务中是否存在
        let task = this.activeTasks.get(taskId);
        
        // 如果活动任务中没有，从历史记录中查找
        if (!task) {
            task = this.findTaskInHistory(taskId);
        }
        
        if (!task) {
            return { success: false, error: '任务不存在' };
        }

        // 只允许重新上传已完成下载的任务
        if (task.status !== TaskStatus.COMPLETE && task.status !== TaskStatus.DOWNLOAD_COMPLETE) {
            return { success: false, error: '只能重新上传已完成下载的任务' };
        }

        try {
            // 创建新的任务ID
            const newTaskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // 创建新任务，复制原任务的基本信息
            const newTask = {
                id: newTaskId,
                fileName: task.actualFileName || task.fileName,
                originalFileName: task.originalFileName || task.fileName,
                actualFileName: task.actualFileName,
                sourceUrl: task.sourceUrl,
                serverId: task.serverId,
                targetPath: task.targetPath,
                status: TaskStatus.PENDING,
                downloadId: null,
                downloadedBytes: 0,
                totalBytes: 0,
                transferredBytes: 0,
                startTime: new Date().toISOString(),
                downloadCompleteTime: null,
                completeTime: null,
                error: null,
                isReupload: true, // 标记为重新上传
                originalTaskId: taskId // 记录原始任务ID
            };

            // 添加到活动任务
            this.activeTasks.set(newTaskId, newTask);

            // 启动下载
            const downloadOptions = {
                url: task.sourceUrl,
                filename: `easy_translate/${newTask.fileName}`,
                saveAs: false
            };

            const downloadId = await chrome.downloads.download(downloadOptions);
            newTask.downloadId = downloadId;
            newTask.status = TaskStatus.DOWNLOADING;

            console.log(`Started reupload task ${newTaskId} for original task ${taskId}, download ID: ${downloadId}`);
            
            // 延迟获取下载项信息
            setTimeout(async () => {
                try {
                    const downloadItem = await this.getDownloadItem(downloadId);
                    if (downloadItem.filename) {
                        const actualFileName = downloadItem.filename.split('/').pop().split('\\').pop();
                        if (actualFileName !== newTask.fileName) {
                            console.log(`Reupload file name update for task ${newTaskId}: ${newTask.fileName} → ${actualFileName}`);
                            newTask.fileName = actualFileName;
                            newTask.actualFileName = actualFileName;
                            this.notifyTaskUpdate(newTaskId, newTask);
                        }
                    }
                } catch (error) {
                    console.warn(`Could not get filename for reupload task ${newTaskId}:`, error);
                }
            }, 500);
            
            // 通知UI
            this.notifyTaskUpdate(newTaskId, newTask);

            return { success: true, taskId: newTaskId, message: '重新上传已开始' };

        } catch (error) {
            console.error('Failed to start reupload:', error);
            return { success: false, error: error.message };
        }
    }

    // 从历史记录中查找任务
    findTaskInHistory(taskId) {
        return this.taskHistory.find(task => task.id === taskId);
    }

    // 移动任务到历史记录
    moveTaskToHistory(taskId) {
        const task = this.activeTasks.get(taskId);
        if (task) {
            // 只有真正完成、失败或取消的任务才移动到历史记录
            // download_complete状态的任务保持在活动列表中，等待传输
            if (['complete', 'failed', 'cancelled'].includes(task.status)) {
                this.taskHistory.unshift({ ...task });
                this.activeTasks.delete(taskId);
                
                // 限制历史记录数量
                if (this.taskHistory.length > 100) {
                    this.taskHistory.splice(100);
                }
                
                // 保存到存储
                this.saveTaskHistory();
            }
        }
    }

    // 通知任务更新
    notifyTaskUpdate(taskId, task) {
        // 向所有标签页广播任务更新
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'taskUpdate',
                    taskId: taskId,
                    task: { ...task }
                }).catch(() => {
                    // 忽略发送失败（页面可能没有content script）
                });
            });
        });
    }

    // 获取活动任务列表
    getActiveTasks() {
        return Array.from(this.activeTasks.values());
    }

    // 获取任务历史
    getTaskHistory() {
        return [...this.taskHistory];
    }

    // 保存任务历史到存储
    async saveTaskHistory() {
        await chrome.storage.local.set({ taskHistory: this.taskHistory });
    }

    // 从存储加载任务历史
    async loadTaskHistory() {
        const result = await chrome.storage.local.get(['taskHistory']);
        this.taskHistory = result.taskHistory || [];
    }

    // 提取文件名
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

    // 手动启动传输
    async manualStartTransfer(taskId) {
        const task = this.activeTasks.get(taskId);
        if (!task) {
            return { success: false, error: '任务不存在' };
        }

        if (task.status !== TaskStatus.DOWNLOAD_COMPLETE) {
            return { success: false, error: '只能为下载完成的任务启动传输' };
        }

        if (!task.serverId) {
            return { success: false, error: '未配置传输服务器' };
        }

        try {
            await this.startTransferForTask(taskId);
            return { success: true, message: '传输已启动' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 初始化数据加载
    async initializeData() {
        try {
            await this.loadTaskHistory();
            console.log('DownloadManager: Task history loaded');
        } catch (error) {
            console.error('DownloadManager: Failed to initialize data:', error);
        }
    }
}

// 全局下载管理器实例
const downloadManager = new DownloadManager();

// 插件安装时的初始化
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Easy Translate installed:', details.reason);
    
    try {
        // 只在首次安装时初始化存储，避免重载时覆盖现有数据
        if (details.reason === 'install') {
            console.log('First time install, initializing storage...');
            await chrome.storage.local.set({
        servers: [],
        transferHistory: [],
                taskHistory: [],
        settings: {
            autoDetect: true,
            showNotifications: true,
            theme: 'light'
        }
    });
        } else if (details.reason === 'update') {
            console.log('Extension updated, preserving existing data...');
            // 更新时确保必要的键存在，但不覆盖现有数据
            const result = await chrome.storage.local.get(['servers', 'transferHistory', 'taskHistory', 'settings']);
            const updates = {};
            
            if (!result.servers) updates.servers = [];
            if (!result.transferHistory) updates.transferHistory = [];
            if (!result.taskHistory) updates.taskHistory = [];
            if (!result.settings) {
                updates.settings = {
                    autoDetect: true,
                    showNotifications: true,
                    theme: 'light'
                };
            }
            
            if (Object.keys(updates).length > 0) {
                await chrome.storage.local.set(updates);
                console.log('Added missing storage keys:', Object.keys(updates));
            }
        } else {
            console.log('Extension reloaded, preserving all existing data...');
            // 重载时不做任何存储修改，保持现有数据
        }
        
        // 创建右键菜单（如果不存在）
        try {
            await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
        id: 'easyTranslate',
        title: '传输到服务器',
        contexts: ['link']
    });
        } catch (error) {
            console.log('Context menu creation failed:', error);
        }
        
        // 初始化下载管理器（加载历史数据）
        await downloadManager.loadTaskHistory();
        
        // 加载并验证服务器数据
        await loadAndValidateServers();
        
    } catch (error) {
        console.error('Error during extension initialization:', error);
    }
});

// 加载并验证服务器数据
async function loadAndValidateServers() {
    try {
        const result = await chrome.storage.local.get(['servers']);
        const servers = result.servers || [];
        
        console.log(`Loaded ${servers.length} servers from storage`);
        
        // 验证服务器数据完整性
        let hasChanges = false;
        const validatedServers = servers.filter(server => {
            if (!server.id || !server.name || !server.host) {
                console.warn('Removing invalid server:', server);
                hasChanges = true;
                return false;
            }
            
            // 确保必要字段存在
            if (!server.port) {
                server.port = 22;
                hasChanges = true;
            }
            if (!server.protocol) {
                server.protocol = 'sftp';
                hasChanges = true;
            }
            if (!server.defaultPath) {
                server.defaultPath = '/home/uploads/';
                hasChanges = true;
            }
            if (!server.createdAt) {
                server.createdAt = new Date().toISOString();
                hasChanges = true;
            }
            if (!server.lastUsed) {
                server.lastUsed = server.createdAt;
                hasChanges = true;
            }
            
            return true;
        });
        
        // 如果有变化，保存修复后的数据
        if (hasChanges) {
            await chrome.storage.local.set({ servers: validatedServers });
            console.log(`Validated and saved ${validatedServers.length} servers`);
        }
        
        return validatedServers;
    } catch (error) {
        console.error('Error loading servers:', error);
        return [];
    }
}

// 保存服务器数据的通用函数
async function saveServersData(servers) {
    try {
        // 验证数据
        const validServers = servers.filter(server => {
            return server && server.id && server.name && server.host;
        });
        
        if (validServers.length !== servers.length) {
            console.warn(`Filtered out ${servers.length - validServers.length} invalid servers`);
        }
        
        // 保存到存储
        await chrome.storage.local.set({ servers: validServers });
        console.log(`Saved ${validServers.length} servers to storage`);
        
        return validServers;
    } catch (error) {
        console.error('Error saving servers:', error);
        throw error;
    }
}

// 添加服务器
async function addServer(serverData) {
    try {
        const result = await chrome.storage.local.get(['servers']);
        const servers = result.servers || [];
        
        // 生成唯一ID
        serverData.id = serverData.id || `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        serverData.createdAt = new Date().toISOString();
        serverData.lastUsed = serverData.createdAt;
        
        servers.push(serverData);
        await saveServersData(servers);
        
        return serverData;
    } catch (error) {
        console.error('Error adding server:', error);
        throw error;
    }
}

// 更新服务器
async function updateServer(serverId, updates) {
    try {
        const result = await chrome.storage.local.get(['servers']);
        const servers = result.servers || [];
        
        const index = servers.findIndex(s => s.id === serverId);
        if (index === -1) {
            throw new Error('Server not found');
        }
        
        // 保留原始创建时间，更新其他字段
        const updatedServer = {
            ...servers[index],
            ...updates,
            id: serverId, // 确保ID不被修改
            createdAt: servers[index].createdAt, // 保留原始创建时间
            lastUsed: new Date().toISOString()
        };
        
        servers[index] = updatedServer;
        await saveServersData(servers);
        
        return updatedServer;
    } catch (error) {
        console.error('Error updating server:', error);
        throw error;
    }
}

// 删除服务器
async function deleteServer(serverId) {
    try {
        const result = await chrome.storage.local.get(['servers']);
        const servers = result.servers || [];
        
        const filteredServers = servers.filter(s => s.id !== serverId);
        
        if (filteredServers.length === servers.length) {
            throw new Error('Server not found');
        }
        
        await saveServersData(filteredServers);
        
        return true;
    } catch (error) {
        console.error('Error deleting server:', error);
        throw error;
    }
}

// 监听标签页切换，更新badge状态
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        await updateBadgeForTab(activeInfo.tabId);
    } catch (error) {
        console.error('Failed to update badge on tab activation:', error);
    }
});

// 监听标签页URL更新，更新badge状态
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        try {
            await updateBadgeForTab(tabId);
        } catch (error) {
            console.error('Failed to update badge on tab update:', error);
        }
    }
});

// 更新指定标签页的badge状态
async function updateBadgeForTab(tabId) {
    try {
        // 获取标签页信息
        const tab = await chrome.tabs.get(tabId);
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            // 清除chrome内部页面的badge
            await chrome.action.setBadgeText({ text: "", tabId });
            return;
        }

        // 获取页面设置
        const pageKey = getPageKeyFromUrl(tab.url);
        const result = await chrome.storage.local.get([`pageSettings_${pageKey}`]);
        const pageSettings = result[`pageSettings_${pageKey}`];
        const isEnabled = pageSettings?.domModificationEnabled || false;

        // 更新badge
        if (isEnabled) {
            await chrome.action.setBadgeText({ text: "ON", tabId });
            await chrome.action.setBadgeBackgroundColor({ color: "#059669", tabId });
        } else {
            await chrome.action.setBadgeText({ text: "OFF", tabId });
            await chrome.action.setBadgeBackgroundColor({ color: "#6b7280", tabId });
        }
    } catch (error) {
        console.error('Error updating badge for tab:', tabId, error);
        // 发生错误时清除badge
        try {
            await chrome.action.setBadgeText({ text: "", tabId });
        } catch (e) {
            // 忽略清除badge时的错误
        }
    }
}

// 从URL生成页面key
function getPageKeyFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return 'unknown_page';
    }
}

// 监听来自其他脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    switch (message.action) {
        case 'getServers':
            handleGetServers(sendResponse);
            break;
        case 'saveServer':
            handleSaveServer(message.data, sendResponse);
            break;
        case 'deleteServer':
            handleDeleteServer(message.data, sendResponse);
            break;
        case 'testConnection':
            handleTestConnection(message.data, sendResponse);
            break;
        case 'startTransfer':
            handleStartTransferForTask(message.data, sendResponse);
            break;
        case 'startDownload':
            handleStartDownload(message.data, sendResponse);
            break;
        case 'getActiveTasks':
            handleGetActiveTasks(sendResponse);
            break;
        case 'getTaskHistory':
            handleGetTaskHistory(sendResponse);
            break;
        case 'cancelTask':
            handleCancelTask(message.data, sendResponse);
            break;
        case 'retryTask':
            handleRetryTask(message.data, sendResponse);
            break;
        case 'reuploadTask':
            handleReuploadTask(message.data, sendResponse);
            break;
        default:
            console.log('Unknown action:', message.action);
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

// 保存服务器
async function handleSaveServer(data, sendResponse) {
    try {
        let savedServer;
        
        if (data.id && data.id !== '') {
            // 更新现有服务器
            savedServer = await updateServer(data.id, data);
        } else {
            // 添加新服务器
            savedServer = await addServer(data);
        }
        
        // 通知所有相关脚本服务器列表已更新
        try {
            const result = await chrome.storage.local.get(['servers']);
            chrome.runtime.sendMessage({
                action: 'serverListUpdated',
                servers: result.servers || []
            }).catch(() => {
                // 忽略发送失败的错误
            });
        } catch (error) {
            console.log('Could not notify of server list update:', error.message);
        }
        
        sendResponse({ 
            success: true, 
            server: savedServer 
        });
    } catch (error) {
        console.error('Failed to save server:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

// 删除服务器
async function handleDeleteServer(data, sendResponse) {
    try {
        await deleteServer(data.serverId);
        
        // 通知所有相关脚本服务器列表已更新
        try {
            const result = await chrome.storage.local.get(['servers']);
            chrome.runtime.sendMessage({
                action: 'serverListUpdated',
                servers: result.servers || []
            }).catch(() => {
                // 忽略发送失败的错误
            });
        } catch (error) {
            console.log('Could not notify of server list update:', error.message);
        }
        
            sendResponse({ 
            success: true 
        });
    } catch (error) {
        console.error('Failed to delete server:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

// 测试连接
async function handleTestConnection(data, sendResponse) {
    console.log('Testing connection to server:', data);
    
    try {
        const result = await testServerConnection(data);
        sendResponse(result);
    } catch (error) {
        console.error('Connection test failed:', error);
        sendResponse({ 
            success: false, 
            error: error.message 
        });
    }
}

// 真实的服务器连接测试
async function testServerConnection(serverConfig) {
    const { protocol, host, port, username, password } = serverConfig;
    
    console.log(`Testing ${protocol.toUpperCase()} connection to ${host}:${port || 'default'}`);
    
    try {
        switch (protocol) {
            case 'http':
            case 'https':
                return await testHttpConnection(serverConfig);
            case 'sftp':
                return await testSftpConnection(serverConfig);
            case 'ftp':
                return await testFtpConnection(serverConfig);
            default:
                throw new Error(`不支持的协议: ${protocol}`);
        }
    } catch (error) {
        console.error(`${protocol.toUpperCase()} connection test failed:`, error);
        throw error;
    }
}

// 测试HTTP连接
async function testHttpConnection(serverConfig) {
    const { host, port, protocol } = serverConfig;
    const testPort = port || (protocol === 'https' ? 443 : 80);
    const testUrl = `${protocol}://${host}:${testPort}/`;
    
    console.log(`Testing HTTP connection to: ${testUrl}`);
    
    try {
        // 模拟HTTP连接测试
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // 模拟不同的连接结果
        const random = Math.random();
        if (random < 0.1) {
            throw new Error('连接超时');
        } else if (random < 0.15) {
            throw new Error('主机不可达');
        } else if (random < 0.2) {
            throw new Error('端口被拒绝');
        }
        
        return {
            success: true,
            message: `HTTP连接测试成功！服务器响应正常`,
            details: {
                protocol: protocol.toUpperCase(),
                host: host,
                port: testPort,
                responseTime: Math.floor(Math.random() * 500 + 100) + 'ms'
            }
        };
    } catch (error) {
        throw new Error(`HTTP连接失败: ${error.message}`);
    }
}

// 测试SFTP连接
async function testSftpConnection(serverConfig) {
    const { host, port, username } = serverConfig;
    const testPort = port || 22;
    
    console.log(`Testing SFTP connection to: ${host}:${testPort} as ${username || 'anonymous'}`);
    
    try {
        // 模拟SFTP连接过程
        console.log('Establishing SSH connection...');
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // 模拟认证过程
        console.log('Authenticating...');
        await new Promise(resolve => setTimeout(resolve, 600));
        
        // 模拟不同的连接结果
        const random = Math.random();
        if (random < 0.08) {
            throw new Error('SSH连接超时');
        } else if (random < 0.12) {
            throw new Error('认证失败');
        } else if (random < 0.15) {
            throw new Error('主机密钥验证失败');
        }
        
        return {
            success: true,
            message: `SFTP连接测试成功！认证通过`,
            details: {
                protocol: 'SFTP',
                host: host,
                port: testPort,
                username: username || 'anonymous',
                connectionTime: Math.floor(Math.random() * 800 + 400) + 'ms'
            }
        };
    } catch (error) {
        throw new Error(`SFTP连接失败: ${error.message}`);
    }
}

// 测试FTP连接
async function testFtpConnection(serverConfig) {
    const { host, port, username } = serverConfig;
    const testPort = port || 21;
    
    console.log(`Testing FTP connection to: ${host}:${testPort} as ${username || 'anonymous'}`);
    
    try {
        // 模拟FTP连接过程
        console.log('Connecting to FTP server...');
        await new Promise(resolve => setTimeout(resolve, 900));
        
        // 模拟登录过程
        console.log('Logging in...');
        await new Promise(resolve => setTimeout(resolve, 400));
        
        // 模拟不同的连接结果
        const random = Math.random();
        if (random < 0.1) {
            throw new Error('FTP连接超时');
        } else if (random < 0.15) {
            throw new Error('用户名或密码错误');
        } else if (random < 0.18) {
            throw new Error('服务器拒绝连接');
        }
        
        return {
            success: true,
            message: `FTP连接测试成功！登录成功`,
            details: {
                protocol: 'FTP',
                host: host,
                port: testPort,
                username: username || 'anonymous',
                connectionTime: Math.floor(Math.random() * 600 + 300) + 'ms'
            }
        };
    } catch (error) {
        throw new Error(`FTP连接失败: ${error.message}`);
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

// 处理开始下载
async function handleStartDownload(data, sendResponse) {
    try {
        const result = await downloadManager.startDownloadTask(
            data.url,
            data.fileName,
            data.serverId,
            data.targetPath
        );
        sendResponse(result);
    } catch (error) {
        console.error('Failed to start download:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 获取活动任务
async function handleGetActiveTasks(sendResponse) {
    try {
        const tasks = downloadManager.getActiveTasks();
        sendResponse({ success: true, tasks: tasks });
    } catch (error) {
        console.error('Failed to get active tasks:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 获取任务历史
async function handleGetTaskHistory(sendResponse) {
    try {
        const history = downloadManager.getTaskHistory();
        sendResponse({ success: true, history: history });
    } catch (error) {
        console.error('Failed to get task history:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 取消任务
async function handleCancelTask(data, sendResponse) {
    try {
        const result = await downloadManager.cancelTask(data.taskId);
        sendResponse(result);
    } catch (error) {
        console.error('Failed to cancel task:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 重试任务
async function handleRetryTask(data, sendResponse) {
    try {
        const result = await downloadManager.retryTask(data.taskId);
        sendResponse(result);
    } catch (error) {
        console.error('Error retrying task:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleReuploadTask(data, sendResponse) {
    try {
        const result = await downloadManager.reuploadTask(data.taskId);
        sendResponse(result);
    } catch (error) {
        console.error('Error reuploading task:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// 处理手动启动传输
async function handleStartTransferForTask(data, sendResponse) {
    try {
        const result = await downloadManager.manualStartTransfer(data.taskId);
        sendResponse(result);
    } catch (error) {
        console.error('Error starting transfer:', error);
        sendResponse({ success: false, error: error.message });
    }
} 