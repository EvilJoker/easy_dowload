#!/usr/bin/env python3
"""
API集成测试脚本
测试阶段2的所有API功能
"""
import os
import sys
import tempfile
from unittest.mock import patch

sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../src"))
)

import uuid

from src.interfaces.api.api import create_app


def test_api_integration():
    """API集成测试"""
    # 创建Flask应用
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    # 测试1: 健康检查
    print("Test 1: Health Check")
    response = client.get("/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["status"] == "healthy"
    print("✓ Health check passed")

    # 测试2: 配置管理API
    print("Test 2: Configuration Management API")

    # 创建服务器配置
    server_config = {
        "name": f"Test Server {uuid.uuid4().hex[:8]}",
        "host": "192.168.1.100",
        "port": 22,
        "protocol": "SFTP",
        "username": "testuser",
        "password": "testpass",
        "default_path": "/home/testuser",
    }

    response = client.post("/servers", json=server_config)
    assert response.status_code == 201
    data = response.get_json()
    assert data["success"] is True
    server = data["server"]
    server_id = server["id"]
    # 断言 paths 字段存在且为 list，且第一个元素为 default_path
    assert "paths" in server
    assert isinstance(server["paths"], list)
    assert server["paths"][0]["path"] == server["default_path"]
    print(f"✓ Created server config: {server_id}")

    # 获取服务器配置列表
    response = client.get("/servers")
    assert response.status_code == 200
    servers = response.get_json()
    assert len(servers) >= 1
    for s in servers:
        assert "paths" in s
        assert isinstance(s["paths"], list)
    print(f"✓ Retrieved {len(servers)} server configs")

    # 更新服务器配置
    update_data = {"host": "192.168.1.200"}
    response = client.put(f"/servers/{server_id}", json=update_data)
    assert response.status_code == 200
    print("✓ Updated server config")

    # 测试3: 历史记录API
    print("Test 3: History API")
    response = client.get("/history")
    assert response.status_code == 200
    history = response.get_json()
    print(f"✓ Retrieved {len(history)} history records")

    # 测试4: 队列管理API
    print("Test 4: Queue Management API")
    response = client.get("/tasks")
    assert response.status_code == 200
    tasks = response.get_json()
    print(f"✓ Retrieved {len(tasks)} tasks")

    response = client.get("/queue/status")
    assert response.status_code == 200
    status = response.get_json()
    assert "total_tasks" in status
    print("✓ Retrieved queue status")

    # 测试5: 错误处理API
    print("Test 5: Error Handling API")
    response = client.get("/errors")
    assert response.status_code == 200
    print("✓ Retrieved error statistics")

    # 测试6: 统计信息API
    print("Test 6: Statistics API")
    response = client.get("/statistics")
    assert response.status_code == 200
    stats = response.get_json()
    assert "errors" in stats
    assert "history" in stats
    assert "queue" in stats
    print("✓ Retrieved statistics")

    # 测试7: /upload 接口集成测试
    print("Test 7: Upload API")
    with tempfile.NamedTemporaryFile(delete=False, mode="w+t") as tmpfile:
        tmpfile.write("test upload content\n")
        tmpfile_path = tmpfile.name
    upload_data = {
        "local_path": tmpfile_path,
        "server_id": server_id,
        "target_path": "/home/testuser",
    }
    with patch(
        "src.infrastructure.network.sftp_client.SFTPClient.upload", return_value=True
    ):
        response = client.post("/upload", data=upload_data)
        assert response.status_code == 200
        result = response.get_json()
        assert result.get("success") is True
        # 上传后再次获取服务器，断言 paths[0]['path'] 为 target_path
        response2 = client.get(f"/servers/{server_id}")
        assert response2.status_code == 200
        server2 = response2.get_json()
        assert "paths" in server2
        assert isinstance(server2["paths"], list)
        assert server2["paths"][0]["path"] == upload_data["target_path"]
        print("✓ Upload API passed")
    os.unlink(tmpfile_path)

    # 测试8: 清理测试数据
    print("Test 8: Cleanup Test Data")
    response = client.delete(f"/servers/{server_id}")
    assert response.status_code == 200
    print("✓ Deleted test server config")

    print("\n🎉 All API integration tests passed!")


if __name__ == "__main__":
    test_api_integration()
