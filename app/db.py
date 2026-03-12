"""
FILE: app/db.py

Responsibility:
  Multi-database connection management (SQLite and PostgreSQL).
  Schema initialization, data migration, default user seeding.
  Provides get_db() for request-scoped connections.

MUST NOT:
  - Contain route or business logic
  - Import from api/ or AI modules

Depends on:
  - config.py (DB_CONFIG, SCHEMA_FILE, DEFAULT_USER_ID, DATA_FILE)
  - utils.py (now_iso, safe_int, today_str)
  - db/schema.sql (DDL)
"""

import json
import os
import re
import sqlite3

from flask import current_app, g

from .utils import now_iso, safe_int, today_str

# Try to import psycopg2 for PostgreSQL support (optional)
HAS_PSYCOPG2 = False
PSYCOPG2_IMPORT_ERROR = None
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PSYCOPG2 = True
except Exception as e:
    PSYCOPG2_IMPORT_ERROR = str(e)
    print(f"[DB] psycopg2 import failed: {e}")


class PostgreSQLConnectionWrapper:
    """Wraps psycopg2 connection to provide sqlite3-compatible interface."""
    
    def __init__(self, psycopg2_conn):
        self._conn = psycopg2_conn
        self._cursor = psycopg2_conn.cursor(cursor_factory=RealDictCursor)
        self.lastrowid = None
        self.rowcount = 0
    
    def _convert_sql_placeholders(self, sql):
        """Convert SQLite-specific SQL to PostgreSQL-compatible SQL.

        Handles:
        - ? → %s placeholder conversion (preserves ? inside string literals)
        - INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
        """
        import re

        # Handle INSERT OR IGNORE (SQLite) → INSERT ... ON CONFLICT DO NOTHING (PostgreSQL)
        if re.search(r'\bINSERT\s+OR\s+IGNORE\b', sql, re.IGNORECASE):
            sql = re.sub(r'\bINSERT\s+OR\s+IGNORE\s+INTO\b', 'INSERT INTO', sql, flags=re.IGNORECASE)
            if 'ON CONFLICT' not in sql.upper():
                sql = sql.rstrip().rstrip(';') + ' ON CONFLICT DO NOTHING'

        # Split by quotes to avoid replacing ? inside string literals
        parts = re.split(r"('(?:''|[^'])*')", sql)  # Split on single-quoted strings
        for i in range(0, len(parts), 2):  # Even indices = outside quotes
            parts[i] = parts[i].replace('?', '%s')
        return ''.join(parts)
    
    def execute(self, sql, params=None):
        """Execute SQL and return cursor (supports method chaining).
        
        Automatically converts SQLite placeholders (?) to PostgreSQL (%s).
        """
        # Convert SQLite ? placeholders to PostgreSQL %s
        sql_converted = self._convert_sql_placeholders(sql)
        
        try:
            if params:
                self._cursor.execute(sql_converted, params)
            else:
                self._cursor.execute(sql_converted)
        except psycopg2.Error as e:
            # Log converted SQL for debugging
            raise e
        
        # Capture rowcount from cursor
        self.rowcount = self._cursor.rowcount

        # If INSERT, try to capture lastrowid
        if 'INSERT' in sql.upper() and self.rowcount > 0:
            try:
                if 'RETURNING' in sql.upper():
                    result = self._cursor.fetchone()
                    if result:
                        keys = list(result.keys())
                        self.lastrowid = result.get('id') or (result[keys[0]] if keys else None)
                else:
                    # Use lastval() wrapped in a SAVEPOINT. If no sequence was used
                    # (e.g. sessions table uses TEXT PK), lastval() raises an error.
                    # The SAVEPOINT prevents that error from aborting the outer transaction.
                    self._cursor.execute('SAVEPOINT _get_lastrowid')
                    try:
                        self._cursor.execute('SELECT lastval() AS id')
                        result = self._cursor.fetchone()
                        if result and result.get('id'):
                            self.lastrowid = result['id']
                        self._cursor.execute('RELEASE SAVEPOINT _get_lastrowid')
                    except psycopg2.Error:
                        self._cursor.execute('ROLLBACK TO SAVEPOINT _get_lastrowid')
            except Exception:
                pass  # lastrowid remains None — caller must handle
        
        return self._cursor
    
    def fetchone(self):
        """Fetch one result."""
        return self._cursor.fetchone()
    
    def fetchall(self):
        """Fetch all results."""
        return self._cursor.fetchall()
    
    def commit(self):
        """Commit transaction."""
        self._conn.commit()
    
    def rollback(self):
        """Rollback transaction."""
        self._conn.rollback()
    
    def close(self):
        """Close cursor and connection."""
        self._cursor.close()
        self._conn.close()
    
    def cursor(self, **kwargs):
        """Get a new cursor."""
        return self._conn.cursor(cursor_factory=RealDictCursor, **kwargs)


