import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
import pytest
from src.crypto_utils import CryptoUtils

class TestCryptoUtils:
    def setup_method(self):
        self.crypto = CryptoUtils()

    def test_encrypt_decrypt_roundtrip(self):
        """加密后解密应还原原文"""
        plaintext = "hello, world!"
        ciphertext = self.crypto.encrypt(plaintext)
        decrypted = self.crypto.decrypt(ciphertext)
        assert decrypted == plaintext

    def test_encrypt_output_differs_from_plaintext(self):
        """加密结果与原文不同"""
        plaintext = "test1234"
        ciphertext = self.crypto.encrypt(plaintext)
        assert ciphertext != plaintext 