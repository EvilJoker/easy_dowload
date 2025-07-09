import os
import sys

sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../src"))
)


from src.infrastructure.crypto.crypto_utils import CryptoUtils


class TestCryptoUtils:
    """加密工具测试类"""

    def test_encrypt_decrypt_roundtrip(self):
        """测试加密解密往返"""
        crypto = CryptoUtils()
        plaintext = "test_password_123"

        encrypted = crypto.encrypt(plaintext)
        decrypted = crypto.decrypt(encrypted)

        assert decrypted == plaintext
        assert encrypted != plaintext

    def test_encrypt_output_differs_from_plaintext(self):
        """测试加密输出与明文不同"""
        crypto = CryptoUtils()
        plaintext = "test_password_123"

        encrypted = crypto.encrypt(plaintext)

        assert encrypted != plaintext
        assert len(encrypted) > len(plaintext)
