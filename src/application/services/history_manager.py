"""
历史记录管理模块 - 阶段2实现
负责传输历史记录的存储、查询和管理
"""

import json
import os
import uuid
from datetime import datetime
from typing import Optional, Union

from ...domain.models import TransferHistory


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
        self, history_data: dict[str, Union[str, int, float]]
    ) -> dict[str, Union[bool, str, str]]:
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
                    # 确保类型安全
                    return TransferHistory(
                        id=str(record["id"]),
                        task_id=str(record["task_id"]),
                        file_name=str(record["file_name"]),
                        server_name=str(record["server_name"]),
                        status=str(record["status"]),
                        file_size=int(record["file_size"]),
                        duration=float(record["duration"]),
                        created_at=str(record["created_at"]),
                    )
            return None
        except Exception:
            return None

    def list_history_records(
        self, limit: int = 50, offset: int = 0
    ) -> list[TransferHistory]:
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
            sorted_records = sorted(
                records, key=lambda x: str(x["created_at"]), reverse=True
            )
            start_index = offset
            end_index = start_index + limit
            paginated_records = sorted_records[start_index:end_index]
            for record in paginated_records:
                result.append(
                    TransferHistory(
                        id=str(record["id"]),
                        task_id=str(record["task_id"]),
                        file_name=str(record["file_name"]),
                        server_name=str(record["server_name"]),
                        status=str(record["status"]),
                        file_size=int(record["file_size"]),
                        duration=float(record["duration"]),
                        created_at=str(record["created_at"]),
                    )
                )
            return result
        except Exception:
            return []

    def delete_history_record(self, record_id: str) -> dict[str, Union[bool, str]]:
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

    def clear_history_records(self, days: int = 30) -> dict[str, Union[bool, str, int]]:
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
                try:
                    record_date = datetime.fromisoformat(str(record["created_at"]))
                    if record_date >= cutoff_date:
                        filtered_records.append(record)
                except Exception:
                    # 如果日期解析失败，跳过该记录
                    pass

            deleted_count = original_count - len(filtered_records)
            self._save_history_records(filtered_records)

            return {"success": True, "deleted_count": deleted_count}

        except Exception as e:
            return {
                "success": False,
                "error": f"清理记录失败: {str(e)}",
                "deleted_count": 0,
            }

    def get_history_statistics(self) -> dict[str, Union[int, float]]:
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
                if str(record["status"]) == "completed":
                    completed_count += 1
                elif str(record["status"]) == "failed":
                    failed_count += 1
                # 类型安全累加
                try:
                    total_file_size += int(record["file_size"])
                except Exception:
                    pass
                try:
                    total_duration += float(record["duration"])
                except Exception:
                    pass
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

    def _load_history_records(self) -> list[dict[str, Union[str, int, float]]]:
        """加载历史记录"""
        try:
            if os.path.exists(self.history_file):
                with open(self.history_file, encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        # 确保每个元素都是 dict
                        return [
                            r for r in data if isinstance(r, dict)
                        ]
            return []
        except Exception:
            return []

    def _save_history_records(self, records: list[dict[str, Union[str, int, float]]]) -> None:
        """保存历史记录"""
        try:
            # 确保目录存在
            os.makedirs(os.path.dirname(self.history_file), exist_ok=True)
            with open(self.history_file, "w", encoding="utf-8") as f:
                json.dump(records, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
