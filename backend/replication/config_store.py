import os
import json
from pathlib import Path
from typing import Optional, Dict, Any
from cryptography.fernet import Fernet

ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR
SECRET_FILE = DATA_DIR / "secret.key"
CONFIG_FILE = DATA_DIR / "replica_config.json.enc"


def _ensure_secret_key() -> bytes:
    """Ensure a symmetric key exists for encryption. Persist it locally.
    This avoids storing credentials in plaintext while not changing DB structure.
    """
    # Prefer env var if provided (allows external key management)
    env_key = os.environ.get("REPLICATION_SECRET_KEY")
    if env_key:
        try:
            # Accept base64 Fernet key or raw string to be converted
            key = env_key.encode()
            # Validate key length (Fernet keys are 32 url-safe base64-encoded bytes)
            Fernet(key)  # will raise if invalid
            return key
        except Exception:
            pass

    # Fallback to local key file
    if SECRET_FILE.exists():
        return SECRET_FILE.read_bytes()

    key = Fernet.generate_key()
    SECRET_FILE.write_bytes(key)
    return key


def _get_fernet() -> Fernet:
    return Fernet(_ensure_secret_key())


def save_config(config: Dict[str, Any]) -> None:
    """Encrypt and persist replication configuration.
    Expected keys:
      - mongo_url: str
      - db_name: str
      - username: Optional[str]
      - password: Optional[str]
      - replication_enabled: bool
    """
    f = _get_fernet()
    # Do not persist plaintext password separately; store all in one encrypted blob
    payload = json.dumps(config).encode()
    token = f.encrypt(payload)
    CONFIG_FILE.write_bytes(token)


def load_config() -> Dict[str, Any]:
    """Load and decrypt replication configuration. Returns defaults if missing."""
    defaults = {
        "mongo_url": "",
        "db_name": "",
        "username": None,
        "password": None,
        "replication_enabled": False,
    }
    if not CONFIG_FILE.exists():
        return defaults
    try:
        f = _get_fernet()
        token = CONFIG_FILE.read_bytes()
        data = json.loads(f.decrypt(token).decode())
        # Merge with defaults to avoid KeyError on older versions
        defaults.update({k: data.get(k) for k in defaults.keys()})
        return defaults
    except Exception:
        # If decryption fails, treat as no config
        return defaults


def clear_config() -> None:
    if CONFIG_FILE.exists():
        CONFIG_FILE.unlink()