def _db_config():
    return current_app.config["DB_CONFIG"]


def _db_file():
    config = _db_config()
    if config["type"] == "sqlite":
        return str(config.get("path"))
    return None


def _schema_file():
    return str(current_app.config["SCHEMA_FILE"])


def _data_file():
    return str(current_app.config["DATA_FILE"])


def _default_user_id():
    return current_app.config["DEFAULT_USER_ID"]


def get_db():
    """Get database connection (SQLite or PostgreSQL).
    
    Returns a connection object that works identically for both databases:
    - SQLite: native sqlite3.Connection with row_factory=sqlite3.Row
    - PostgreSQL: Wrapped psycopg2 connection with cursor_factory=RealDictCursor
    
    Both support: conn.execute(sql, params).fetchone()/fetchall()
    """
    if "db" not in g:
        config = _db_config()
        
        if config["type"] == "postgresql":
            if not HAS_PSYCOPG2:
                raise RuntimeError(
                    "PostgreSQL database configured but psycopg2 not installed. "
                    "Run: pip install psycopg2-binary"
                )
            psycopg2_conn = psycopg2.connect(config["url"])
            # Wrap in compatibility layer
            g.db = PostgreSQLConnectionWrapper(psycopg2_conn)
        else:  # SQLite
            db_file = _db_file()
            os.makedirs(os.path.dirname(db_file), exist_ok=True)
            conn = sqlite3.connect(db_file)
            conn.row_factory = sqlite3.Row  # Return rows as Row objects (dict-like)
            conn.execute("PRAGMA foreign_keys = ON")
            g.db = conn
    
    return g.db


def close_db(_error):
    """Close database connection."""
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def register_db(app):
    """Register database teardown handler."""
    app.teardown_appcontext(close_db)


def init_schema(conn):
    """Initialize database schema.

    For SQLite: execute schema script directly via executescript()
    For PostgreSQL: use dedicated PostgreSQL-compatible schema file.
      Detects tables created by a broken SQLite-schema migration (no SERIAL/
      sequences) and drops them so they can be recreated properly.
    """
    config = _db_config()

    if config["type"] == "postgresql":
        pg_schema = os.path.join(os.path.dirname(_schema_file()), "schema_postgres.sql")
        if not os.path.exists(pg_schema):
            raise FileNotFoundError(f"Missing PostgreSQL schema file: {pg_schema}")

        with open(pg_schema, "r", encoding="utf-8") as f:
            schema_sql = f.read()

        raw_conn = conn._conn
        cur = raw_conn.cursor()
        try:
            # Detect broken schema: if users.id has no nextval() default it was
            # created by the old SQLite schema (no SERIAL auto-increment).
            cur.execute("""
                SELECT column_default
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name   = 'users'
                  AND column_name  = 'id'
            """)
            row = cur.fetchone()
            schema_broken = (row is None) or (row[0] is None) or ('nextval' not in str(row[0]))

            if schema_broken:
                print("[DB] Broken/missing schema detected — dropping all tables for clean rebuild...")
                # Drop in reverse-dependency order; CASCADE handles any strays.
                for tbl in [
                    'focus_sessions', 'notes', 'stats_snapshots', 'user_progress',
                    'nutrition_entries', 'project_subtasks', 'tasks', 'workouts',
                    'projects', 'login_attempts', 'sessions', 'users',
                ]:
                    cur.execute(f'DROP TABLE IF EXISTS {tbl} CASCADE')
                raw_conn.commit()
                print("[DB] Dropped broken tables — creating fresh schema")

            cur.execute(schema_sql)
            raw_conn.commit()
            print("[DB] PostgreSQL schema initialized successfully")
        except Exception as e:
            raw_conn.rollback()
            print(f"[DB] Schema error: {e}")
            raise
        finally:
            cur.close()
    else:
        schema_file = _schema_file()
        if not os.path.exists(schema_file):
            raise FileNotFoundError(f"Missing schema file: {schema_file}")

        with open(schema_file, "r", encoding="utf-8") as f:
            schema_sql = f.read()

        conn.executescript(schema_sql)


