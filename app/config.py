"""
FILE: app/config.py

Responsibility:
  Central configuration. Paths, API keys, default user ID.
  All values can be overridden via environment variables.

MUST NOT:
  - Import from other app modules
  - Contain application logic

Depends on:
  - Environment variables: DATABASE_URL, USDA_API_KEY,
    GEMINI_API_KEY, DEFAULT_USER_ID
"""

import os
from pathlib import Path


def _get_database_config():
    """Resolve database configuration from DATABASE_URL.
    
    Supports:
      - DATABASE_URL=postgresql://... (Render, AWS RDS, etc.)
      - DATABASE_URL=/path/to/file.db (SQLite file path)
      - No DATABASE_URL: uses default data/fitness.sqlite (SQLite)
    
    Returns: dict with 'type' ('postgresql' or 'sqlite') and connection details
    """
    db_url = os.environ.get("DATABASE_URL", "").strip()
    
    if not db_url:
        # Default: SQLite in data/ directory
        return {
            "type": "sqlite",
            "path": Path(__file__).resolve().parent.parent / "data" / "fitness.sqlite"
        }
    
    # Handle postgresql:// or postgres://
    if db_url.startswith(("postgresql://", "postgres://")):
        return {
            "type": "postgresql",
            "url": db_url
        }
    
    # Handle sqlite:// URL scheme
    if db_url.startswith("sqlite:///"):
        path = db_url[len("sqlite:///"):]
        return {
            "type": "sqlite",
            "path": Path(path)
        }
    
    # Handle plain file path (assume SQLite)
    if db_url.startswith("/") or (len(db_url) > 1 and db_url[1] == ":"):
        return {
            "type": "sqlite",
            "path": Path(db_url)
        }
    
    # Assume it's a relative path (SQLite)
    return {
        "type": "sqlite",
        "path": Path(__file__).resolve().parent.parent / db_url
    }


class Config:
    ROOT_DIR = Path(__file__).resolve().parent.parent
    STATIC_DIR = ROOT_DIR / "static"
    DATA_FILE = ROOT_DIR / "fitness_data.json"
    DB_CONFIG = _get_database_config()
    SCHEMA_FILE = ROOT_DIR / "db" / "schema.sql"
    DEFAULT_USER_ID = int(os.environ.get("DEFAULT_USER_ID", "1"))
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
    USDA_API_KEY = os.environ.get("USDA_API_KEY", "DEMO_KEY")
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")  # None if not set — never hardcode real keys
    
    # Legacy: kept for backwards compatibility with old code
    DB_FILE = DB_CONFIG.get("path") if DB_CONFIG["type"] == "sqlite" else None

