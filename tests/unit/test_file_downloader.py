import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
import pytest
from src.file_downloader import FileDownloader
import tempfile

class TestFileDownloader:
    def setup_method(self):
        self.downloader = FileDownloader()

    @pytest.mark.skip(reason="需集成测试或mock网络请求")
    def test_download_valid_url(self):
        """有效URL能正确下载文件并返回路径和大小"""
        # 可用requests-mock等工具后续补充
        pass

    def test_cleanup_file(self):
        """删除临时文件后文件不存在"""
        # 创建临时文件
        fd, path = tempfile.mkstemp()
        os.close(fd)
        assert os.path.exists(path)
        self.downloader.cleanup(path)
        assert not os.path.exists(path) 