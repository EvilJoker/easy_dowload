import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
import pytest
from src.storage import Storage
from src.models import ServerConfig, TransferTask
from typing import List
import uuid
import tempfile

class TestStorage:
    def setup_method(self):
        # 使用临时文件路径，避免污染真实数据
        self.temp_dir = tempfile.TemporaryDirectory()
        self.storage = Storage(base_dir=self.temp_dir.name)

    def teardown_method(self):
        self.temp_dir.cleanup()

    def test_save_and_load_servers(self):
        """保存后能正确加载服务器配置"""
        servers = [ServerConfig(
            id=str(uuid.uuid4()), name='test', host='localhost', port=22, protocol='SFTP',
            username='user', password='pass', default_path='/', created_at='', updated_at='')]
        self.storage.save_servers(servers)
        loaded = self.storage.load_servers()
        assert len(loaded) == 1
        assert loaded[0].name == 'test'

    def test_save_and_load_tasks(self):
        """保存后能正确加载传输任务"""
        tasks = [TransferTask(
            id=str(uuid.uuid4()), file_path='/tmp/a.txt', file_name='a.txt', file_size=123,
            server_id='1', target_path='/srv/', status='pending', progress=0.0, started_at='', completed_at=None)]
        self.storage.save_tasks(tasks)
        loaded = self.storage.load_tasks()
        assert len(loaded) == 1
        assert loaded[0].file_name == 'a.txt' 