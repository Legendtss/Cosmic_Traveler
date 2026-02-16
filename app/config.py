import os
from pathlib import Path


class Config:
    ROOT_DIR = Path(__file__).resolve().parent.parent
    STATIC_DIR = ROOT_DIR / "static"
    DATA_FILE = ROOT_DIR / "fitness_data.json"
    DB_FILE = ROOT_DIR / "data" / "fitness.sqlite"
    SCHEMA_FILE = ROOT_DIR / "db" / "schema.sql"
    DEFAULT_USER_ID = int(os.environ.get("DEFAULT_USER_ID", "1"))

