import paramiko
import os
from typing import Callable, Optional
from ...domain.models import ServerConfig

class SFTPClient:
    """SFTP文件传输客户端接口"""
    def __init__(self, server_config: ServerConfig):
        """初始化SFTP客户端"""
        self.server_config = server_config
        self.ssh = paramiko.SSHClient()
        self.ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    def upload(self, local_path: str, remote_path: str, progress_callback: Optional[Callable[[float], None]] = None) -> bool:
        """上传文件到服务器，支持进度回调，返回是否成功"""
        try:
            # 连接SFTP服务器
            self.ssh.connect(
                hostname=self.server_config.host,
                port=self.server_config.port,
                username=self.server_config.username,
                password=self.server_config.password,
                timeout=30
            )
            
            sftp = self.ssh.open_sftp()
            
            # 获取本地文件大小
            local_size = os.path.getsize(local_path)
            
            # 上传文件，支持进度回调
            def progress_callback_wrapper(transferred, to_be_transferred):
                if progress_callback and local_size > 0:
                    progress = transferred / local_size
                    progress_callback(progress)
            
            sftp.put(local_path, remote_path, callback=progress_callback_wrapper)
            
            sftp.close()
            self.ssh.close()
            return True
            
        except Exception as e:
            print(f"SFTP上传失败: {str(e)}")
            if hasattr(self, 'ssh'):
                self.ssh.close()
            return False 