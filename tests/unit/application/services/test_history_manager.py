"""
历史记录管理器单元测试 - 阶段2
"""

import os
import shutil
import sys
import tempfile

# 添加项目根目录到 Python 路径
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../"))
)

from src.application.services.history_manager import HistoryManager


class TestHistoryManager:
    """历史记录管理器测试类"""

    def setup_method(self):
        """每个测试方法前的设置"""
        # 创建临时目录
        self.temp_dir = tempfile.mkdtemp()
        self.history_manager = HistoryManager(storage_dir=self.temp_dir)

    def teardown_method(self):
        """每个测试方法后的清理"""
        # 清理临时目录
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def test_add_history_record_success(self):
        """测试成功添加历史记录"""
        history_data = {
            "task_id": "task123",
            "file_name": "test.txt",
            "server_name": "Test Server",
            "status": "completed",
            "file_size": 1024,
            "duration": 5.0,
        }

        result = self.history_manager.add_history_record(history_data)

        assert result["success"] is True
        assert "record_id" in result

    def test_get_history_record_exists(self):
        """测试获取存在的历史记录"""
        history_data = {
            "task_id": "task123",
            "file_name": "test.txt",
            "server_name": "Test Server",
            "status": "completed",
            "file_size": 1024,
            "duration": 5.0,
        }

        add_result = self.history_manager.add_history_record(history_data)
        record_id = add_result["record_id"]

        record = self.history_manager.get_history_record(record_id)
        assert record is not None
        assert record.task_id == "task123"
        assert record.file_name == "test.txt"

    def test_get_history_record_not_found(self):
        """测试获取不存在的历史记录"""
        record = self.history_manager.get_history_record("non-existent-id")
        assert record is None

    def test_list_history_records(self):
        """测试列出历史记录"""
        # 创建多个历史记录
        records = [
            {
                "task_id": "task1",
                "file_name": "file1.txt",
                "server_name": "Server 1",
                "status": "completed",
                "file_size": 1024,
                "duration": 5.0,
            },
            {
                "task_id": "task2",
                "file_name": "file2.txt",
                "server_name": "Server 2",
                "status": "failed",
                "file_size": 2048,
                "duration": 10.0,
            },
        ]

        for record_data in records:
            self.history_manager.add_history_record(record_data)

        # 列出所有记录
        records_list = self.history_manager.list_history_records()

        assert len(records_list) == 2
        assert any(record.task_id == "task1" for record in records_list)
        assert any(record.task_id == "task2" for record in records_list)

    def test_delete_history_record_success(self):
        """测试成功删除历史记录"""
        history_data = {
            "task_id": "task123",
            "file_name": "test.txt",
            "server_name": "Test Server",
            "status": "completed",
            "file_size": 1024,
            "duration": 5.0,
        }

        add_result = self.history_manager.add_history_record(history_data)
        record_id = add_result["record_id"]

        result = self.history_manager.delete_history_record(record_id)
        assert result["success"] is True

        # 验证删除结果
        deleted_record = self.history_manager.get_history_record(record_id)
        assert deleted_record is None

    def test_clear_history_records(self):
        """测试清理历史记录"""
        # 创建多个历史记录
        records = [
            {
                "task_id": "task1",
                "file_name": "file1.txt",
                "server_name": "Server 1",
                "status": "completed",
                "file_size": 1024,
                "duration": 5.0,
            },
            {
                "task_id": "task2",
                "file_name": "file2.txt",
                "server_name": "Server 2",
                "status": "failed",
                "file_size": 2048,
                "duration": 10.0,
            },
        ]

        for record_data in records:
            self.history_manager.add_history_record(record_data)

        # 清理所有记录
        result = self.history_manager.clear_history_records(0)

        assert result["success"] is True
        assert result["deleted_count"] == 2

        # 验证清理结果
        remaining_records = self.history_manager.list_history_records()
        assert len(remaining_records) == 0

    def test_get_history_statistics(self):
        """测试获取历史统计信息"""
        # 创建多个历史记录
        records = [
            {
                "task_id": "task1",
                "file_name": "file1.txt",
                "server_name": "Server 1",
                "status": "completed",
                "file_size": 1024,
                "duration": 5.0,
            },
            {
                "task_id": "task2",
                "file_name": "file2.txt",
                "server_name": "Server 2",
                "status": "failed",
                "file_size": 2048,
                "duration": 10.0,
            },
        ]

        for record_data in records:
            self.history_manager.add_history_record(record_data)

        stats = self.history_manager.get_history_statistics()

        assert "total_records" in stats
        assert "total_file_size" in stats
        assert "average_duration" in stats
        assert stats["total_records"] == 2
