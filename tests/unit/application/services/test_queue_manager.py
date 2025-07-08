"""
队列管理器单元测试 - 阶段2
"""
import sys
import os
import tempfile
import shutil
import pytest
from datetime import datetime

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../')))

from src.application.services.queue_manager import QueueManager, TaskStatus


class TestQueueManager:
    """队列管理器测试类"""
    
    def setup_method(self):
        """每个测试方法前的设置"""
        # 创建临时目录
        self.temp_dir = tempfile.mkdtemp()
        self.queue_manager = QueueManager(storage_dir=self.temp_dir)
    
    def teardown_method(self):
        """每个测试方法后的清理"""
        # 清理临时目录
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_add_task_success(self):
        """测试成功添加任务"""
        task_data = {
            "file_path": "/path/to/file.txt",
            "file_name": "file.txt",
            "file_size": 1024,
            "server_id": "server123",
            "target_path": "/remote/path/"
        }
        
        result = self.queue_manager.add_task(task_data)
        
        assert result["success"] is True
        assert "task_id" in result
    
    def test_get_task_exists(self):
        """测试获取存在的任务"""
        task_data = {
            "file_path": "/path/to/file.txt",
            "file_name": "file.txt",
            "file_size": 1024,
            "server_id": "server123",
            "target_path": "/remote/path/"
        }
        
        add_result = self.queue_manager.add_task(task_data)
        task_id = add_result["task_id"]
        
        task = self.queue_manager.get_task(task_id)
        assert task is not None
        assert task.file_name == "file.txt"
        assert task.status == TaskStatus.PENDING
    
    def test_get_task_not_found(self):
        """测试获取不存在的任务"""
        task = self.queue_manager.get_task("non-existent-id")
        assert task is None
    
    def test_list_tasks_with_filter(self):
        """测试列出任务列表（带过滤）"""
        # 创建多个任务
        tasks = [
            {
                "file_path": "/path/to/file1.txt",
                "file_name": "file1.txt",
                "file_size": 1024,
                "server_id": "server1",
                "target_path": "/remote/path1/"
            },
            {
                "file_path": "/path/to/file2.txt",
                "file_name": "file2.txt",
                "file_size": 2048,
                "server_id": "server2",
                "target_path": "/remote/path2/"
            }
        ]
        
        for task_data in tasks:
            self.queue_manager.add_task(task_data)
        
        # 列出所有任务
        all_tasks = self.queue_manager.list_tasks()
        assert len(all_tasks) == 2
        
        # 列出待处理任务
        pending_tasks = self.queue_manager.list_tasks(TaskStatus.PENDING)
        assert len(pending_tasks) == 2
    
    def test_cancel_task_success(self):
        """测试成功取消任务"""
        task_data = {
            "file_path": "/path/to/file.txt",
            "file_name": "file.txt",
            "file_size": 1024,
            "server_id": "server123",
            "target_path": "/remote/path/"
        }
        
        add_result = self.queue_manager.add_task(task_data)
        task_id = add_result["task_id"]
        
        result = self.queue_manager.cancel_task(task_id)
        assert result["success"] is True
        
        # 验证取消结果
        cancelled_task = self.queue_manager.get_task(task_id)
        assert cancelled_task.status == TaskStatus.CANCELLED
    
    def test_cancel_task_not_found(self):
        """测试取消不存在的任务"""
        result = self.queue_manager.cancel_task("non-existent-id")
        assert result["success"] is False
        assert "不存在" in result["error"]
    
    def test_get_queue_status(self):
        """测试获取队列状态"""
        # 创建任务
        task_data = {
            "file_path": "/path/to/file.txt",
            "file_name": "file.txt",
            "file_size": 1024,
            "server_id": "server123",
            "target_path": "/remote/path/"
        }
        
        self.queue_manager.add_task(task_data)
        
        status = self.queue_manager.get_queue_status()
        
        assert "total_tasks" in status
        assert "pending_tasks" in status
        assert "running_tasks" in status
        assert "completed_tasks" in status
        assert "failed_tasks" in status
        assert "cancelled_tasks" in status
        assert "max_concurrent" in status
        assert status["total_tasks"] == 1
        assert status["pending_tasks"] == 1
    
    def test_clear_completed_tasks(self):
        """测试清理已完成任务"""
        # 创建任务
        task_data = {
            "file_path": "/path/to/file.txt",
            "file_name": "file.txt",
            "file_size": 1024,
            "server_id": "server123",
            "target_path": "/remote/path/"
        }
        
        add_result = self.queue_manager.add_task(task_data)
        task_id = add_result["task_id"]
        
        # 将任务标记为完成
        self.queue_manager.update_task_status(task_id, TaskStatus.COMPLETED)
        
        # 清理已完成任务
        result = self.queue_manager.clear_completed_tasks()
        assert result["success"] is True
        assert result["deleted_count"] == 1
    
    def test_set_progress_callback(self):
        """测试设置进度回调"""
        task_data = {
            "file_path": "/path/to/file.txt",
            "file_name": "file.txt",
            "file_size": 1024,
            "server_id": "server123",
            "target_path": "/remote/path/"
        }
        
        add_result = self.queue_manager.add_task(task_data)
        task_id = add_result["task_id"]
        
        def progress_callback(task_id: str, progress: float):
            pass
        
        result = self.queue_manager.set_progress_callback(task_id, progress_callback)
        assert result is True 