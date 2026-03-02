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


def _resolve_database_path():
    """Resolve database path from DATABASE_URL or default to SQLite file.
    
    Supports:
      - DATABASE_URL=sqlite:///path/to/file.db (explicit SQLite)
      - DATABASE_URL=/absolute/path/to/file.db (SQLite file path)
      - No DATABASE_URL: uses default data/fitness.sqlite
    
    Note: PostgreSQL/MySQL support would require SQLAlchemy integration.
    For now, this app uses SQLite only for simplicity and portability.
    """
    db_url = os.environ.get("DATABASE_URL", "").strip()
    
    if not db_url:
        # Default: SQLite in data/ directory
        return Path(__file__).resolve().parent.parent / "data" / "fitness.sqlite"
    
    # Handle sqlite:// URL scheme
    if db_url.startswith("sqlite:///"):
        path = db_url[len("sqlite:///"):]
        return Path(path)
    
    # Handle plain file path
    if db_url.startswith("/") or (len(db_url) > 1 and db_url[1] == ":"):
        return Path(db_url)
    
    # Warn about unsupported DB types but fall back to default
    if db_url.startswith(("postgres://", "postgresql://", "mysql://")):
        import warnings
        warnings.warn(
            f"DATABASE_URL specifies {db_url.split('://')[0]}, but this app only supports SQLite. "
            "Using default SQLite database. For Postgres/MySQL, integrate SQLAlchemy.",
            RuntimeWarning
        )
        return Path(__file__).resolve().parent.parent / "data" / "fitness.sqlite"
    
    # Assume it's a relative path
    return Path(__file__).resolve().parent.parent / db_url


class Config:
    ROOT_DIR = Path(__file__).resolve().parent.parent
    STATIC_DIR = ROOT_DIR / "static"
    DATA_FILE = ROOT_DIR / "fitness_data.json"
    DB_FILE = _resolve_database_path()
    SCHEMA_FILE = ROOT_DIR / "db" / "schema.sql"
    DEFAULT_USER_ID = int(os.environ.get("DEFAULT_USER_ID", "1"))
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
    USDA_API_KEY = os.environ.get("USDA_API_KEY", "DEMO_KEY")
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")  # None if not set — never hardcode real keys