def ensure_tasks_tags_column(conn):
    """Add missing columns to tasks table if needed."""
    config = _db_config()
    
    if config["type"] == "postgresql":
        # PostgreSQL: check information_schema
        cols = conn.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='tasks'
        """).fetchall()
        names = {row["column_name"] for row in cols}
        
        if "tags_json" not in names:
            conn.execute("ALTER TABLE tasks ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'")
        if "note_content" not in names:
            conn.execute("ALTER TABLE tasks ADD COLUMN note_content TEXT NOT NULL DEFAULT ''")
        if "note_saved_to_notes" not in names:
            conn.execute("ALTER TABLE tasks ADD COLUMN note_saved_to_notes INTEGER NOT NULL DEFAULT 0")
        conn.commit()
    else:
        # SQLite: PRAGMA table_info
        cols = conn.execute("PRAGMA table_info(tasks)").fetchall()
        names = {row["name"] for row in cols}
        
        if "tags_json" not in names:
            conn.execute("ALTER TABLE tasks ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]'")
        if "note_content" not in names:
            conn.execute("ALTER TABLE tasks ADD COLUMN note_content TEXT NOT NULL DEFAULT ''")
        if "note_saved_to_notes" not in names:
            conn.execute("ALTER TABLE tasks ADD COLUMN note_saved_to_notes INTEGER NOT NULL DEFAULT 0")


def ensure_auth_columns(conn):
    """Add missing columns/tables for auth if they don't exist."""
    config = _db_config()
    
    if config["type"] == "postgresql":
        # PostgreSQL: check information_schema
        cols = conn.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='users'
        """).fetchall()
        names = {row["column_name"] for row in cols}
        
        _add_missing = [
            ("password_hash", "TEXT NOT NULL DEFAULT ''"),
            ("level", "TEXT NOT NULL DEFAULT 'Beginner'"),
            ("goal", "TEXT NOT NULL DEFAULT 'General Fitness'"),
            ("weekly_workout_target", "INTEGER NOT NULL DEFAULT 3"),
            ("calorie_goal", "INTEGER NOT NULL DEFAULT 2200"),
            ("age", "INTEGER"),
            ("height", "INTEGER"),
            ("current_weight", "REAL"),
            ("activity_level", "TEXT NOT NULL DEFAULT 'moderate'"),
            ("intro_seen_at", "TEXT"),
            ("demo_completed_at", "TEXT"),
            ("profile_essentials_completed_at", "TEXT"),
        ]
        for col_name, col_def in _add_missing:
            if col_name not in names:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
        conn.commit()
        
        # Create sessions table if it doesn't exist
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
              id TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              expires_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)
        """)
        
        # Create login_attempts table if it doesn't exist
        conn.execute("""
            CREATE TABLE IF NOT EXISTS login_attempts (
              identifier TEXT PRIMARY KEY,
              count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
              first_attempt REAL NOT NULL DEFAULT 0,
              locked_until REAL NOT NULL DEFAULT 0
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_login_attempts_locked_until ON login_attempts(locked_until)
        """)
        conn.commit()
    else:
        # SQLite: PRAGMA table_info
        cols = conn.execute("PRAGMA table_info(users)").fetchall()
        names = {row["name"] for row in cols}
        
        _add_missing = [
            ("password_hash", "TEXT NOT NULL DEFAULT ''"),
            ("level", "TEXT NOT NULL DEFAULT 'Beginner'"),
            ("goal", "TEXT NOT NULL DEFAULT 'General Fitness'"),
            ("weekly_workout_target", "INTEGER NOT NULL DEFAULT 3"),
            ("calorie_goal", "INTEGER NOT NULL DEFAULT 2200"),
            ("age", "INTEGER"),
            ("height", "INTEGER"),
            ("current_weight", "REAL"),
            ("activity_level", "TEXT NOT NULL DEFAULT 'moderate'"),
            ("intro_seen_at", "TEXT"),
            ("demo_completed_at", "TEXT"),
            ("profile_essentials_completed_at", "TEXT"),
        ]
        for col_name, col_def in _add_missing:
            if col_name not in names:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
        
        # Create sessions table if it doesn't exist (SQLite)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
              id TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
              expires_at TEXT NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)")
        
        # Create login_attempts table if it doesn't exist (SQLite)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS login_attempts (
              identifier TEXT PRIMARY KEY,
              count INTEGER NOT NULL DEFAULT 0,
              first_attempt REAL NOT NULL DEFAULT 0,
              locked_until REAL NOT NULL DEFAULT 0
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_login_attempts_locked_until ON login_attempts(locked_until)")


