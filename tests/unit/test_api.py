import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
import pytest
from src.api import create_app

class TestAPI:
    @pytest.fixture(autouse=True)
    def setup_app(self):
        self.app = create_app().test_client()

    def test_health_check(self):
        """/health接口返回200和健康状态"""
        resp = self.app.get('/health')
        assert resp.status_code == 200
        # 可根据实现补充健康状态内容断言

    @pytest.mark.skip(reason="需集成测试或mock依赖")
    def test_transfer_post(self):
        """/transfer接口能正确接收参数并返回任务ID"""
        pass

    @pytest.mark.skip(reason="需集成测试或mock依赖")
    def test_progress_get(self):
        """/progress/<task_id>接口能返回进度信息"""
        pass

    @pytest.mark.skip(reason="需集成测试或mock依赖")
    def test_servers_get_post(self):
        """/servers接口能增查服务器配置"""
        pass 