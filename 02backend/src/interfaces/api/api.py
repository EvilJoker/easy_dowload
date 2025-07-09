import datetime
import threading
from typing import Union

from flask import Flask, Response, jsonify, request

from ...application.handlers.error_handler import ErrorHandler
from ...application.services.config_manager import ConfigManager
from ...application.services.history_manager import HistoryManager
from ...application.services.queue_manager import QueueManager, TaskStatus
from ...infrastructure.network.file_downloader import FileDownloader
from ...infrastructure.network.sftp_client import SFTPClient


def create_app() -> Flask:
    """创建Flask应用，注册所有RESTful接口"""
    app = Flask(__name__)
    downloader = FileDownloader()

    # 阶段2核心模块初始化
    config_manager = ConfigManager()
    history_manager = HistoryManager()
    queue_manager = QueueManager()
    error_handler = ErrorHandler()

    @app.route("/health", methods=["GET"])
    def health_check() -> Union[Response, tuple[Response, int]]:
        """健康检查接口"""
        return jsonify(
            {
                "status": "healthy",
                "version": "2.0",
                "timestamp": datetime.datetime.now().isoformat(),
            }
        )

    @app.route("/transfer", methods=["POST"])
    def transfer() -> Union[Response, tuple[Response, int]]:
        """发起文件传输请求 - 阶段2增强"""
        try:
            data = request.get_json()
            file_url = data.get("file_url")
            server_id = data.get("server_id")
            target_path = data.get("target_path", "/")

            if not file_url or not server_id or not isinstance(server_id, str):
                return jsonify({"error": "缺少必要参数"}), 400

            # 确保server_id是str类型
            server_id_str: str = str(server_id)

            # 使用配置管理器获取服务器配置
            server_config = config_manager.get_server_config(server_id_str)
            if not server_config:
                return jsonify({"error": "服务器配置不存在"}), 404

            # 下载文件
            file_path, file_size = downloader.download(file_url)

            # 创建传输任务
            task_data = {
                "file_path": file_path,
                "file_name": file_path.split("/")[-1],
                "file_size": file_size,
                "server_id": server_id_str,
                "target_path": target_path,
            }

            queue_result = queue_manager.add_task(task_data)
            if not queue_result["success"]:
                return jsonify({"error": "队列已满"}), 503

            task_id_raw = queue_result.get("task_id")
            if not isinstance(task_id_raw, str):
                return jsonify({"error": "任务创建失败"}), 500

            task_id: str = task_id_raw

            # 异步执行传输（简化实现）
            def transfer_file() -> None:
                try:
                    sftp_client = SFTPClient(server_config)

                    def progress_callback(progress: float) -> None:
                        queue_manager.update_task_progress(task_id, float(progress))

                    success = sftp_client.upload(
                        file_path, target_path, progress_callback
                    )

                    if success:
                        queue_manager.update_task_status(
                            task_id, TaskStatus.COMPLETED
                        )

                        # 记录到历史
                        history_manager.add_history_record(
                            {
                                "task_id": task_id,
                                "file_name": task_data["file_name"],
                                "server_name": server_config.name,
                                "status": "completed",
                                "file_size": file_size,
                                "duration": 0,  # 简化实现
                            }
                        )
                    else:
                        queue_manager.update_task_status(
                            task_id, TaskStatus.FAILED, "传输失败"
                        )

                        # 记录错误
                        error_handler.handle_error(
                            Exception("传输失败"),
                            {"task_id": task_id, "server_id": server_id_str},
                        )

                    # 清理临时文件
                    downloader.cleanup(file_path)

                except Exception as e:
                    queue_manager.update_task_status(
                        task_id, TaskStatus.FAILED, str(e)
                    )

                    # 记录错误
                    error_handler.handle_error(
                        e, {"task_id": task_id, "server_id": server_id_str}
                    )

                    downloader.cleanup(file_path)

            # 启动传输（简化实现，实际应使用线程池）
            thread = threading.Thread(target=transfer_file)
            thread.start()

            return jsonify({"task_id": task_id, "status": "started"})

        except Exception as e:
            # 记录错误
            error_handler.handle_error(e, {"operation": "transfer", "data": data})
            return jsonify({"error": str(e)}), 500

    @app.route("/progress/<task_id>", methods=["GET"])
    def progress(task_id: str) -> Union[Response, tuple[Response, int]]:
        """查询传输进度 - 阶段2增强"""
        task = queue_manager.get_task(task_id)
        if not task:
            return jsonify({"error": "任务不存在"}), 404

        return jsonify(
            {
                "task_id": task_id,
                "status": (
                    task.status.value
                    if hasattr(task.status, "value")
                    else str(task.status)
                ),
                "progress": task.progress,
                "file_name": task.file_name,
                "file_size": task.file_size,
            }
        )

    # 阶段2新增的配置管理API
    @app.route("/servers", methods=["GET"])
    def list_servers() -> Union[Response, tuple[Response, int]]:
        """列出所有服务器配置"""
        configs = config_manager.list_server_configs()
        # 转换为dict格式返回
        servers = []
        for config in configs:
            servers.append(
                {
                    "id": config.id,
                    "name": config.name,
                    "host": config.host,
                    "port": config.port,
                    "protocol": config.protocol,
                    "username": config.username,
                    "default_path": config.default_path,
                    "created_at": config.created_at,
                    "updated_at": config.updated_at,
                }
            )
        return jsonify(servers)

    @app.route("/servers", methods=["POST"])
    def create_server() -> Union[Response, tuple[Response, int]]:
        """创建服务器配置"""
        data = request.get_json()
        result = config_manager.create_server_config(data)
        if result["success"]:
            # 获取创建的配置详情
            config_id_raw = result.get("config_id")
            if not isinstance(config_id_raw, str):
                return jsonify({"error": "配置创建失败"}), 500

            config_id: str = config_id_raw
            config = config_manager.get_server_config(config_id)
            if config:
                return (
                    jsonify(
                        {
                            "success": True,
                            "server": {
                                "id": config.id,
                                "name": config.name,
                                "host": config.host,
                                "port": config.port,
                                "protocol": config.protocol,
                                "username": config.username,
                                "default_path": config.default_path,
                                "created_at": config.created_at,
                                "updated_at": config.updated_at,
                            },
                        }
                    ),
                    201,
                )
            else:
                return jsonify({"success": True, "config_id": config_id}), 201
        else:
            return jsonify({"error": result["error"]}), 400

    @app.route("/servers/<server_id>", methods=["GET"])
    def get_server(server_id: str) -> Union[Response, tuple[Response, int]]:
        """获取服务器配置"""
        config = config_manager.get_server_config(server_id)
        if config:
            return jsonify(
                {
                    "id": config.id,
                    "name": config.name,
                    "host": config.host,
                    "port": config.port,
                    "protocol": config.protocol,
                    "username": config.username,
                    "default_path": config.default_path,
                    "created_at": config.created_at,
                    "updated_at": config.updated_at,
                }
            )
        else:
            return jsonify({"error": "服务器配置不存在"}), 404

    @app.route("/servers/<server_id>", methods=["PUT"])
    def update_server(server_id: str) -> Union[Response, tuple[Response, int]]:
        """更新服务器配置"""
        data = request.get_json()
        result = config_manager.update_server_config(server_id, data)
        if result["success"]:
            return jsonify({"success": True})
        else:
            return jsonify({"error": result["error"]}), 400

    @app.route("/servers/<server_id>", methods=["DELETE"])
    def delete_server(server_id: str) -> Union[Response, tuple[Response, int]]:
        """删除服务器配置"""
        result = config_manager.delete_server_config(server_id)
        if result["success"]:
            return jsonify({"success": True})
        else:
            return jsonify({"error": result["error"]}), 404

    @app.route("/history", methods=["GET"])
    def list_history() -> Union[Response, tuple[Response, int]]:
        """列出传输历史"""
        records = history_manager.list_history_records()
        # 转换为dict格式返回
        history = []
        for record in records:
            history.append(
                {
                    "id": record.id,
                    "task_id": record.task_id,
                    "file_name": record.file_name,
                    "server_name": record.server_name,
                    "status": record.status,
                    "file_size": record.file_size,
                    "duration": record.duration,
                    "created_at": record.created_at,
                }
            )
        return jsonify(history)

    @app.route("/history/<record_id>", methods=["GET"])
    def get_history_record(record_id: str) -> Union[Response, tuple[Response, int]]:
        """获取传输历史记录"""
        record = history_manager.get_history_record(record_id)
        if record:
            return jsonify(
                {
                    "id": record.id,
                    "task_id": record.task_id,
                    "file_name": record.file_name,
                    "server_name": record.server_name,
                    "status": record.status,
                    "file_size": record.file_size,
                    "duration": record.duration,
                    "created_at": record.created_at,
                }
            )
        else:
            return jsonify({"error": "历史记录不存在"}), 404

    @app.route("/history/<record_id>", methods=["DELETE"])
    def delete_history_record(record_id: str) -> Union[Response, tuple[Response, int]]:
        """删除传输历史记录"""
        result = history_manager.delete_history_record(record_id)
        if result["success"]:
            return jsonify({"success": True})
        else:
            return jsonify({"error": result["error"]}), 404

    @app.route("/history/clear", methods=["POST"])
    def clear_history() -> Union[Response, tuple[Response, int]]:
        """清空传输历史"""
        result = history_manager.clear_history_records(7)  # 清理7天前的记录
        if result["success"]:
            return jsonify({"success": True})
        else:
            return jsonify({"error": result["error"]}), 500

    @app.route("/tasks", methods=["GET"])
    def list_tasks() -> Union[Response, tuple[Response, int]]:
        """列出所有任务"""
        tasks = queue_manager.list_tasks()
        # 转换为dict格式返回
        task_list = []
        for task in tasks:
            task_list.append(
                {
                    "id": task.id,
                    "file_name": task.file_name,
                    "file_size": task.file_size,
                    "status": (
                        task.status.value
                        if hasattr(task.status, "value")
                        else str(task.status)
                    ),
                    "progress": task.progress,
                    "started_at": task.started_at,
                }
            )
        return jsonify(task_list)

    @app.route("/tasks/<task_id>", methods=["GET"])
    def get_task(task_id: str) -> Union[Response, tuple[Response, int]]:
        """获取任务详情"""
        task = queue_manager.get_task(task_id)
        if task:
            return jsonify(
                {
                    "id": task.id,
                    "file_name": task.file_name,
                    "file_size": task.file_size,
                    "status": (
                        task.status.value
                        if hasattr(task.status, "value")
                        else str(task.status)
                    ),
                    "progress": task.progress,
                    "started_at": task.started_at,
                }
            )
        else:
            return jsonify({"error": "任务不存在"}), 404

    @app.route("/tasks/<task_id>/cancel", methods=["POST"])
    def cancel_task(task_id: str) -> Union[Response, tuple[Response, int]]:
        """取消任务"""
        result = queue_manager.cancel_task(task_id)
        if result["success"]:
            return jsonify({"success": True})
        else:
            return jsonify({"error": result["error"]}), 404

    @app.route("/queue/status", methods=["GET"])
    def get_queue_status() -> Union[Response, tuple[Response, int]]:
        """获取队列状态"""
        status = queue_manager.get_queue_status()
        return jsonify(status)

    @app.route("/errors", methods=["GET"])
    def list_errors() -> Union[Response, tuple[Response, int]]:
        """列出错误记录"""
        errors = error_handler.get_error_statistics()
        return jsonify(errors)

    @app.route("/errors/clear", methods=["POST"])
    def clear_errors() -> Union[Response, tuple[Response, int]]:
        """清空错误记录"""
        result = error_handler.clear_error_logs(7)  # 清理7天前的错误
        if result["success"]:
            return jsonify({"success": True})
        else:
            return jsonify({"error": result["error"]}), 500

    # 阶段2新增的统计信息API
    @app.route("/statistics", methods=["GET"])
    def get_statistics() -> Union[Response, tuple[Response, int]]:
        """获取统计信息"""
        # 获取各模块统计信息
        error_stats = error_handler.get_error_statistics()
        history_stats = history_manager.get_history_statistics()
        queue_stats = queue_manager.get_queue_status()

        return jsonify(
            {
                "errors": error_stats,
                "history": history_stats,
                "queue": queue_stats,
                "timestamp": datetime.datetime.now().isoformat(),
            }
        )

    return app
