"""
错误处理器单元测试 - 阶段2
"""

import os
import shutil
import sys
import tempfile

# 添加项目根目录到 Python 路径
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../"))
)

from src.application.handlers.error_handler import ErrorHandler, ErrorType


class TestErrorHandler:
    """错误处理器测试类"""

    def setup_method(self):
        """每个测试方法前的设置"""
        # 创建临时目录
        self.temp_dir = tempfile.mkdtemp()
        self.error_handler = ErrorHandler(storage_dir=self.temp_dir)

    def teardown_method(self):
        """每个测试方法后的清理"""
        # 清理临时目录
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def test_handle_error_success(self):
        """测试成功处理错误"""
        error = Exception("测试错误")
        context = {"operation": "test", "user_id": "123"}

        error_info = self.error_handler.handle_error(error, context)

        assert error_info.error_message == "测试错误"
        assert error_info.error_type == ErrorType.SYSTEM_ERROR
        assert error_info.context == context

    def test_retry_operation_success(self):
        """测试重试操作成功"""

        def test_operation():
            return "success"

        result = self.error_handler.retry_operation(test_operation)

        assert result["success"] is True
        assert result["result"] == "success"

    def test_retry_operation_max_retries(self):
        """测试重试操作达到最大重试次数"""
        call_count = 0

        def failing_operation():
            nonlocal call_count
            call_count += 1
            raise Exception("网络错误")

        result = self.error_handler.retry_operation(failing_operation)

        assert result["success"] is False
        assert "重试次数已达上限" in result["error"]
        assert call_count == 4  # 初始尝试 + 3次重试

    def test_retry_operation_immediate_success(self):
        """测试重试操作立即成功"""
        call_count = 0

        def operation():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("连接超时")
            return "success"

        result = self.error_handler.retry_operation(operation)

        assert result["success"] is True
        assert result["result"] == "success"
        assert call_count == 2

    def test_log_error_success(self):
        """测试成功记录错误"""
        self.error_handler.handle_error(Exception("测试错误"), {})

        # 验证错误被记录
        stats = self.error_handler.get_error_statistics()
        assert stats["total_errors"] >= 1

    def test_get_error_statistics(self):
        """测试获取错误统计"""
        # 创建多个错误
        errors = [Exception("网络错误"), Exception("认证失败"), Exception("文件不存在")]

        for error in errors:
            self.error_handler.handle_error(error, {})

        stats = self.error_handler.get_error_statistics()

        assert stats["total_errors"] >= 3
        assert "error_types" in stats
        assert "recent_errors" in stats

    def test_clear_error_logs(self):
        """测试清理错误日志"""
        # 创建错误
        self.error_handler.handle_error(Exception("测试错误"), {})

        # 清理所有错误
        result = self.error_handler.clear_error_logs(0)

        assert result["success"] is True
        assert result["deleted_count"] >= 1

    def test_is_retryable_error(self):
        """测试判断是否可重试错误"""
        # 可重试的错误
        retryable_errors = [
            Exception("连接超时"),
            Exception("网络错误"),
            Exception("临时错误"),
            Exception("持续错误"),
        ]

        for error in retryable_errors:
            assert self.error_handler.is_retryable_error(error) is True

        # 不可重试的错误
        non_retryable_errors = [
            Exception("认证失败"),
            Exception("权限不足"),
            Exception("文件不存在"),
            Exception("配置错误"),
        ]

        for error in non_retryable_errors:
            assert self.error_handler.is_retryable_error(error) is False

    def test_retry_operation_with_parameters(self):
        """测试带参数的重试操作"""

        def test_operation(a, b, c=None):
            if c is None:
                raise Exception("连接超时")
            return a + b + c

        # 第一次调用会失败，第二次会成功
        call_count = 0

        def operation_with_retry():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return test_operation(1, 2)
            else:
                return test_operation(1, 2, 3)

        result = self.error_handler.retry_operation(operation_with_retry)

        assert result["success"] is True
        assert result["result"] == 6
