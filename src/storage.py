import json
import os
from typing import List
from .models import ServerConfig, TransferTask
from .crypto_utils import CryptoUtils

class Storage:
    """本地JSON存储操作接口"""
    def __init__(self, base_dir: str = '.'):
        self.base_dir = base_dir
        self.crypto = CryptoUtils()
        self.servers_file = os.path.join(base_dir, 'servers.json')
        self.tasks_file = os.path.join(base_dir, 'tasks.json')

    def load_servers(self) -> List[ServerConfig]:
        """加载所有服务器配置"""
        if not os.path.exists(self.servers_file):
            return []
        
        with open(self.servers_file, 'r') as f:
            data = json.load(f)
        
        servers = []
        for item in data:
            # 解密密码字段
            decrypted_password = self.crypto.decrypt(item['password'])
            servers.append(ServerConfig(
                id=item['id'],
                name=item['name'],
                host=item['host'],
                port=item['port'],
                protocol=item['protocol'],
                username=item['username'],
                password=decrypted_password,
                default_path=item['default_path'],
                created_at=item['created_at'],
                updated_at=item['updated_at']
            ))
        return servers

    def save_servers(self, servers: List[ServerConfig]) -> None:
        """保存所有服务器配置"""
        data = []
        for server in servers:
            # 加密密码字段
            encrypted_password = self.crypto.encrypt(server.password)
            data.append({
                'id': server.id,
                'name': server.name,
                'host': server.host,
                'port': server.port,
                'protocol': server.protocol,
                'username': server.username,
                'password': encrypted_password,
                'default_path': server.default_path,
                'created_at': server.created_at,
                'updated_at': server.updated_at
            })
        
        with open(self.servers_file, 'w') as f:
            json.dump(data, f, indent=2)

    def load_tasks(self) -> List[TransferTask]:
        """加载所有传输任务"""
        if not os.path.exists(self.tasks_file):
            return []
        
        with open(self.tasks_file, 'r') as f:
            data = json.load(f)
        
        tasks = []
        for item in data:
            tasks.append(TransferTask(
                id=item['id'],
                file_path=item['file_path'],
                file_name=item['file_name'],
                file_size=item['file_size'],
                server_id=item['server_id'],
                target_path=item['target_path'],
                status=item['status'],
                progress=item['progress'],
                started_at=item['started_at'],
                completed_at=item.get('completed_at')
            ))
        return tasks

    def save_tasks(self, tasks: List[TransferTask]) -> None:
        """保存所有传输任务"""
        data = []
        for task in tasks:
            data.append({
                'id': task.id,
                'file_path': task.file_path,
                'file_name': task.file_name,
                'file_size': task.file_size,
                'server_id': task.server_id,
                'target_path': task.target_path,
                'status': task.status,
                'progress': task.progress,
                'started_at': task.started_at,
                'completed_at': task.completed_at
            })
        
        with open(self.tasks_file, 'w') as f:
            json.dump(data, f, indent=2) 