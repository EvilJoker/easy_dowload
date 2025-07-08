"""
并发队列管理模块 - 阶段2实现
负责传输任务的队列管理和并发控制
"""
from typing import Dict, List, Optional, Union, Callable
from datetime import datetime
from enum import Enum
import uuid
import threading
import time
import os
from ...infrastructure.storage.storage import Storage


class TaskStatus(Enum):
    """任务状态枚举"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TransferTask:
    """传输任务数据模型"""
    def __init__(self, id: str, file_path: str, file_name: str, file_size: int, 
                 server_id: str, target_path: str, status: TaskStatus, progress: float,
                 started_at: Optional[str], completed_at: Optional[str], error_message: Optional[str]):
        self.id = id
        self.file_path = file_path
        self.file_name = file_name
        self.file_size = file_size
        self.server_id = server_id
        self.target_path = target_path
        self.status = status
        self.progress = progress
        self.started_at = started_at
        self.completed_at = completed_at
        self.error_message = error_message


class QueueManager:
    """并发队列管理接口 - 阶段2核心功能"""
    
    def __init__(self, max_concurrent: int = 3, storage_dir: Optional[str] = None):
        """初始化队列管理器
        Args:
            max_concurrent: 最大并发数
            storage_dir: 存储目录，默认为当前目录
        """
        self.max_concurrent = max_concurrent
        self.storage_dir = storage_dir or "."
        self.storage = Storage(self.storage_dir)
        self.tasks: Dict[str, TransferTask] = {}
        self.progress_callbacks: Dict[str, Callable] = {}
        self.lock = threading.Lock()
        
    def add_task(self, task_data: Dict[str, Union[str, int]]) -> Dict[str, Union[bool, str, str]]:
        """添加传输任务 - 阶段2核心功能
        Args:
            task_data: 任务数据
        Returns:
            添加结果字典
        """
        try:
            # 验证必填字段
            required_fields = ["file_path", "file_name", "file_size", "server_id", "target_path"]
            for field in required_fields:
                if field not in task_data:
                    return {"success": False, "error": f"缺少必填字段: {field}"}
            
            # 创建任务
            task_id = str(uuid.uuid4())
            now = datetime.now()
            
            task = TransferTask(
                id=task_id,
                file_path=task_data["file_path"],
                file_name=task_data["file_name"],
                file_size=task_data["file_size"],
                server_id=task_data["server_id"],
                target_path=task_data["target_path"],
                status=TaskStatus.PENDING,
                progress=0.0,
                started_at=None,
                completed_at=None,
                error_message=None
            )
            
            # 添加到任务列表
            with self.lock:
                self.tasks[task_id] = task
                self._save_tasks()
            
            return {"success": True, "task_id": task_id}
            
        except Exception as e:
            return {"success": False, "error": f"添加任务失败: {str(e)}"}
    
    def get_task(self, task_id: str) -> Optional[TransferTask]:
        """获取任务信息 - 阶段2核心功能
        Args:
            task_id: 任务ID
        Returns:
            任务对象或None
        """
        try:
            with self.lock:
                return self.tasks.get(task_id)
        except Exception:
            return None
    
    def list_tasks(self, status: Optional[TaskStatus] = None) -> List[TransferTask]:
        """列出任务列表 - 阶段2核心功能
        Args:
            status: 任务状态过滤
        Returns:
            任务列表
        """
        try:
            with self.lock:
                if status is None:
                    return list(self.tasks.values())
                else:
                    return [task for task in self.tasks.values() if task.status == status]
        except Exception:
            return []
    
    def cancel_task(self, task_id: str) -> Dict[str, Union[bool, str]]:
        """取消任务 - 阶段2核心功能
        Args:
            task_id: 任务ID
        Returns:
            取消结果字典
        """
        try:
            with self.lock:
                if task_id not in self.tasks:
                    return {"success": False, "error": "任务不存在"}
                
                task = self.tasks[task_id]
                if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                    return {"success": False, "error": "任务已完成，无法取消"}
                
                task.status = TaskStatus.CANCELLED
                task.completed_at = datetime.now().isoformat()
                self._save_tasks()
                
                return {"success": True}
                
        except Exception as e:
            return {"success": False, "error": f"取消任务失败: {str(e)}"}
    
    def get_queue_status(self) -> Dict[str, Union[int, List[str]]]:
        """获取队列状态 - 阶段2核心功能
        Returns:
            队列状态字典
        """
        try:
            with self.lock:
                total_tasks = len(self.tasks)
                pending_tasks = len([t for t in self.tasks.values() if t.status == TaskStatus.PENDING])
                running_tasks = len([t for t in self.tasks.values() if t.status == TaskStatus.RUNNING])
                completed_tasks = len([t for t in self.tasks.values() if t.status == TaskStatus.COMPLETED])
                failed_tasks = len([t for t in self.tasks.values() if t.status == TaskStatus.FAILED])
                cancelled_tasks = len([t for t in self.tasks.values() if t.status == TaskStatus.CANCELLED])
                
                return {
                    "total_tasks": total_tasks,
                    "pending_tasks": pending_tasks,
                    "running_tasks": running_tasks,
                    "completed_tasks": completed_tasks,
                    "failed_tasks": failed_tasks,
                    "cancelled_tasks": cancelled_tasks,
                    "max_concurrent": self.max_concurrent
                }
                
        except Exception:
            return {
                "total_tasks": 0,
                "pending_tasks": 0,
                "running_tasks": 0,
                "completed_tasks": 0,
                "failed_tasks": 0,
                "cancelled_tasks": 0,
                "max_concurrent": self.max_concurrent
            }
    
    def clear_completed_tasks(self) -> Dict[str, Union[bool, str, int]]:
        """清理已完成任务 - 阶段2核心功能
        Returns:
            清理结果字典
        """
        try:
            with self.lock:
                original_count = len(self.tasks)
                completed_statuses = [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]
                
                # 移除已完成的任务
                task_ids_to_remove = []
                for task_id, task in self.tasks.items():
                    if task.status in completed_statuses:
                        task_ids_to_remove.append(task_id)
                
                for task_id in task_ids_to_remove:
                    del self.tasks[task_id]
                    if task_id in self.progress_callbacks:
                        del self.progress_callbacks[task_id]
                
                deleted_count = len(task_ids_to_remove)
                self._save_tasks()
                
                return {"success": True, "deleted_count": deleted_count}
                
        except Exception as e:
            return {"success": False, "error": f"清理任务失败: {str(e)}", "deleted_count": 0}
    
    def set_progress_callback(self, task_id: str, callback: Callable[[str, float], None]) -> bool:
        """设置进度回调 - 阶段2核心功能
        Args:
            task_id: 任务ID
            callback: 进度回调函数
        Returns:
            设置结果
        """
        try:
            with self.lock:
                if task_id not in self.tasks:
                    return False
                
                self.progress_callbacks[task_id] = callback
                return True
                
        except Exception:
            return False
    
    def update_task_progress(self, task_id: str, progress: float) -> bool:
        """更新任务进度 - 内部方法
        Args:
            task_id: 任务ID
            progress: 进度百分比
        Returns:
            更新结果
        """
        try:
            with self.lock:
                if task_id not in self.tasks:
                    return False
                
                task = self.tasks[task_id]
                task.progress = min(100.0, max(0.0, progress))
                
                # 调用进度回调
                if task_id in self.progress_callbacks:
                    try:
                        self.progress_callbacks[task_id](task_id, task.progress)
                    except Exception:
                        pass
                
                return True
                
        except Exception:
            return False
    
    def update_task_status(self, task_id: str, status: TaskStatus, error_message: Optional[str] = None) -> bool:
        """更新任务状态 - 内部方法
        Args:
            task_id: 任务ID
            status: 新状态
            error_message: 错误信息
        Returns:
            更新结果
        """
        try:
            with self.lock:
                if task_id not in self.tasks:
                    return False
                
                task = self.tasks[task_id]
                task.status = status
                
                if status == TaskStatus.RUNNING and task.started_at is None:
                    task.started_at = datetime.now().isoformat()
                elif status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
                    task.completed_at = datetime.now().isoformat()
                
                if error_message:
                    task.error_message = error_message
                
                self._save_tasks()
                return True
                
        except Exception:
            return False
    
    def _save_tasks(self) -> None:
        """保存任务到存储"""
        try:
            task_list = []
            for task in self.tasks.values():
                task_dict = {
                    "id": task.id,
                    "file_path": task.file_path,
                    "file_name": task.file_name,
                    "file_size": task.file_size,
                    "server_id": task.server_id,
                    "target_path": task.target_path,
                    "status": task.status.value,
                    "progress": task.progress,
                    "started_at": task.started_at,
                    "completed_at": task.completed_at,
                    "error_message": task.error_message
                }
                task_list.append(task_dict)
            
            self.storage.save_tasks(task_list)
            
        except Exception:
            pass 