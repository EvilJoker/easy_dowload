"""
错误处理模块 - 阶段2实现
负责异常处理、重试机制和错误恢复
"""

import json
import logging
import os
import random
import time
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Union

from ...infrastructure.storage.storage import Storage


class ErrorType(Enum):
    """错误类型枚举"""

    NETWORK_ERROR = "network_error"
    AUTHENTICATION_ERROR = "authentication_error"
    FILE_ERROR = "file_error"
    CONFIG_ERROR = "config_error"
    SYSTEM_ERROR = "system_error"


class ErrorInfo:
    """错误信息数据模型"""

    def __init__(
        self,
        error_type: ErrorType,
        error_message: str,
        error_code: str,
        timestamp: datetime,
        context: Dict[str, Any],
    ):
        self.error_type = error_type
        self.error_message = error_message
        self.error_code = error_code
        self.timestamp = timestamp
        self.context = context


class RetryConfig:
    """重试配置"""

    def __init__(
        self,
        max_retries: int = 3,
        retry_delay: float = 1.0,
        backoff_factor: float = 2.0,
    ):
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.backoff_factor = backoff_factor


class ErrorHandler:
    """错误处理接口 - 阶段2核心功能"""

    def __init__(
        self,
        retry_config: Optional[RetryConfig] = None,
        storage_dir: Optional[str] = None,
    ):
        """初始化错误处理器
        Args:
            retry_config: 重试配置
            storage_dir: 存储目录，默认为当前目录
        """
        self.retry_config = retry_config or RetryConfig()
        self.storage_dir = storage_dir or "."
        self.storage = Storage(self.storage_dir)
        self.error_log_file = os.path.join(self.storage_dir, "error_log.json")
        self.errors: List[ErrorInfo] = []

        # 设置日志
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s - %(levelname)s - %(message)s",
            handlers=[
                logging.FileHandler(
                    os.path.join(self.storage_dir, "error_handler.log")
                ),
                logging.StreamHandler(),
            ],
        )
        self.logger = logging.getLogger(__name__)

    def handle_error(self, error: Exception, context: Dict[str, Any]) -> ErrorInfo:
        """处理错误 - 阶段2核心功能
        Args:
            error: 异常对象
            context: 错误上下文
        Returns:
            错误信息对象
        """
        try:
            # 确定错误类型
            error_type = self._classify_error(error)

            # 生成错误代码
            error_code = self._generate_error_code(error_type)

            # 创建错误信息
            error_info = ErrorInfo(
                error_type=error_type,
                error_message=str(error),
                error_code=error_code,
                timestamp=datetime.now(),
                context=context,
            )

            # 记录错误
            self.log_error(error_info)

            return error_info

        except Exception as e:
            # 如果错误处理本身出错，返回系统错误
            return ErrorInfo(
                error_type=ErrorType.SYSTEM_ERROR,
                error_message=f"错误处理失败: {str(e)}",
                error_code="SYS_001",
                timestamp=datetime.now(),
                context=context,
            )

    def retry_operation(
        self, operation: Callable, *args, **kwargs
    ) -> Dict[str, Union[bool, Any, str]]:
        """重试操作 - 阶段2核心功能
        Args:
            operation: 要重试的操作函数
            *args: 操作参数
            **kwargs: 操作关键字参数
        Returns:
            重试结果字典
        """
        last_error = None
        delay = self.retry_config.retry_delay

        for attempt in range(self.retry_config.max_retries + 1):
            try:
                result = operation(*args, **kwargs)
                return {"success": True, "result": result}

            except Exception as e:
                last_error = e

                # 检查是否可重试
                if not self.is_retryable_error(e):
                    return {"success": False, "error": f"不可重试的错误: {str(e)}"}

                # 如果还有重试机会
                if attempt < self.retry_config.max_retries:
                    self.logger.info(
                        f"操作失败，{delay}秒后重试 (尝试 {attempt + 1}/{self.retry_config.max_retries + 1})"
                    )
                    time.sleep(delay)
                    delay *= self.retry_config.backoff_factor
                else:
                    break

        return {"success": False, "error": f"重试次数已达上限: {str(last_error)}"}

    def log_error(self, error_info: ErrorInfo) -> None:
        """记录错误日志 - 阶段2核心功能
        Args:
            error_info: 错误信息
        """
        try:
            # 添加到内存列表
            self.errors.append(error_info)

            # 记录到日志文件
            self.logger.error(
                f"错误类型: {error_info.error_type.value}, "
                f"错误代码: {error_info.error_code}, "
                f"错误信息: {error_info.error_message}, "
                f"上下文: {error_info.context}"
            )

            # 保存到文件
            self._save_errors()

        except Exception as e:
            self.logger.error(f"记录错误日志失败: {str(e)}")

    def get_error_statistics(self) -> Dict[str, Union[int, List[ErrorInfo]]]:
        """获取错误统计 - 阶段2核心功能
        Returns:
            错误统计字典
        """
        try:
            total_errors = len(self.errors)
            error_types = {}
            recent_errors = []

            # 统计错误类型
            for error in self.errors:
                error_type = error.error_type.value
                error_types[error_type] = error_types.get(error_type, 0) + 1

            # 获取最近的错误（最近10个）
            recent_errors = sorted(
                self.errors, key=lambda x: x.timestamp, reverse=True
            )[:10]

            return {
                "total_errors": total_errors,
                "error_types": error_types,
                "recent_errors": recent_errors,
            }

        except Exception:
            return {"total_errors": 0, "error_types": {}, "recent_errors": []}

    def clear_error_logs(self, days: int = 7) -> Dict[str, Union[bool, str, int]]:
        """清理错误日志 - 阶段2核心功能
        Args:
            days: 保留天数，0表示删除所有
        Returns:
            清理结果字典
        """
        try:
            original_count = len(self.errors)

            if days == 0:
                # 删除所有错误
                deleted_count = original_count
                self.errors = []
            else:
                # 删除指定天数之前的错误
                cutoff_date = datetime.now().replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                cutoff_date = cutoff_date.replace(day=cutoff_date.day - days)

                filtered_errors = []
                for error in self.errors:
                    if error.timestamp >= cutoff_date:
                        filtered_errors.append(error)

                deleted_count = original_count - len(filtered_errors)
                self.errors = filtered_errors

            self._save_errors()

            return {"success": True, "deleted_count": deleted_count}

        except Exception as e:
            return {
                "success": False,
                "error": f"清理错误日志失败: {str(e)}",
                "deleted_count": 0,
            }

    def is_retryable_error(self, error: Exception) -> bool:
        """判断是否可重试错误 - 阶段2核心功能
        Args:
            error: 异常对象
        Returns:
            是否可重试
        """
        error_message = str(error).lower()

        # 网络错误（可重试）
        network_keywords = [
            "timeout",
            "connection",
            "network",
            "socket",
            "dns",
            "连接超时",
            "网络错误",
        ]
        if any(keyword in error_message for keyword in network_keywords):
            return True

        # 认证错误（不可重试）
        auth_keywords = [
            "authentication",
            "unauthorized",
            "forbidden",
            "invalid credentials",
            "认证失败",
            "权限不足",
        ]
        if any(keyword in error_message for keyword in auth_keywords):
            return False

        # 文件错误（不可重试）
        file_keywords = [
            "file not found",
            "permission denied",
            "no such file",
            "文件不存在",
            "权限被拒绝",
        ]
        if any(keyword in error_message for keyword in file_keywords):
            return False

        # 配置错误（不可重试）
        config_keywords = [
            "invalid configuration",
            "missing config",
            "config error",
            "配置错误",
            "缺少配置",
        ]
        if any(keyword in error_message for keyword in config_keywords):
            return False

        # 临时错误（可重试）
        temp_keywords = ["临时错误", "持续错误", "temporary", "transient"]
        if any(keyword in error_message for keyword in temp_keywords):
            return True

        # 默认情况下，系统错误不可重试
        return False

    def _classify_error(self, error: Exception) -> ErrorType:
        """分类错误类型"""
        error_message = str(error).lower()

        if any(
            keyword in error_message for keyword in ["timeout", "connection", "network"]
        ):
            return ErrorType.NETWORK_ERROR
        elif any(
            keyword in error_message
            for keyword in ["authentication", "unauthorized", "credentials"]
        ):
            return ErrorType.AUTHENTICATION_ERROR
        elif any(keyword in error_message for keyword in ["file", "path", "directory"]):
            return ErrorType.FILE_ERROR
        elif any(keyword in error_message for keyword in ["config", "configuration"]):
            return ErrorType.CONFIG_ERROR
        else:
            return ErrorType.SYSTEM_ERROR

    def _generate_error_code(self, error_type: ErrorType) -> str:
        """生成错误代码"""
        prefix_map = {
            ErrorType.NETWORK_ERROR: "NET",
            ErrorType.AUTHENTICATION_ERROR: "AUTH",
            ErrorType.FILE_ERROR: "FILE",
            ErrorType.CONFIG_ERROR: "CONFIG",
            ErrorType.SYSTEM_ERROR: "SYS",
        }
        prefix = prefix_map.get(error_type, "UNK")
        return f"{prefix}_{random.randint(100, 999)}"

    def _save_errors(self) -> None:
        """保存错误到文件"""
        try:
            error_list = []
            for error in self.errors:
                error_dict = {
                    "error_type": error.error_type.value,
                    "error_message": error.error_message,
                    "error_code": error.error_code,
                    "timestamp": error.timestamp.isoformat(),
                    "context": error.context,
                }
                error_list.append(error_dict)

            # 确保目录存在
            os.makedirs(os.path.dirname(self.error_log_file), exist_ok=True)
            with open(self.error_log_file, "w", encoding="utf-8") as f:
                json.dump(error_list, f, ensure_ascii=False, indent=2)

        except Exception as e:
            self.logger.error(f"保存错误日志失败: {str(e)}")
