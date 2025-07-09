import os
import sys

sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../src"))
)

import pytest


class TestSFTPClient:
    """SFTP客户端测试类"""

    def test_upload_success(self):
        """测试上传成功（跳过，需要真实SFTP服务器）"""
        pytest.skip("需要真实SFTP服务器，跳过测试")

    def test_upload_progress_callback(self):
        """测试上传进度回调（跳过，需要真实SFTP服务器）"""
        pytest.skip("需要真实SFTP服务器，跳过测试")
