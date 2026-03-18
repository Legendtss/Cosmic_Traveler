"""
FILE: app/config.py

Responsibility:
  Central configuration. Paths, API keys, default user ID.
  All values can be overridden via environment variables.

MUST NOT:
  - Import from other app modules
  - Contain application logic

Depends on:
  - Environment variables: DATABASE_URL,
    GEMINI_API_KEY, GEMINI_MODEL, DEFAULT_USER_ID
"""

import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


def _is_truthy_env(value):
    return str(value or "").strip().lower() in ("1", "true", "yes", "on")


def is_production_env(environ=None):
    """Single source of truth for production-environment detection."""
    env = environ or os.environ
    return bool(
        env.get("RENDER")
        or env.get("RAILWAY_ENVIRONMENT")
        or env.get("PRODUCTION")
        or str(env.get("ENVIRONMENT", "")).strip().lower() == "production"
    )


def _get_int_env(name, default, *, minimum=None):
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    if minimum is not None and value < minimum:
        return minimum
    return value


def _is_local_postgres_host(hostname):
    normalized = (hostname or "").strip().lower()
    return normalized in {"", "localhost", "127.0.0.1", "::1"}


def _normalize_postgres_url(db_url):
    parsed = urlparse(db_url)
    if parsed.scheme not in ("postgresql", "postgres"):
        raise ValueError(f"Unsupported PostgreSQL URL scheme: {parsed.scheme or '(empty)'}")
    if not parsed.netloc:
        raise ValueError("Invalid PostgreSQL URL: missing network location/host")
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))

    if "connect_timeout" not in query:
        query["connect_timeout"] = str(_get_int_env("DB_CONNECT_TIMEOUT", 10, minimum=1))
    if "application_name" not in query:
        query["application_name"] = os.environ.get("DB_APPLICATION_NAME", "cosmic_traveler").strip() or "cosmic_traveler"
    if "keepalives" not in query:
        query["keepalives"] = "1"
    if "keepalives_idle" not in query:
        query["keepalives_idle"] = str(_get_int_env("DB_KEEPALIVES_IDLE", 30, minimum=1))
    if "keepalives_interval" not in query:
        query["keepalives_interval"] = str(_get_int_env("DB_KEEPALIVES_INTERVAL", 10, minimum=1))
    if "keepalives_count" not in query:
        query["keepalives_count"] = str(_get_int_env("DB_KEEPALIVES_COUNT", 5, minimum=1))

    if "sslmode" not in query:
        sslmode = os.environ.get("DB_SSLMODE", "").strip()
        if not sslmode:
            sslmode = "disable" if _is_local_postgres_host(parsed.hostname) else "require"
        query["sslmode"] = sslmode

    return urlunparse(parsed._replace(query=urlencode(query)))


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
        pool_minconn = _get_int_env("DB_POOL_MIN_CONN", 1, minimum=1)
        pool_maxconn = _get_int_env("DB_POOL_MAX_CONN", 5, minimum=1)
        if pool_maxconn < pool_minconn:
            pool_maxconn = pool_minconn
        return {
            "type": "postgresql",
            "url": _normalize_postgres_url(db_url),
            "pool_minconn": pool_minconn,
            "pool_maxconn": pool_maxconn,
        }
    
    # Handle sqlite:// URL scheme
    if db_url.startswith("sqlite:///"):
        path = db_url[len("sqlite:///"):]
        return {
            "type": "sqlite",
            "path": Path(path)
        }

    # Reject unknown URL schemes explicitly to avoid silently writing to SQLite.
    if "://" in db_url:
        parsed = urlparse(db_url)
        raise ValueError(f"Unsupported DATABASE_URL scheme: {parsed.scheme or '(empty)'}")
    
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
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")  # None if not set; never hardcode real keys
    GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    
    # Legacy: kept for backwards compatibility with old code
    DB_FILE = DB_CONFIG.get("path") if DB_CONFIG["type"] == "sqlite" else None


def validate_required_paths(config_class=Config):
    """Return a list of missing critical filesystem paths for startup validation."""
    required = {
        "STATIC_DIR": config_class.STATIC_DIR,
        "SCHEMA_FILE": config_class.SCHEMA_FILE,
    }
    return [name for name, path in required.items() if not Path(path).exists()]


def validate_startup_config(config_class=Config, *, environ=None):
    """Return startup validation errors for critical config safety checks."""
    env = environ or os.environ
    errors = []

    if is_production_env(env) and config_class.SECRET_KEY == "dev-secret-change-in-production":
        errors.append("SECRET_KEY must be set in production.")

    missing_paths = validate_required_paths(config_class)
    if missing_paths:
        errors.append(f"Missing required config paths: {', '.join(missing_paths)}")

    db_config = getattr(config_class, "DB_CONFIG", {}) or {}
    db_type = db_config.get("type")
    if db_type not in {"sqlite", "postgresql"}:
        errors.append(f"Unsupported DB_CONFIG.type: {db_type!r}")
    elif db_type == "postgresql":
        if not str(db_config.get("url") or "").strip():
            errors.append("PostgreSQL DB_CONFIG.url must be set.")
        min_conn = db_config.get("pool_minconn")
        max_conn = db_config.get("pool_maxconn")
        if not isinstance(min_conn, int) or min_conn < 1:
            errors.append("DB_POOL_MIN_CONN must be an integer >= 1.")
        if not isinstance(max_conn, int) or max_conn < 1:
            errors.append("DB_POOL_MAX_CONN must be an integer >= 1.")
        elif isinstance(min_conn, int) and max_conn < min_conn:
            errors.append("DB_POOL_MAX_CONN must be >= DB_POOL_MIN_CONN.")

    allow_gemini_fallback = _is_truthy_env(env.get("ALLOW_GEMINI_FALLBACK_IN_PRODUCTION"))
    if is_production_env(env) and not config_class.GEMINI_API_KEY and not allow_gemini_fallback:
        errors.append(
            "GEMINI_API_KEY is required in production unless "
            "ALLOW_GEMINI_FALLBACK_IN_PRODUCTION=1 is explicitly set."
        )

    return errors

