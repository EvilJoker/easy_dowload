/**
 * Easy Translate API 客户端
 * 统一管理与后端的 HTTP 通信
 */

class ApiClient {
    constructor() {
        // 默认API地址，可以通过配置修改
        this.baseUrl = 'http://localhost:5000';
        this.timeout = 10000; // 10秒超时
    }

    /**
     * 设置API基础地址
     * @param {string} baseUrl - API基础地址
     */
    setBaseUrl(baseUrl) {
        this.baseUrl = baseUrl;
    }

    /**
     * 发送HTTP请求
     * @param {string} endpoint - API端点
     * @param {Object} options - 请求选项
     * @returns {Promise<Object>} 响应数据
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            timeout: this.timeout,
            ...options
        };

        try {
            console.log(`[API] ${config.method} ${url}`, options.body || '');
            
            const response = await fetch(url, config);
            
            if (!response.ok) {
                let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const data = await response.clone().json();
                    if (data && data.error) {
                        errorDetail = data.error;
                    }
                } catch (e) {}
                throw new Error(errorDetail);
            }
            
            const data = await response.json();
            console.log(`[API] Response:`, data);
            
            return data;
        } catch (error) {
            console.error(`[API] Error:`, error);
            throw error;
        }
    }

    /**
     * GET 请求
     * @param {string} endpoint - API端点
     * @returns {Promise<Object>} 响应数据
     */
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    /**
     * POST 请求
     * @param {string} endpoint - API端点
     * @param {Object} data - 请求数据
     * @returns {Promise<Object>} 响应数据
     */
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT 请求
     * @param {string} endpoint - API端点
     * @param {Object} data - 请求数据
     * @returns {Promise<Object>} 响应数据
     */
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE 请求
     * @param {string} endpoint - API端点
     * @returns {Promise<Object>} 响应数据
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // ==================== 服务器管理 API ====================

    /**
     * 获取服务器列表
     * @returns {Promise<Array>} 服务器列表
     */
    async getServers() {
        return this.get('/servers');
    }

    /**
     * 创建服务器配置
     * @param {Object} serverData - 服务器配置数据
     * @returns {Promise<Object>} 创建的服务器配置
     */
    async createServer(serverData) {
        return this.post('/servers', serverData);
    }

    /**
     * 获取服务器配置
     * @param {string} serverId - 服务器ID
     * @returns {Promise<Object>} 服务器配置
     */
    async getServer(serverId) {
        return this.get(`/servers/${serverId}`);
    }

    /**
     * 更新服务器配置
     * @param {string} serverId - 服务器ID
     * @param {Object} serverData - 更新的服务器数据
     * @returns {Promise<Object>} 更新结果
     */
    async updateServer(serverId, serverData) {
        return this.put(`/servers/${serverId}`, serverData);
    }

    /**
     * 删除服务器配置
     * @param {string} serverId - 服务器ID
     * @returns {Promise<Object>} 删除结果
     */
    async deleteServer(serverId) {
        return this.delete(`/servers/${serverId}`);
    }

    // ==================== 任务管理 API ====================

    /**
     * 获取任务列表
     * @returns {Promise<Array>} 任务列表
     */
    async getTasks() {
        return this.get('/tasks');
    }

    /**
     * 获取任务详情
     * @param {string} taskId - 任务ID
     * @returns {Promise<Object>} 任务详情
     */
    async getTask(taskId) {
        return this.get(`/tasks/${taskId}`);
    }

    /**
     * 取消任务
     * @param {string} taskId - 任务ID
     * @returns {Promise<Object>} 取消结果
     */
    async cancelTask(taskId) {
        return this.post(`/tasks/${taskId}/cancel`);
    }

    /**
     * 获取任务进度
     * @param {string} taskId - 任务ID
     * @returns {Promise<Object>} 任务进度
     */
    async getTaskProgress(taskId) {
        return this.get(`/progress/${taskId}`);
    }

    // ==================== 历史记录 API ====================

    /**
     * 获取历史记录列表
     * @returns {Promise<Array>} 历史记录列表
     */
    async getHistory() {
        return this.get('/history');
    }

