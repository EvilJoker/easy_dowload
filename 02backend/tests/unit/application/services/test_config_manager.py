"""
配置管理器单元测试 - 阶段2
"""

import os
import shutil
import sys
import tempfile

# 添加项目根目录到 Python 路径
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../"))
)

from src.application.services.config_manager import ConfigManager


class TestConfigManager:
    """配置管理器测试类"""

    def setup_method(self):
        """每个测试方法前的设置"""
        # 创建临时目录
        self.temp_dir = tempfile.mkdtemp()
        self.config_manager = ConfigManager(storage_dir=self.temp_dir)

    def teardown_method(self):
        """每个测试方法后的清理"""
        # 清理临时目录
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def test_create_server_config_success(self):
        """测试成功创建服务器配置"""
        config_data = {
            "name": "Test Server",
            "host": "192.168.1.100",
            "port": 22,
            "protocol": "SFTP",
            "username": "testuser",
            "password": "testpass",
            "default_path": "/home/testuser",
        }

        result = self.config_manager.create_server_config(config_data)

        assert result["success"] is True
        assert "config_id" in result

    def test_create_server_config_duplicate_name(self):
        """测试创建重复名称的服务器配置"""
        config_data = {
            "name": "Test Server",
            "host": "192.168.1.100",
            "port": 22,
            "protocol": "SFTP",
            "username": "testuser",
            "password": "testpass",
            "default_path": "/home/testuser",
        }

        # 第一次创建
        result1 = self.config_manager.create_server_config(config_data)
        assert result1["success"] is True

        # 第二次创建相同名称
        result2 = self.config_manager.create_server_config(config_data)
        assert result2["success"] is False
        assert "已存在" in result2["error"]

    def test_create_server_config_invalid_data(self):
        """测试创建无效配置数据"""
        # 缺少必填字段
        config_data = {
            "name": "Test Server",
            "host": "192.168.1.100",
            # 缺少其他必填字段
        }

        result = self.config_manager.create_server_config(config_data)
        assert result["success"] is False
        assert "error" in result

    def test_get_server_config_exists(self):
        """测试获取存在的服务器配置"""
        config_data = {
            "name": "Test Server",
            "host": "192.168.1.100",
            "port": 22,
            "protocol": "SFTP",
            "username": "testuser",
            "password": "testpass",
            "default_path": "/home/testuser",
        }

        create_result = self.config_manager.create_server_config(config_data)
        config_id = create_result["config_id"]

        config = self.config_manager.get_server_config(config_id)
        assert config is not None
        assert config.name == "Test Server"
        assert config.host == "192.168.1.100"

    def test_get_server_config_not_found(self):
        """测试获取不存在的服务器配置"""
        config = self.config_manager.get_server_config("non-existent-id")
        assert config is None

    def test_update_server_config_success(self):
        """测试成功更新服务器配置"""
        # 先创建配置
        config_data = {
            "name": "Test Server",
            "host": "192.168.1.100",
            "port": 22,
            "protocol": "SFTP",
            "username": "testuser",
            "password": "testpass",
            "default_path": "/home/testuser",
        }

        create_result = self.config_manager.create_server_config(config_data)
        config_id = create_result["config_id"]

        # 更新配置
        update_data = {"name": "Updated Server", "host": "192.168.1.101"}

        result = self.config_manager.update_server_config(config_id, update_data)
        assert result["success"] is True

        # 验证更新结果
        updated_config = self.config_manager.get_server_config(config_id)
        assert updated_config.name == "Updated Server"
        assert updated_config.host == "192.168.1.101"

    def test_delete_server_config_success(self):
        """测试成功删除服务器配置"""
        # 先创建配置
        config_data = {
            "name": "Test Server",
            "host": "192.168.1.100",
            "port": 22,
            "protocol": "SFTP",
            "username": "testuser",
            "password": "testpass",
            "default_path": "/home/testuser",
        }

        create_result = self.config_manager.create_server_config(config_data)
        config_id = create_result["config_id"]

        # 删除配置
        result = self.config_manager.delete_server_config(config_id)
        assert result["success"] is True

        # 验证删除结果
        deleted_config = self.config_manager.get_server_config(config_id)
        assert deleted_config is None

    def test_list_server_configs(self):
        """测试列出所有服务器配置"""
        # 创建多个配置
        configs = [
            {
                "name": "Server 1",
                "host": "192.168.1.100",
                "port": 22,
                "protocol": "SFTP",
                "username": "user1",
                "password": "pass1",
                "default_path": "/home/user1",
            },
            {
                "name": "Server 2",
                "host": "192.168.1.101",
                "port": 22,
                "protocol": "SFTP",
                "username": "user2",
                "password": "pass2",
                "default_path": "/home/user2",
            },
        ]

        for config_data in configs:
            self.config_manager.create_server_config(config_data)

        # 列出所有配置
        configs_list = self.config_manager.list_server_configs()

        assert len(configs_list) == 2
        assert any(config.name == "Server 1" for config in configs_list)
        assert any(config.name == "Server 2" for config in configs_list)

    def test_validate_config_valid(self):
        """测试验证有效配置"""
        config_data = {
            "name": "Test Server",
            "host": "192.168.1.100",
            "port": 22,
            "protocol": "SFTP",
            "username": "testuser",
            "password": "testpass",
            "default_path": "/home/testuser",
        }

        result = self.config_manager.validate_config(config_data)
        assert result["valid"] is True

    def test_validate_config_invalid(self):
        """测试验证无效配置"""
        # 缺少必填字段
        config_data = {
            "name": "Test Server",
            "host": "192.168.1.100",
            # 缺少其他必填字段
        }

        result = self.config_manager.validate_config(config_data)
        assert result["valid"] is False
        assert "error" in result