def ensure_default_user(conn):
    """Seed the default user (only during JSON migration)."""
    config = _db_config()
    user_id = _default_user_id()
    email = "local@fittrack.app"
    display_name = "Local User"
    now = now_iso()
    
    if config["type"] == "postgresql":
        # PostgreSQL: use ON CONFLICT DO UPDATE
        conn.execute("""
            INSERT INTO users (id, email, display_name, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
              email=EXCLUDED.email,
              display_name=EXCLUDED.display_name,
              updated_at=EXCLUDED.updated_at
        """, (user_id, email, display_name, now, now))
        conn.commit()
    else:
        # SQLite: use ON CONFLICT
        conn.execute("""
            INSERT INTO users (id, email, display_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              email=excluded.email,
              display_name=excluded.display_name,
              updated_at=excluded.updated_at
        """, (user_id, email, display_name, now, now))


def should_migrate_json(conn):
    """Check if JSON data should be migrated to database."""
    data_file = _data_file()
    if not os.path.exists(data_file):
        return False
    
    force = os.environ.get("FORCE_JSON_MIGRATION", "").strip().lower() in ("1", "true", "yes", "on")
    if force:
        return True
    
    counts = conn.execute("""
        SELECT
          (SELECT COUNT(*) FROM tasks) AS task_count,
          (SELECT COUNT(*) FROM nutrition_entries) AS meal_count,
          (SELECT COUNT(*) FROM workouts) AS workout_count
    """).fetchone()
    
    return (counts["task_count"] or 0) == 0 and (counts["meal_count"] or 0) == 0 and (counts["workout_count"] or 0) == 0


