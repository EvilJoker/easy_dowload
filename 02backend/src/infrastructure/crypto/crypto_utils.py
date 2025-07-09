import base64
import os

from cryptography.fernet import Fernet


class CryptoUtils:
    """AES-256加密解密工具"""

    def __init__(self) -> None:
        """初始化加密工具"""
        self.key = self._load_or_generate_key()

    def _load_or_generate_key(self) -> bytes:
        """获取或创建加密密钥"""
        key_file = "secret.key"
        if os.path.exists(key_file):
            with open(key_file, "rb") as f:
                return f.read()
        else:
            key = Fernet.generate_key()
            with open(key_file, "wb") as f:
                f.write(key)
            return key

    def encrypt(self, plaintext: str) -> str:
        """加密明文"""
        cipher = Fernet(self.key)
        encrypted_data = cipher.encrypt(plaintext.encode())
        return base64.b64encode(encrypted_data).decode()

    def decrypt(self, encrypted_text: str) -> str:
        """解密密文"""
        cipher = Fernet(self.key)
        encrypted_data = base64.b64decode(encrypted_text.encode())
        decrypted_data = cipher.decrypt(encrypted_data)
        return decrypted_data.decode()
