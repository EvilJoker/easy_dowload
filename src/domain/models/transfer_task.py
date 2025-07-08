from typing import Optional
from dataclasses import dataclass

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