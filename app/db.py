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
import threading

from flask import current_app, g

from .utils import now_iso, safe_int, today_str

# Try to import psycopg2 for PostgreSQL support (optional)
HAS_PSYCOPG2 = False
PSYCOPG2_IMPORT_ERROR = None
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from psycopg2.pool import ThreadedConnectionPool
    HAS_PSYCOPG2 = True
except Exception as e:
    PSYCOPG2_IMPORT_ERROR = str(e)
    print(f"[DB] psycopg2 import failed: {e}")


_POSTGRES_POOL_KEY = "postgres_db_pool"
_POSTGRES_POOL_LOCK = threading.Lock()


class PostgreSQLConnectionWrapper:
    """Wraps psycopg2 connection to provide sqlite3-compatible interface."""

    # Tables whose primary key is a SERIAL sequence (auto-increment integer).
    # For these, execute() appends RETURNING id so .lastrowid is populated.
    # Sessions and login_attempts use TEXT PKs — they are intentionally absent.
    _SERIAL_TABLES = frozenset({
        'users', 'projects', 'tasks', 'project_subtasks', 'workouts',
        'nutrition_entries', 'stats_snapshots', 'user_progress',
        'focus_sessions', 'notes',
    })

    def __init__(self, psycopg2_conn, *, release_callback=None):
        self._conn = psycopg2_conn
        self._cursor = psycopg2_conn.cursor(cursor_factory=RealDictCursor)
        self._release_callback = release_callback
        self._closed = False
        self.lastrowid = None
        self.rowcount = 0

    def _convert_sql_placeholders(self, sql):
        """Convert SQLite-specific SQL to PostgreSQL-compatible SQL.

        Handles:
        - ? → %s placeholder conversion (preserves ? inside string literals)
        - INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING
        """
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
        """Execute SQL and return self (the wrapper).

        Returning self (not the raw cursor) means callers can access
        .lastrowid and .rowcount correctly, while .fetchone()/.fetchall()
        still delegate through to the underlying psycopg2 cursor.

        For INSERT on SERIAL tables, appends RETURNING id automatically so
        that .lastrowid is populated without any SAVEPOINT/lastval hacks.
        """
        sql_converted = self._convert_sql_placeholders(sql)

        # Append RETURNING id for INSERTs on SERIAL tables (no-op if already present)
        added_returning = False
        if re.search(r'\bINSERT\b', sql_converted, re.IGNORECASE) and 'RETURNING' not in sql_converted.upper():
            tbl_match = re.search(r'\bINTO\s+(\w+)\b', sql_converted, re.IGNORECASE)
            if tbl_match and tbl_match.group(1).lower() in self._SERIAL_TABLES:
                sql_converted = sql_converted.rstrip().rstrip(';') + ' RETURNING id'
                added_returning = True

        if params:
            self._cursor.execute(sql_converted, params)
        else:
            self._cursor.execute(sql_converted)

        self.rowcount = self._cursor.rowcount

        if added_returning and self.rowcount > 0:
            result = self._cursor.fetchone()
            if result:
                self.lastrowid = result.get('id')

        return self  # ← return the wrapper so .lastrowid/.rowcount are accessible

    def fetchone(self):
        """Fetch one result."""
        return self._cursor.fetchone()

    def fetchall(self):
        """Fetch all results."""
        return self._cursor.fetchall()

    def __iter__(self):
        """Allow direct iteration over query results."""
        return iter(self._cursor)

    def commit(self):
        """Commit transaction."""
        self._conn.commit()

    def rollback(self):
        """Rollback transaction."""
        self._conn.rollback()

    def close(self):
        """Close cursor and connection."""
        if self._closed:
            return

        self._closed = True
        try:
            self._cursor.close()
        except Exception:
            pass

        if self._release_callback is not None:
            self._release_callback(self._conn)
        else:
            self._conn.close()

    def cursor(self, **kwargs):
        """Get a new raw psycopg2 cursor (used by init_schema)."""
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


def _create_postgres_pool(config):
    return ThreadedConnectionPool(
        config.get("pool_minconn", 1),
        config.get("pool_maxconn", 5),
        config["url"],
    )


def _get_postgres_pool_for_app(app):
    pool = app.extensions.get(_POSTGRES_POOL_KEY)
    if pool is not None:
        return pool

    with _POSTGRES_POOL_LOCK:
        pool = app.extensions.get(_POSTGRES_POOL_KEY)
        if pool is None:
            pool = _create_postgres_pool(app.config["DB_CONFIG"])
            app.extensions[_POSTGRES_POOL_KEY] = pool
    return pool


