import os
import typing

import paramiko

from ...domain.models import ServerConfig


class SFTPClient:
    """SFTP文件传输客户端接口"""

    def __init__(self, server_config: ServerConfig) -> None:
        """初始化SFTP客户端"""
        self.server_config = server_config
        self.ssh = paramiko.SSHClient()
        self.ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    def upload(
        self,
        local_path: str,
        remote_path: str,
        progress_callback: typing.Optional[typing.Callable[[float], None]] = None,
    ) -> bool:
        """上传文件到服务器，支持进度回调，返回是否成功"""
        try:
            # 打印关键信息
            print(
                f"[SFTP] 本地文件: {local_path} | 远程路径: {remote_path} | 服务器: {self.server_config.host}:{self.server_config.port} | 用户名: {self.server_config.username} | 协议: {self.server_config.protocol}"
            )

            # 连接SFTP服务器
            self.ssh.connect(
                hostname=self.server_config.host,
                port=self.server_config.port,
                username=self.server_config.username,
                password=self.server_config.password,
                timeout=30,
            )

            sftp = self.ssh.open_sftp()

            # 获取本地文件大小
            local_size = os.path.getsize(local_path)

            # 上传文件，支持进度回调
            def progress_callback_wrapper(
                transferred: int, to_be_transferred: int
            ) -> None:
                if progress_callback and local_size > 0:
                    progress = transferred / local_size
                    progress_callback(progress)

            sftp.put(local_path, remote_path, callback=progress_callback_wrapper)

            sftp.close()
            self.ssh.close()
            return True

        except Exception as e:
            print(f"SFTP上传失败: {str(e)}")
            if hasattr(self, "ssh"):
                self.ssh.close()
            return False
