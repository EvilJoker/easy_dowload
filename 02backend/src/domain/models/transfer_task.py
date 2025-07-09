from dataclasses import dataclass
from typing import Optional


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


class TransferHistory:
    def __init__(
        self,
        id: str,
        task_id: str,
        file_name: str,
        server_name: str,
        status: str,
        file_size: int,
        duration: float,
        created_at: str,
    ):
        self.id = id
        self.task_id = task_id
        self.file_name = file_name
        self.server_name = server_name
        self.status = status
        self.file_size = file_size
        self.duration = duration
        self.created_at = created_at
