from flask import Flask, request, jsonify
import uuid
import datetime
from .storage import Storage
from .file_downloader import FileDownloader
from .sftp_client import SFTPClient
from .models import ServerConfig, TransferTask

def create_app() -> Flask:
    """创建Flask应用，注册所有RESTful接口"""
    app = Flask(__name__)
    storage = Storage()
    downloader = FileDownloader()
    
    # 全局任务存储
    tasks = {}

    @app.route('/health', methods=['GET'])
    def health_check():
        """健康检查接口"""
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.datetime.now().isoformat()
        })

    @app.route('/transfer', methods=['POST'])
    def transfer():
        """发起文件传输请求"""
        try:
            data = request.get_json()
            file_url = data.get('file_url')
            server_id = data.get('server_id')
            target_path = data.get('target_path', '/')
            
            if not file_url or not server_id:
                return jsonify({'error': '缺少必要参数'}), 400
            
            # 获取服务器配置
            servers = storage.load_servers()
            server = next((s for s in servers if s.id == server_id), None)
            if not server:
                return jsonify({'error': '服务器配置不存在'}), 404
            
            # 下载文件
            file_path, file_size = downloader.download(file_url)
            
            # 创建传输任务
            task_id = str(uuid.uuid4())
            task = TransferTask(
                id=task_id,
                file_path=file_path,
                file_name=file_path.split('/')[-1],
                file_size=file_size,
                server_id=server_id,
                target_path=target_path,
                status='pending',
                progress=0.0,
                started_at=datetime.datetime.now().isoformat(),
                completed_at=None
            )
            
            tasks[task_id] = task
            
            # 异步执行传输（简化实现）
            def transfer_file():
                try:
                    sftp_client = SFTPClient(server)
                    
                    def progress_callback(progress):
                        tasks[task_id].progress = progress
                    
                    success = sftp_client.upload(file_path, target_path, progress_callback)
                    
                    if success:
                        tasks[task_id].status = 'completed'
                        tasks[task_id].progress = 1.0
                    else:
                        tasks[task_id].status = 'failed'
                    
                    tasks[task_id].completed_at = datetime.datetime.now().isoformat()
                    
                    # 清理临时文件
                    downloader.cleanup(file_path)
                    
                except Exception as e:
                    tasks[task_id].status = 'failed'
                    tasks[task_id].completed_at = datetime.datetime.now().isoformat()
                    downloader.cleanup(file_path)
            
            # 启动传输（简化实现，实际应使用线程池）
            import threading
            thread = threading.Thread(target=transfer_file)
            thread.start()
            
            return jsonify({
                'task_id': task_id,
                'status': 'started'
            })
            
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/progress/<task_id>', methods=['GET'])
    def progress(task_id: str):
        """查询传输进度"""
        task = tasks.get(task_id)
        if not task:
            return jsonify({'error': '任务不存在'}), 404
        
        return jsonify({
            'task_id': task_id,
            'status': task.status,
            'progress': task.progress,
            'file_name': task.file_name,
            'file_size': task.file_size
        })

    @app.route('/servers', methods=['GET', 'POST'])
    def servers():
        """服务器配置管理接口"""
        if request.method == 'GET':
            servers = storage.load_servers()
            return jsonify([{
                'id': s.id,
                'name': s.name,
                'host': s.host,
                'port': s.port,
                'protocol': s.protocol,
                'username': s.username,
                'default_path': s.default_path
            } for s in servers])
        
        elif request.method == 'POST':
            data = request.get_json()
            server = ServerConfig(
                id=str(uuid.uuid4()),
                name=data['name'],
                host=data['host'],
                port=data['port'],
                protocol=data['protocol'],
                username=data['username'],
                password=data['password'],
                default_path=data.get('default_path', '/'),
                created_at=datetime.datetime.now().isoformat(),
                updated_at=datetime.datetime.now().isoformat()
            )
            
            servers = storage.load_servers()
            servers.append(server)
            storage.save_servers(servers)
            
            return jsonify({'id': server.id, 'status': 'created'})

    return app 