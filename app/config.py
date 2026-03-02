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


class Config:
    ROOT_DIR = Path(__file__).resolve().parent.parent
    STATIC_DIR = ROOT_DIR / "static"
    DATA_FILE = ROOT_DIR / "fitness_data.json"
    DB_FILE = ROOT_DIR / "data" / "fitness.sqlite"
    SCHEMA_FILE = ROOT_DIR / "db" / "schema.sql"
    DEFAULT_USER_ID = int(os.environ.get("DEFAULT_USER_ID", "1"))
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
    USDA_API_KEY = os.environ.get("USDA_API_KEY", "DEMO_KEY")
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")  # None if not set — never hardcode real keys

