import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../src')))

import pytest
import tempfile
import os
from src.infrastructure.network.file_downloader import FileDownloader

class TestFileDownloader:
    """文件下载器测试类"""
    
    def test_download_valid_url(self):
        """测试下载有效URL（跳过，需要网络连接）"""
        pytest.skip("需要网络连接，跳过测试")
    
    def test_cleanup_file(self):
        """测试清理文件"""
        downloader = FileDownloader()
        
        # 创建临时文件
        temp_file = tempfile.NamedTemporaryFile(delete=False)
        temp_file.write(b"test content")
        temp_file.close()
        
        file_path = temp_file.name
        
        # 验证文件存在
        assert os.path.exists(file_path)
        
        # 清理文件
        downloader.cleanup(file_path)
        
        # 验证文件已被删除
        assert not os.path.exists(file_path) 