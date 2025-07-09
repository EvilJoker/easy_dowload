import os
import tempfile
from typing import Tuple

import requests


class FileDownloader:
    """文件下载与临时文件管理接口"""

    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()

    def download(self, url: str) -> Tuple[str, int]:
        """下载文件到本地临时目录，返回(文件路径, 文件大小)"""
        try:
            response = requests.get(url, stream=True)
            response.raise_for_status()

            # 从URL中提取文件名
            filename = url.split("/")[-1]
            if not filename or "?" in filename:
                filename = "downloaded_file"

            file_path = os.path.join(self.temp_dir, filename)

            with open(file_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            file_size = os.path.getsize(file_path)
            return file_path, file_size

        except Exception as e:
            raise Exception(f"下载失败: {str(e)}")

    def cleanup(self, file_path: str) -> None:
        """删除临时文件"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except Exception as e:
            # 记录错误但不抛出异常，避免影响主流程
            print(f"清理文件失败: {str(e)}")
