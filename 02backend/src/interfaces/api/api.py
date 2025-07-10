import datetime
import os
from typing import Any, Union

from flask import Flask, Response, jsonify, request, send_from_directory

from src.application.handlers.error_handler import ErrorHandler
from src.application.services.config_manager import ConfigManager
from src.application.services.history_manager import HistoryManager
from src.application.services.queue_manager import QueueManager
from src.infrastructure.network.sftp_client import SFTPClient


def create_app() -> Flask:
    """创建Flask应用，注册所有RESTful接口"""
    static_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "static")
    )
    app = Flask(__name__, static_folder=static_dir)

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

    @app.route("/upload", methods=["POST"])
    def upload() -> Any:
        import os

        local_path = request.form.get("local_path")
        server_id = request.form.get("server_id")
        target_path = request.form.get("target_path", "/")
        if not local_path or not server_id:
            return jsonify({"error": "缺少参数"}), 400

        # 展开 ~
        local_path = os.path.expanduser(local_path)

        # 查找服务器配置
        server_config = config_manager.get_server_config(server_id)
        if not server_config:
            return jsonify({"error": "服务器配置不存在"}), 404

        sftp_client = SFTPClient(server_config)
        file_name = os.path.basename(local_path)
        remote_path = os.path.join(target_path, file_name)
        success = sftp_client.upload(local_path, remote_path)
        if not success:
            return jsonify({"error": "SFTP上传失败"}), 500
        return jsonify({"success": True})

    @app.route("/progress/<task_id>", methods=["GET"])
    def progress(task_id: str) -> Any:
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
    def list_servers() -> Any:
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
    def create_server() -> Any:
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
            # 优化：返回详细错误信息，并打印日志
            error_detail = result.get("error", "未知错误")
            print(f"[API] 创建服务器失败: {error_detail}")
            return jsonify({"error": error_detail}), 400

    @app.route("/servers/<server_id>", methods=["GET"])
    def get_server(server_id: str) -> Any:
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
    def update_server(server_id: str) -> Any:
        """更新服务器配置"""
        data = request.get_json()
        result = config_manager.update_server_config(server_id, data)
        if result["success"]:
            return jsonify({"success": True})
        else:
            return jsonify({"error": result["error"]}), 400

    @app.route("/servers/<server_id>", methods=["DELETE"])
    def delete_server(server_id: str) -> Any:
        """删除服务器配置"""
        result = config_manager.delete_server_config(server_id)
        if result["success"]:
            return jsonify({"success": True})
        else:
            return jsonify({"error": result["error"]}), 404

    @app.route("/history", methods=["GET"])
    def list_history() -> Any:
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
    def get_history_record(record_id: str) -> Any:
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
    def delete_history_record(record_id: str) -> Any:
        """删除传输历史记录"""
        result = history_manager.delete_history_record(record_id)
        if result["success"]:
            return jsonify({"success": True})
        else:
            return jsonify({"error": result["error"]}), 404

    @app.route("/history/clear", methods=["POST"])
    def clear_history() -> Any:
        """清空传输历史"""
        result = history_manager.clear_history_records(7)  # 清理7天前的记录
        if result["success"]:
            return jsonify({"success": True})
        else:
            return jsonify({"error": result["error"]}), 500

    @app.route("/tasks", methods=["GET"])
    def list_tasks() -> Any:
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
    def get_task(task_id: str) -> Any:
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
    def cancel_task(task_id: str) -> Any:
        """取消任务"""
        result = queue_manager.cancel_task(task_id)
        if result["success"]:
            return jsonify({"success": True})
        else:
            return jsonify({"error": result["error"]}), 404

    @app.route("/queue/status", methods=["GET"])
    def get_queue_status() -> Any:
        """获取队列状态"""
        status = queue_manager.get_queue_status()
        return jsonify(status)

    @app.route("/errors", methods=["GET"])
    def list_errors() -> Any:
        """列出错误记录"""
        errors = error_handler.get_error_statistics()
        return jsonify(errors)

    @app.route("/errors/clear", methods=["POST"])
    def clear_errors() -> Any:
        """清空错误记录"""
        result = error_handler.clear_error_logs(7)  # 清理7天前的错误
        if result["success"]:
            return jsonify({"success": True})
        else:
            return jsonify({"error": result["error"]}), 500

    # 阶段2新增的统计信息API
    @app.route("/statistics", methods=["GET"])
    def get_statistics() -> Any:
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

    @app.route("/demo", methods=["GET"])
    def serve_demo_html() -> Any:
        """提供 demo.html 静态页面（绝对路径，指向 02backend/static/）"""
        static_dir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "static")
        )
        return send_from_directory(static_dir, "demo.html")

    return app
