import os
import sys

sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../src"))
)

import pytest

from src.interfaces.api.api import create_app


class TestAPI:
    """API接口测试类"""

    def setup_method(self):
        """测试前准备"""
        self.app = create_app()
        self.client = self.app.test_client()

    def test_health_check(self):
        """测试健康检查接口"""
        response = self.client.get("/health")
        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert "timestamp" in data

    @pytest.mark.skip(reason="需集成测试或mock依赖")
    def test_servers_get_post(self):
        """测试服务器配置接口（跳过，需要完整集成测试）"""
        pass
