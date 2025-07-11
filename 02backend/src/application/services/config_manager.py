"""
配置管理模块 - 阶段2实现
负责服务器配置的增删改查操作
"""

import uuid
from datetime import datetime
from typing import Any, Optional, Union

from ...domain.models import ServerConfig
from ...infrastructure.crypto.crypto_utils import CryptoUtils
from ...infrastructure.storage.storage import Storage


class ConfigManager:
    """配置管理接口 - 阶段2核心功能"""

    def __init__(self, storage_dir: Optional[str] = None):
        """初始化配置管理器
        Args:
            storage_dir: 存储目录，默认为当前目录
        """
        self.storage_dir = storage_dir or "."
        self.storage = Storage(self.storage_dir)
        self.crypto_utils = CryptoUtils()
        self.config_file = "servers.json"

    def create_server_config(
        self, config_data: dict[str, Union[str, int, list[dict]]]
    ) -> dict[str, Union[bool, str, str]]:
        """创建服务器配置 - 阶段2核心功能
        Args:
            config_data: 服务器配置信息
        Returns:
            创建结果字典
        """
        try:
            # 验证配置数据
            validation_result = self.validate_config(config_data)
            if not validation_result["valid"]:
                return {"success": False, "error": validation_result["error"]}

            # 检查名称是否重复
            existing_configs = self.storage.load_servers()
            for config in existing_configs:
                if config["name"] == config_data["name"]:
                    return {"success": False, "error": "服务器名称已存在"}

            # 创建新配置
            config_id = str(uuid.uuid4())
            now = datetime.now()
            default_path = config_data["default_path"]
            raw_paths: Any = config_data.get("paths", [])
            paths: list[dict] = []
            if isinstance(raw_paths, list):
                paths = [
                    p
                    for p in raw_paths
                    if isinstance(p, dict) and "path" in p and "update" in p
                ]
            # 填充 paths 逻辑
            if not paths or len(paths) == 0:
                paths = [
                    {"path": default_path, "update": now.isoformat(timespec="seconds")}
                ]
            elif len(paths) < 5:
                # 检查 default_path 是否已存在
                if not any(p["path"] == default_path for p in paths):
                    paths.append(
                        {
                            "path": default_path,
                            "update": now.isoformat(timespec="seconds"),
                        }
                    )
            paths = paths[:5]
            new_config = {
                "id": config_id,
                "name": config_data["name"],
                "host": config_data["host"],
                "port": config_data["port"],
                "protocol": config_data["protocol"],
                "username": config_data["username"],
                "password": self.crypto_utils.encrypt(str(config_data["password"])),
                "default_path": default_path,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "paths": paths,
            }

            # 保存配置
            existing_configs.append(new_config)
            self.storage.save_servers(existing_configs)

            return {"success": True, "config_id": config_id}

        except Exception as e:
            return {"success": False, "error": f"创建配置失败: {str(e)}"}

    def get_server_config(self, config_id: str) -> Optional[ServerConfig]:
        """获取服务器配置 - 阶段2核心功能
        Args:
            config_id: 配置ID
        Returns:
            服务器配置对象或None
        """
        try:
            configs = self.storage.load_servers()
            for config in configs:
                if config["id"] == config_id:
                    return ServerConfig(
                        id=config["id"],
                        name=config["name"],
                        host=config["host"],
                        port=config["port"],
                        protocol=config["protocol"],
                        username=config["username"],
                        password=self.crypto_utils.decrypt(config["password"]),
                        default_path=config["default_path"],
                        created_at=config["created_at"],
                        updated_at=config["updated_at"],
                        paths=config.get("paths", []),
                    )
            return None

        except Exception:
            return None

    def update_server_config(
        self, config_id: str, config_data: dict[str, Union[str, int, list[dict]]]
    ) -> dict[str, Union[bool, str]]:
        """更新服务器配置 - 阶段2核心功能
        Args:
            config_id: 配置ID
            config_data: 更新的配置信息
        Returns:
            更新结果字典
        """
        try:
            configs = self.storage.load_servers()
            config_index = None

            # 查找配置
            for i, config in enumerate(configs):
                if config["id"] == config_id:
                    config_index = i
                    break

            if config_index is None:
                return {"success": False, "error": "配置不存在"}

            # 合并原有配置和新数据
            updated_config = configs[config_index].copy()
            for key, value in config_data.items():
                if key == "password":
                    updated_config[key] = self.crypto_utils.encrypt(str(value))
                else:
                    updated_config[key] = value

            updated_config["updated_at"] = datetime.now().isoformat()

            # 校验合并后的配置
            validation_result = self.validate_config(updated_config)
            if not validation_result["valid"]:
                return {"success": False, "error": validation_result["error"]}

            # 检查名称是否重复（排除当前配置）
            for config in configs:
                if (
                    config["id"] != config_id
                    and config["name"] == updated_config["name"]
                ):
                    return {"success": False, "error": "服务器名称已存在"}

            # 修正 paths 逻辑
            default_path = updated_config["default_path"]
            raw_paths: Any = updated_config.get("paths", [])
            paths: list[dict] = []
            if isinstance(raw_paths, list):
                paths = [
                    p
                    for p in raw_paths
                    if isinstance(p, dict) and "path" in p and "update" in p
                ]
            now = datetime.now()
            if not paths or len(paths) == 0:
                paths = [
                    {"path": default_path, "update": now.isoformat(timespec="seconds")}
                ]
            elif len(paths) < 5:
                if not any(p["path"] == default_path for p in paths):
                    paths.append(
                        {
                            "path": default_path,
                            "update": now.isoformat(timespec="seconds"),
                        }
                    )
            paths = paths[:5]
            updated_config["paths"] = paths

            # 更新配置
            configs[config_index] = updated_config

            # 保存配置
            self.storage.save_servers(configs)

            return {"success": True}

        except Exception as e:
            return {"success": False, "error": f"更新配置失败: {str(e)}"}

    def delete_server_config(self, config_id: str) -> dict[str, Union[bool, str]]:
        """删除服务器配置 - 阶段2核心功能
        Args:
            config_id: 配置ID
        Returns:
            删除结果字典
        """
        try:
            configs = self.storage.load_servers()
            config_index = None

            # 查找配置
            for i, config in enumerate(configs):
                if config["id"] == config_id:
                    config_index = i
                    break

            if config_index is None:
                return {"success": False, "error": "配置不存在"}

            # 删除配置
            configs.pop(config_index)
            self.storage.save_servers(configs)

            return {"success": True}

        except Exception as e:
            return {"success": False, "error": f"删除配置失败: {str(e)}"}

    def list_server_configs(self) -> list[ServerConfig]:
        """列出所有服务器配置 - 阶段2核心功能
        Returns:
            服务器配置列表
        """
        try:
            configs = self.storage.load_servers()
            result = []

            for config in configs:
                result.append(
                    ServerConfig(
                        id=config["id"],
                        name=config["name"],
                        host=config["host"],
                        port=config["port"],
                        protocol=config["protocol"],
                        username=config["username"],
                        password=self.crypto_utils.decrypt(config["password"]),
                        default_path=config["default_path"],
                        created_at=config["created_at"],
                        updated_at=config["updated_at"],
                        paths=config.get("paths", []),
                    )
                )

            return result

        except Exception:
            return []

    def update_server_paths(self, config_id: str, new_path: str) -> None:
        configs = self.storage.load_servers()
        for config in configs:
            if config["id"] == config_id:
                now = datetime.now().isoformat(timespec="seconds")
                raw_paths: Any = config.get("paths", [])
                paths: list[dict] = []
                if isinstance(raw_paths, list):
                    paths = [
                        p
                        for p in raw_paths
                        if isinstance(p, dict) and "path" in p and "update" in p
                    ]
                paths = [p for p in paths if p["path"] != new_path]
                paths.insert(0, {"path": new_path, "update": now})
                default_path = config.get("default_path", "/home/uploads/")
                # 补充 default_path 到最后
                if len(paths) < 5 and not any(p["path"] == default_path for p in paths):
                    paths.append({"path": default_path, "update": now})
                config["paths"] = paths[:5]
                self.storage.save_servers(configs)
                break

    def validate_config(
        self, config_data: dict[str, Union[str, int, list[dict]]]
    ) -> dict[str, Union[bool, str]]:
        """验证配置数据 - 阶段2核心功能
        Args:
            config_data: 配置数据
        Returns:
            验证结果字典
        """
        try:
            required_fields = [
                "name",
                "host",
                "port",
                "protocol",
                "username",
                "password",
                "default_path",
            ]
            for field in required_fields:
                if field not in config_data or not config_data[field]:
                    return {"valid": False, "error": f"验证失败: 字段 {field} 不能为空"}

            port = config_data["port"]
            if not isinstance(port, int) or port < 1 or port > 65535:
                return {"valid": False, "error": "验证失败: 端口号必须在1-65535之间"}

            protocol = config_data["protocol"]
            if protocol not in ["SFTP", "FTP", "SCP"]:
                return {
                    "valid": False,
                    "error": "验证失败: 协议必须是 SFTP、FTP 或 SCP",
                }

            host = str(config_data["host"])
            if not host or len(host.strip()) == 0:
                return {"valid": False, "error": "验证失败: 主机地址不能为空"}

            return {"valid": True}

        except Exception as e:
            return {"valid": False, "error": f"验证失败: {str(e)}"}
