from typing import Optional
from dataclasses import dataclass

@dataclass
class ServerConfig:
    """服务器配置数据模型"""
    id: str
    name: str
    host: str
    port: int
    protocol: str  # 'SFTP'
    username: str
    password: str  # 加密存储
    default_path: str
    created_at: str
    updated_at: str

@dataclass
class TransferTask:
    """传输任务数据模型"""
    id: str
    file_path: str
    file_name: str
    file_size: int
    server_id: str
    target_path: str
    status: str
    progress: float
    started_at: str
    completed_at: Optional[str] 