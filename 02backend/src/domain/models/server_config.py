from dataclasses import dataclass, field


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
    paths: list[dict] = field(default_factory=list)  # 新增字段
    latest_use_at: str = ""  # 新增字段，最后一次使用时间，ISO字符串
