import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
import pytest
from src.sftp_client import SFTPClient
from src.models import ServerConfig

class TestSFTPClient:
    def setup_method(self):
        # 可用mock ServerConfig
        self.server_config = ServerConfig(
            id='1', name='test', host='localhost', port=22, protocol='SFTP',
            username='user', password='pass', default_path='/', created_at='', updated_at='')
        self.client = SFTPClient(self.server_config)

    @pytest.mark.skip(reason="需集成测试或mock SFTP服务器")
    def test_upload_success(self):
        """能成功上传文件到SFTP服务器"""
        pass

    @pytest.mark.skip(reason="需集成测试或mock SFTP服务器")
    def test_upload_progress_callback(self):
        """上传时进度回调被正确调用"""
        pass 