def _get_postgres_pool():
    return _get_postgres_pool_for_app(current_app._get_current_object())


def _return_postgres_connection(pool, conn):
    if conn is None:
        return

    close_connection = bool(getattr(conn, "closed", 0))
    if not close_connection:
        try:
            conn.rollback()
        except Exception:
            close_connection = True

    try:
        pool.putconn(conn, close=close_connection)
    except Exception:
        try:
            conn.close()
        except Exception:
            pass


def _checkout_postgres_connection(pool):
    raw_conn = pool.getconn()
    return PostgreSQLConnectionWrapper(
        raw_conn,
        release_callback=lambda psycopg2_conn: _return_postgres_connection(pool, psycopg2_conn),
    )


def get_db():
    """Get database connection (SQLite or PostgreSQL).
    
    Returns a connection object that works identically for both databases:
    - SQLite: native sqlite3.Connection with row_factory=sqlite3.Row
    - PostgreSQL: pooled psycopg2 connection wrapped with cursor_factory=RealDictCursor
    
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
            g.db = _checkout_postgres_connection(_get_postgres_pool())
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
                    'nutrition_entries', 'project_subtasks', 'tasks', 'workout_templates', 'workouts',
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


def ensure_tasks_recurrence_columns(conn):
    """Add recurrence columns/indexes for tasks if needed."""
    config = _db_config()

    if config["type"] == "postgresql":
        cols = conn.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='tasks'
        """).fetchall()
        names = {row["column_name"] for row in cols}

        if "recurrence" not in names:
            conn.execute("ALTER TABLE tasks ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none'")
        if "recurrence_parent_id" not in names:
            conn.execute("ALTER TABLE tasks ADD COLUMN recurrence_parent_id INTEGER")

        conn.execute(
            "UPDATE tasks SET recurrence = 'none' WHERE recurrence IS NULL OR recurrence NOT IN ('none','daily','weekly','weekdays')"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON tasks(user_id, recurrence, date)"
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recurrence_instance ON tasks(user_id, recurrence_parent_id, date)"
        )

        conn.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_recurrence_check'
                ) THEN
                    ALTER TABLE tasks
                    ADD CONSTRAINT tasks_recurrence_check
                    CHECK (recurrence IN ('none','daily','weekly','weekdays'));
                END IF;
            END $$;
        """)
        conn.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_recurrence_parent_fk'
                ) THEN
                    ALTER TABLE tasks
                    ADD CONSTRAINT tasks_recurrence_parent_fk
                    FOREIGN KEY (recurrence_parent_id)
                    REFERENCES tasks(id)
                    ON DELETE CASCADE;
                END IF;
            END $$;
        """)
    else:
        cols = conn.execute("PRAGMA table_info(tasks)").fetchall()
        names = {row["name"] for row in cols}

        if "recurrence" not in names:
            conn.execute("ALTER TABLE tasks ADD COLUMN recurrence TEXT NOT NULL DEFAULT 'none'")
        if "recurrence_parent_id" not in names:
            conn.execute("ALTER TABLE tasks ADD COLUMN recurrence_parent_id INTEGER")

        conn.execute(
            "UPDATE tasks SET recurrence = 'none' WHERE recurrence IS NULL OR recurrence NOT IN ('none','daily','weekly','weekdays')"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tasks_recurrence ON tasks(user_id, recurrence, date)"
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recurrence_instance ON tasks(user_id, recurrence_parent_id, date)"
        )


