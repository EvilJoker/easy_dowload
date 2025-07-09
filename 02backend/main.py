#!/usr/bin/env python3
"""
Easy Translate Backend Server
后端服务器入口文件
"""

import sys
import os

# 添加当前目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from src.interfaces.api.api import create_app

def main():
    """启动Flask应用"""
    app = create_app()
    app.run(debug=True, host="0.0.0.0", port=5000)

if __name__ == "__main__":
    main() 