def migrate_json_to_sqlite(conn):
    """Migrate JSON data to database (SQLite or PostgreSQL)."""
    data_file = _data_file()
    if not os.path.exists(data_file):
        return
    
    with open(data_file, "r", encoding="utf-8") as f:
        payload = json.load(f)
    
    config = _db_config()
    user_id = _default_user_id()
    now = now_iso()
    
    try:
        ensure_default_user(conn)
        
        for t in payload.get("tasks", []):
            if not isinstance(t, dict) or not t.get("id") or not t.get("title"):
                continue
            
            priority = t.get("priority", "medium")
            if priority not in ("low", "medium", "high"):
                priority = "medium"
            
            if config["type"] == "postgresql":
                conn.execute("""
                    INSERT INTO tasks
                    (user_id, project_id, title, description, tags_json, category, priority, completed, date, time_spent, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (
                    user_id, None, t.get("title"), t.get("description", ""),
                    json.dumps(t.get("tags", [])), t.get("category", "general"),
                    priority, 1 if t.get("completed") else 0, t.get("date", now_iso()[:10]),
                    safe_int(t.get("time_spent"), 0), now, now
                ))
            else:
                conn.execute("""
                    INSERT INTO tasks
                    (user_id, project_id, title, description, tags_json, category, priority, completed, date, time_spent, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    user_id, None, t.get("title"), t.get("description", ""),
                    json.dumps(t.get("tags", [])), t.get("category", "general"),
                    priority, 1 if t.get("completed") else 0, t.get("date", now_iso()[:10]),
                    safe_int(t.get("time_spent"), 0), now, now
                ))
        
        for m in payload.get("meals", []):
            if not isinstance(m, dict) or not m.get("id") or not m.get("name"):
                continue
            
            if config["type"] == "postgresql":
                conn.execute("""
                    INSERT INTO nutrition_entries
                    (user_id, name, meal_type, calories, protein, carbs, fats, notes, date, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (
                    user_id, m.get("name"), m.get("meal_type", "other"),
                    safe_int(m.get("calories"), 0), safe_int(m.get("protein"), 0),
                    safe_int(m.get("carbs"), 0), safe_int(m.get("fats"), 0),
                    m.get("notes", ""), m.get("date", now_iso()[:10]), now, now
                ))
            else:
                conn.execute("""
                    INSERT INTO nutrition_entries
                    (user_id, name, meal_type, calories, protein, carbs, fats, notes, date, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    user_id, m.get("name"), m.get("meal_type", "other"),
                    safe_int(m.get("calories"), 0), safe_int(m.get("protein"), 0),
                    safe_int(m.get("carbs"), 0), safe_int(m.get("fats"), 0),
                    m.get("notes", ""), m.get("date", now_iso()[:10]), now, now
                ))
        
        for w in payload.get("workouts", []):
            if not isinstance(w, dict) or not w.get("id") or not w.get("name"):
                continue
            
            if config["type"] == "postgresql":
                conn.execute("""
                    INSERT INTO workouts
                    (user_id, name, type, duration, calories_burned, intensity, exercises_json, notes, completed, date, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (
                    user_id, w.get("name"), w.get("type", "other"),
                    safe_int(w.get("duration"), 0), safe_int(w.get("calories_burned"), 0),
                    w.get("intensity", "medium"), json.dumps(w.get("exercises", [])),
                    w.get("notes", ""), 1 if w.get("completed") else 0,
                    w.get("date", now_iso()[:10]), now, now
                ))
            else:
                conn.execute("""
                    INSERT INTO workouts
                    (user_id, name, type, duration, calories_burned, intensity, exercises_json, notes, completed, date, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    user_id, w.get("name"), w.get("type", "other"),
                    safe_int(w.get("duration"), 0), safe_int(w.get("calories_burned"), 0),
                    w.get("intensity", "medium"), json.dumps(w.get("exercises", [])),
                    w.get("notes", ""), 1 if w.get("completed") else 0,
                    w.get("date", now_iso()[:10]), now, now
                ))
        
        if config["type"] == "postgresql":
            conn.commit()
    except Exception as e:
        if config["type"] == "postgresql":
            conn.rollback()
        raise e


def init_app_data(app):
    """Initialize database schema and migrate data if needed.
    
    For PostgreSQL: Connects to external database (assumes migration script was run).
    For SQLite: Initializes schema on first run.
    """
    config = app.config["DB_CONFIG"]
    
    if config["type"] == "postgresql":
        if not HAS_PSYCOPG2:
            raise RuntimeError(
                f"DATABASE_URL is set but psycopg2 is not available. "
                f"Import error: {PSYCOPG2_IMPORT_ERROR}. "
                f"Python version: {os.sys.version}. "
                f"Try: pip install psycopg2-binary"
            )
        
        try:
            psycopg2_conn = psycopg2.connect(config["url"])
            conn = PostgreSQLConnectionWrapper(psycopg2_conn)
            print("[DB] Connected to PostgreSQL successfully")
            
            try:
                with app.app_context():
                    init_schema(conn)
                    ensure_tasks_tags_column(conn)
                    ensure_auth_columns(conn)
                conn.commit()
                print("[DB] PostgreSQL initialization complete")
            finally:
                conn.close()
        except psycopg2.OperationalError as e:
            # Database not ready - normal on fresh Render deployment
            print(f"[DB] PostgreSQL not ready: {e}")
            print("[DB] Run: python migrate_to_postgres.py")
        except Exception as e:
            print(f"[DB] PostgreSQL error during init: {e}")
            import traceback
            traceback.print_exc()
            raise
        return
    
    # SQLite initialization
    try:
        db_file = str(config.get("path"))
        os.makedirs(os.path.dirname(db_file), exist_ok=True)
        conn = sqlite3.connect(db_file)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        
        try:
            with app.app_context():
                init_schema(conn)
                ensure_tasks_tags_column(conn)
                ensure_auth_columns(conn)
                if should_migrate_json(conn):
                    migrate_json_to_sqlite(conn)
        finally:
            conn.close()
    except Exception as e:
        print(f"[DB] Error initializing SQLite: {e}")
        raise e
