import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../src')))

import pytest
import tempfile
import os
from src.infrastructure.storage.storage import Storage

class TestStorage:
    """存储模块测试类"""
    
    def setup_method(self):
        """测试前准备"""
        self.temp_dir = tempfile.mkdtemp()
        self.storage = Storage(self.temp_dir)
    
    def teardown_method(self):
        """测试后清理"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_save_and_load_servers(self):
        """测试保存和加载服务器配置"""
        test_servers = [
            {
                "id": "test1",
                "name": "Test Server 1",
                "host": "192.168.1.100",
                "port": 22,
                "protocol": "SFTP",
                "username": "user1",
                "password": "encrypted_password_1",
                "default_path": "/home/user1",
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00"
            },
            {
                "id": "test2", 
                "name": "Test Server 2",
                "host": "192.168.1.101",
                "port": 22,
                "protocol": "SFTP",
                "username": "user2",
                "password": "encrypted_password_2",
                "default_path": "/home/user2",
                "created_at": "2024-01-01T00:00:00",
                "updated_at": "2024-01-01T00:00:00"
            }
        ]
        
        # 保存配置
        self.storage.save_servers(test_servers)
        
        # 加载配置
        loaded_servers = self.storage.load_servers()
        
        assert len(loaded_servers) == 2
        assert loaded_servers[0]["name"] == "Test Server 1"
        assert loaded_servers[1]["name"] == "Test Server 2"
    
    def test_save_and_load_tasks(self):
        """测试保存和加载任务"""
        from src.domain.models import TransferTask
        
        test_tasks = [
            TransferTask(
                id="task1",
                file_path="/tmp/test1.txt",
                file_name="test1.txt",
                file_size=1024,
                server_id="server1",
                target_path="/remote/test1.txt",
                status="completed",
                progress=100.0,
                started_at="2024-01-01T00:00:00",
                completed_at="2024-01-01T00:01:00"
            ),
            TransferTask(
                id="task2",
                file_path="/tmp/test2.txt",
                file_name="test2.txt",
                file_size=2048,
                server_id="server2",
                target_path="/remote/test2.txt",
                status="pending",
                progress=0.0,
                started_at="2024-01-01T00:00:00",
                completed_at=None
            )
        ]
        
        # 保存任务
        self.storage.save_tasks(test_tasks)
        
        # 加载任务
        loaded_tasks = self.storage.load_tasks()
        
        assert len(loaded_tasks) == 2
        assert loaded_tasks[0].file_name == "test1.txt"
        assert loaded_tasks[1].file_name == "test2.txt" 