def ensure_workout_templates_table(conn):
    """Create workout_templates table and index if missing."""
    config = _db_config()

    if config["type"] == "postgresql":
        conn.execute("""
            CREATE TABLE IF NOT EXISTS workout_templates (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              name TEXT NOT NULL,
              type TEXT NOT NULL DEFAULT 'other',
              duration INTEGER NOT NULL DEFAULT 0 CHECK (duration >= 0),
              calories_burned INTEGER NOT NULL DEFAULT 0 CHECK (calories_burned >= 0),
              intensity TEXT NOT NULL DEFAULT 'medium' CHECK (intensity IN ('low','medium','high')),
              exercises_json TEXT NOT NULL DEFAULT '[]',
              notes TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
    else:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS workout_templates (
              id INTEGER PRIMARY KEY,
              user_id INTEGER NOT NULL,
              name TEXT NOT NULL,
              type TEXT NOT NULL DEFAULT 'other',
              duration INTEGER NOT NULL DEFAULT 0 CHECK (duration >= 0),
              calories_burned INTEGER NOT NULL DEFAULT 0 CHECK (calories_burned >= 0),
              intensity TEXT NOT NULL DEFAULT 'medium' CHECK (intensity IN ('low','medium','high')),
              exercises_json TEXT NOT NULL DEFAULT '[]',
              notes TEXT NOT NULL DEFAULT '',
              created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
              updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_workout_templates_user ON workout_templates(user_id)"
    )


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
            ("target_weight", "REAL"),
            ("weight_goal_duration_weeks", "INTEGER"),
            ("daily_calorie_delta", "REAL"),
            ("activity_level", "TEXT NOT NULL DEFAULT 'moderate'"),
            ("intro_seen_at", "TEXT"),
            ("demo_completed_at", "TEXT"),
            ("profile_essentials_completed_at", "TEXT"),
        ]
        for col_name, col_def in _add_missing:
            if col_name not in names:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
        
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
            ("target_weight", "REAL"),
            ("weight_goal_duration_weeks", "INTEGER"),
            ("daily_calorie_delta", "REAL"),
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


def ensure_focus_sessions_columns(conn):
    """Add missing columns to focus_sessions table if needed."""
    config = _db_config()

    if config["type"] == "postgresql":
        cols = conn.execute(
            """
            SELECT column_name FROM information_schema.columns
            WHERE table_name='focus_sessions'
            """
        ).fetchall()
        names = {row["column_name"] for row in cols}

        if "updated_at" not in names:
            conn.execute(
                "ALTER TABLE focus_sessions ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"
            )
            conn.execute(
                "UPDATE focus_sessions SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''"
            )
    else:
        cols = conn.execute("PRAGMA table_info(focus_sessions)").fetchall()
        names = {row["name"] for row in cols}

        if "updated_at" not in names:
            conn.execute(
                "ALTER TABLE focus_sessions ADD COLUMN updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)"
            )
            conn.execute(
                "UPDATE focus_sessions SET updated_at = created_at WHERE updated_at IS NULL OR updated_at = ''"
            )


def ensure_notes_task_link_triggers(conn):
    """Create cross-ownership trigger for notes on PostgreSQL, if not present.

    SQLite equivalent triggers are handled by schema.sql via init_schema(); this
    function is a no-op for SQLite.
    """
    config = _db_config()
    if config["type"] != "postgresql":
        return

    raw_conn = conn._conn
    cur = raw_conn.cursor()
    try:
        cur.execute("""
            CREATE OR REPLACE FUNCTION check_notes_task_ownership() RETURNS TRIGGER AS $$
            BEGIN
              IF NEW.source_type = 'task' AND NOT EXISTS (
                SELECT 1 FROM tasks WHERE id = NEW.source_id AND user_id = NEW.user_id
              ) THEN
                RAISE EXCEPTION 'Invalid task-linked note: task missing or not owned by user';
              END IF;
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        """)

        cur.execute(
            "SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notes_task_link_insert'"
        )
        if not cur.fetchone():
            cur.execute("""
                CREATE TRIGGER trg_notes_task_link_insert
                  BEFORE INSERT ON notes FOR EACH ROW
                  EXECUTE FUNCTION check_notes_task_ownership()
            """)

        cur.execute(
            "SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notes_task_link_update'"
        )
        if not cur.fetchone():
            cur.execute("""
                CREATE TRIGGER trg_notes_task_link_update
                  BEFORE UPDATE ON notes FOR EACH ROW
                  EXECUTE FUNCTION check_notes_task_ownership()
            """)
    finally:
        cur.close()


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
    
    For PostgreSQL: validates connectivity, initializes schema deltas, and fails fast if unavailable.
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
            pool = _get_postgres_pool_for_app(app)
            conn = _checkout_postgres_connection(pool)
            app.logger.info("[DB] Connected to PostgreSQL successfully")
            
            try:
                with app.app_context():
                    init_schema(conn)
                    ensure_tasks_tags_column(conn)
                    ensure_tasks_recurrence_columns(conn)
                    ensure_workout_templates_table(conn)
                    ensure_auth_columns(conn)
                    ensure_focus_sessions_columns(conn)
                    ensure_notes_task_link_triggers(conn)
                conn.commit()
                app.logger.info("[DB] PostgreSQL initialization complete")
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
        except psycopg2.OperationalError as e:
            app.logger.exception("[DB] PostgreSQL startup connection failed")
            raise RuntimeError("PostgreSQL startup connection failed") from e
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
                ensure_tasks_recurrence_columns(conn)
                ensure_workout_templates_table(conn)
                ensure_auth_columns(conn)
                ensure_focus_sessions_columns(conn)
                if should_migrate_json(conn):
                    migrate_json_to_sqlite(conn)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as e:
        print(f"[DB] Error initializing SQLite: {e}")
        raise e