    /**
     * 获取历史记录详情
     * @param {string} recordId - 记录ID
     * @returns {Promise<Object>} 历史记录详情
     */
    async getHistoryRecord(recordId) {
        return this.get(`/history/${recordId}`);
    }

    /**
     * 删除历史记录
     * @param {string} recordId - 记录ID
     * @returns {Promise<Object>} 删除结果
     */
    async deleteHistoryRecord(recordId) {
        return this.delete(`/history/${recordId}`);
    }

    /**
     * 清空历史记录
     * @returns {Promise<Object>} 清空结果
     */
    async clearHistory() {
        return this.post('/history/clear');
    }

    // ==================== 系统状态 API ====================

    /**
     * 健康检查
     * @returns {Promise<Object>} 健康状态
     */
    async healthCheck() {
        return this.get('/health');
    }

    /**
     * 获取统计信息
     * @returns {Promise<Object>} 统计信息
     */
    async getStatistics() {
        return this.get('/statistics');
    }

    /**
     * 获取错误统计
     * @returns {Promise<Object>} 错误统计
     */
    async getErrors() {
        return this.get('/errors');
    }

    /**
     * 清空错误日志
     * @returns {Promise<Object>} 清空结果
     */
    async clearErrors() {
        return this.post('/errors/clear');
    }

    // ==================== 数据转换工具 ====================

    /**
     * 将前端服务器数据转换为后端格式
     * @param {Object} frontendServer - 前端服务器数据
     * @returns {Object} 后端格式的服务器数据
     */
    convertFrontendToBackend(frontendServer) {
        return {
            name: frontendServer.name,
            host: frontendServer.host,
            port: frontendServer.port || 22,
            protocol: frontendServer.protocol || 'SFTP',
            username: frontendServer.username,
            password: frontendServer.password,
            default_path: frontendServer.defaultPath || '/home/uploads/'
        };
    }

    /**
     * 将后端服务器数据转换为前端格式
     * @param {Object} backendServer - 后端服务器数据
     * @returns {Object} 前端格式的服务器数据
     */
    convertBackendToFrontend(backendServer) {
        return {
            id: backendServer.id,
            name: backendServer.name,
            host: backendServer.host,
            port: backendServer.port,
            protocol: backendServer.protocol,
            username: backendServer.username,
            password: backendServer.password,
            defaultPath: backendServer.default_path,
            createdAt: backendServer.created_at,
            updatedAt: backendServer.updated_at
        };
    }

    /**
     * 将前端任务数据转换为后端格式
     * @param {Object} frontendTask - 前端任务数据
     * @returns {Object} 后端格式的任务数据
     */
    convertTaskFrontendToBackend(frontendTask) {
        return {
            file_url: frontendTask.fileUrl,
            server_id: frontendTask.serverId,
            target_path: frontendTask.targetPath || '/'
        };
    }

    /**
     * 将后端任务数据转换为前端格式
     * @param {Object} backendTask - 后端任务数据
     * @returns {Object} 前端格式的任务数据
     */
    convertTaskBackendToFrontend(backendTask) {
        return {
            id: backendTask.id,
            fileName: backendTask.file_name,
            fileSize: backendTask.file_size,
            status: backendTask.status,
            progress: backendTask.progress,
            startedAt: backendTask.started_at,
            serverId: backendTask.server_id,
            targetPath: backendTask.target_path
        };
    }

    /**
     * 上传本地文件到服务器
     * @param {Object} params - 上传参数对象
     * @param {string} params.local_path - 本地文件路径（如 ~/Downloads/xxx.zip）
     * @param {string} params.server_id - 目标服务器ID
     * @param {string} params.target_path - 服务器目标路径
     * @returns {Promise<Object>} 上传结果对象 { success: boolean, ... }
     */
    async uploadFile(params) {
        const form = new URLSearchParams(params).toString();
        const resp = await fetch(`${this.baseUrl}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.json();
    }
}

// 创建全局API客户端实例
const apiClient = new ApiClient();

// 导出API客户端
export default ApiClient;

// 兼容性导出（用于非模块环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiClient;
} else if (typeof window !== 'undefined') {
    // 浏览器环境
    window.ApiClient = ApiClient;
    window.apiClient = apiClient;
} 