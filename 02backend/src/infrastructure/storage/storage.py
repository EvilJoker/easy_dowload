import json
import os

from ...domain.models import TransferTask
from ..crypto.crypto_utils import CryptoUtils


class Storage:
    """本地JSON存储操作接口"""

    def __init__(self, base_dir: str = "."):
        self.base_dir = base_dir
        self.crypto = CryptoUtils()
        self.servers_file = os.path.join(base_dir, "servers.json")
        self.tasks_file = os.path.join(base_dir, "tasks.json")

    def load_servers(self) -> list[dict]:
        try:
            if os.path.exists(self.servers_file):
                with open(self.servers_file, encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        return [r for r in data if isinstance(r, dict)]
            return []
        except Exception:
            return []

    def save_servers(self, servers: list) -> None:
        """保存所有服务器配置，参数为 dict 列表"""
        with open(self.servers_file, "w") as f:
            json.dump(servers, f, indent=2)

    def load_tasks(self) -> list[TransferTask]:
        """加载所有传输任务"""
        if not os.path.exists(self.tasks_file):
            return []

        with open(self.tasks_file) as f:
            data = json.load(f)

        tasks = []
        for item in data:
            tasks.append(
                TransferTask(
                    id=item["id"],
                    file_path=item["file_path"],
                    file_name=item["file_name"],
                    file_size=item["file_size"],
                    server_id=item["server_id"],
                    target_path=item["target_path"],
                    status=item["status"],
                    progress=item["progress"],
                    started_at=item["started_at"],
                    completed_at=item.get("completed_at"),
                )
            )
        return tasks

    def save_tasks_json(self, tasks: list[dict]) -> None:
        """保存任务字典列表"""
        with open(self.tasks_file, "w") as f:
            json.dump(tasks, f, indent=2)

    def save_tasks(self, tasks: list[TransferTask]) -> None:
        """保存所有传输任务"""
        data = []
        for task in tasks:
            data.append(
                {
                    "id": task.id,
                    "file_path": task.file_path,
                    "file_name": task.file_name,
                    "file_size": task.file_size,
                    "server_id": task.server_id,
                    "target_path": task.target_path,
                    "status": task.status,
                    "progress": task.progress,
                    "started_at": task.started_at,
                    "completed_at": task.completed_at,
                }
            )

        with open(self.tasks_file, "w") as f:
            json.dump(data, f, indent=2)
