"""
历史记录管理模块 - 阶段2实现
负责传输历史记录的存储、查询和管理
"""

import json
import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Union


class TransferHistory:
    """传输历史记录数据模型"""

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


class HistoryManager:
    """历史记录管理接口 - 阶段2核心功能"""

    def __init__(self, storage_dir: Optional[str] = None):
        """初始化历史记录管理器
        Args:
            storage_dir: 存储目录，默认为当前目录
        """
        self.storage_dir = storage_dir or "."
        self.history_file = os.path.join(self.storage_dir, "history.json")

    def add_history_record(
        self, history_data: Dict[str, Union[str, int, float]]
    ) -> Dict[str, Union[bool, str, str]]:
        """添加历史记录 - 阶段2核心功能
        Args:
            history_data: 历史记录数据
        Returns:
            添加结果字典
        """
        try:
            # 验证必填字段
            required_fields = [
                "task_id",
                "file_name",
                "server_name",
                "status",
                "file_size",
                "duration",
            ]
            for field in required_fields:
                if field not in history_data:
                    return {"success": False, "error": f"缺少必填字段: {field}"}

            # 创建历史记录
            record_id = str(uuid.uuid4())
            now = datetime.now()

            new_record = {
                "id": record_id,
                "task_id": history_data["task_id"],
                "file_name": history_data["file_name"],
                "server_name": history_data["server_name"],
                "status": history_data["status"],
                "file_size": history_data["file_size"],
                "duration": history_data["duration"],
                "created_at": now.isoformat(),
            }

            # 保存记录
            records = self._load_history_records()
            records.append(new_record)
            self._save_history_records(records)

            return {"success": True, "record_id": record_id}

        except Exception as e:
            return {"success": False, "error": f"添加历史记录失败: {str(e)}"}

    def get_history_record(self, record_id: str) -> Optional[TransferHistory]:
        """获取历史记录 - 阶段2核心功能
        Args:
            record_id: 记录ID
        Returns:
            历史记录对象或None
        """
        try:
            records = self._load_history_records()
            for record in records:
                if record.get("id") == record_id:
                    return TransferHistory(
                        id=record["id"],
                        task_id=record["task_id"],
                        file_name=record["file_name"],
                        server_name=record["server_name"],
                        status=record["status"],
                        file_size=record["file_size"],
                        duration=record["duration"],
                        created_at=record["created_at"],
                    )
            return None

        except Exception:
            return None

    def list_history_records(
        self, limit: int = 50, offset: int = 0
    ) -> List[TransferHistory]:
        """列出历史记录 - 阶段2核心功能
        Args:
            limit: 限制数量
            offset: 偏移量
        Returns:
            历史记录列表
        """
        try:
            records = self._load_history_records()
            result = []

            # 按创建时间倒序排列
            sorted_records = sorted(
                records, key=lambda x: x["created_at"], reverse=True
            )

            # 分页处理
            start_index = offset
            end_index = start_index + limit
            paginated_records = sorted_records[start_index:end_index]

            for record in paginated_records:
                result.append(
                    TransferHistory(
                        id=record["id"],
                        task_id=record["task_id"],
                        file_name=record["file_name"],
                        server_name=record["server_name"],
                        status=record["status"],
                        file_size=record["file_size"],
                        duration=record["duration"],
                        created_at=record["created_at"],
                    )
                )

            return result

        except Exception:
            return []

    def delete_history_record(self, record_id: str) -> Dict[str, Union[bool, str]]:
        """删除历史记录 - 阶段2核心功能
        Args:
            record_id: 记录ID
        Returns:
            删除结果字典
        """
        try:
            records = self._load_history_records()
            record_index = None

            # 查找记录
            for i, record in enumerate(records):
                if record.get("id") == record_id:
                    record_index = i
                    break

            if record_index is None:
                return {"success": False, "error": "记录不存在"}

            # 删除记录
            records.pop(record_index)
            self._save_history_records(records)

            return {"success": True}

        except Exception as e:
            return {"success": False, "error": f"删除记录失败: {str(e)}"}

    def clear_history_records(self, days: int = 30) -> Dict[str, Union[bool, str, int]]:
        """清理历史记录 - 阶段2核心功能
        Args:
            days: 保留天数
        Returns:
            清理结果字典
        """
        try:
            records = self._load_history_records()
            original_count = len(records)

            if days == 0:
                # 清理所有记录
                self._save_history_records([])
                return {"success": True, "deleted_count": original_count}

            cutoff_date = datetime.now().replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            cutoff_date = cutoff_date.replace(day=cutoff_date.day - days)

            filtered_records = []

            for record in records:
                record_date = datetime.fromisoformat(record["created_at"])
                if record_date >= cutoff_date:
                    filtered_records.append(record)

            deleted_count = original_count - len(filtered_records)
            self._save_history_records(filtered_records)

            return {"success": True, "deleted_count": deleted_count}

        except Exception as e:
            return {
                "success": False,
                "error": f"清理记录失败: {str(e)}",
                "deleted_count": 0,
            }

    def get_history_statistics(self) -> Dict[str, Union[int, float]]:
        """获取历史统计信息 - 阶段2核心功能
        Returns:
            统计信息字典
        """
        try:
            records = self._load_history_records()

            total_records = len(records)
            completed_count = 0
            failed_count = 0
            total_file_size = 0
            total_duration = 0.0

            for record in records:
                if record["status"] == "completed":
                    completed_count += 1
                elif record["status"] == "failed":
                    failed_count += 1

                total_file_size += record["file_size"]
                total_duration += record["duration"]

            average_duration = (
                total_duration / total_records if total_records > 0 else 0.0
            )

            return {
                "total_records": total_records,
                "completed_count": completed_count,
                "failed_count": failed_count,
                "total_file_size": total_file_size,
                "average_duration": round(average_duration, 2),
            }

        except Exception:
            return {
                "total_records": 0,
                "completed_count": 0,
                "failed_count": 0,
                "total_file_size": 0,
                "average_duration": 0.0,
            }

    def _load_history_records(self) -> List[Dict]:
        """加载历史记录"""
        try:
            if os.path.exists(self.history_file):
                with open(self.history_file, encoding="utf-8") as f:
                    return json.load(f)
            return []
        except Exception:
            return []

    def _save_history_records(self, records: List[Dict]) -> None:
        """保存历史记录"""
        try:
            # 确保目录存在
            os.makedirs(os.path.dirname(self.history_file), exist_ok=True)
            with open(self.history_file, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
