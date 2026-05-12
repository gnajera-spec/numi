import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def encrypt(plaintext: str, key_hex: str) -> str:
    """AES-256-GCM encrypt. key_hex must be 64 hex chars (32 bytes)."""
    key = bytes.fromhex(key_hex)
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, plaintext.encode(), None)
    return base64.b64encode(nonce + ct).decode()


def decrypt(ciphertext_b64: str, key_hex: str) -> str:
    """AES-256-GCM decrypt."""
    key = bytes.fromhex(key_hex)
    data = base64.b64decode(ciphertext_b64)
    nonce, ct = data[:12], data[12:]
    return AESGCM(key).decrypt(nonce, ct, None).decode()
