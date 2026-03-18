# AUDIT 1: Database Layer — Complete Issue Audit (Detailed)

**Phase:** 1 of 10-phase systematic code audit  
**Focus:** Database connection management, schema initialization, SQL execution, transaction handling, error recovery, multi-database support (SQLite/PostgreSQL)  
**Scope:** [app/db.py](app/db.py), [db/schema.sql](db/schema.sql), Database initialization and teardown  
**Issues Found:** 18 (3 Critical, 8 Major, 7 Minor)  
**Severity Distribution:** 17% Critical | 44% Major | 39% Minor

---

## Summary

The database layer provides **sophisticated multi-database abstraction** (SQLite + PostgreSQL) with **connection pooling** and **schema migration**, but has **critical gaps in error handling**, **incomplete transaction support**, **schema fragmentation** (scattered ensure_* functions), and **insufficient validation**. The PostgreSQL wrapper correctly converts SQLite syntax but masks underlying database differences. Connection cleanup and error recovery are incomplete.

**Immediate Action Required:** Implement transaction context managers, complete error handling in schema initialization, validate connection state on use, and consolidate scattered schema migration logic into centralized migration system.

---

## CRITICAL ISSUES (3)

### 🔴 **CRITICAL-01: No Transaction Context Manager — Partial State Risk**

**Severity:** CRITICAL  
**Files Affected:**
- [app/db.py](app/db.py#L248-L280) — get_db() returns raw connection without transaction wrapper
- All route handlers and repositories must manually manage transactions

**Root Cause:**
Database connections returned without built-in transaction support. Callers must explicitly begin/commit/rollback transactions or data inconsistency occurs.

**Evidence:**

```python
# LINE 248-280 (app/db.py) — get_db() returns bare connection
def get_db():
    """Get database connection (SQLite or PostgreSQL).
    
    Returns: SQLite sqlite3.Connection OR PostgreSQL wrapper
    Both support execute/fetchone/fetchall
    ⚠️ NO transaction context manager
    """
    if "db" not in g:
        config = _db_config()
        
        if config["type"] == "postgresql":
            # Returns PostgreSQLConnectionWrapper (no transaction wrapper)
            g.db = _checkout_postgres_connection(_get_postgres_pool())
        else:  # SQLite
            conn = sqlite3.connect(db_file)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON")
            # ⚠️ Returns raw sqlite3.Connection
            g.db = conn
    
    return g.db

# Usage in routes (no transaction management):
@app.route('/api/tasks', methods=['POST'])
def create_task():
    db = get_db()
    
    # Insert task
    cursor = db.execute(
        "INSERT INTO tasks (user_id, title) VALUES (?, ?)",
        (user_id, title)
    )
    task_id = cursor.lastrowid
    
    # If this fails, task inserted but details missing (partial state):
    db.execute(
        "INSERT INTO task_details (task_id, description) VALUES (?, ?)",
        (task_id, description)
    )
    # ⚠️ No automatic rollback if 2nd insert fails
    
    return {"task_id": task_id}
```

**Problem Scenario:**

```
User creates task with multiple operations:

1. db.execute("INSERT INTO tasks (...)") → Success, task_id=42
2. db.execute("INSERT INTO task_history (...)") → Fails: network error
3. db.execute("UPDATE stats SET tasks_count=...") → Never executes

Result:
- Task exists in database (task_id=42) ✓
- Task history missing (partial insert failed) ✗
- Stats not updated ✗
- Database in inconsistent state
- Future queries confused by missing history
```

**Compounding Issue — PostgreSQL Doesn't Auto-Commit Like SQLite:**

```python
# SQLite: default isolation_level=None means autocommit
conn = sqlite3.connect("db.sqlite")
conn.execute("INSERT INTO tasks ...")  # Auto-commits
conn.close()  # Data persisted

# PostgreSQL: requires explicit commit
raw_conn = pool.getconn()
raw_conn.execute("INSERT INTO tasks ...")
pool.putconn(raw_conn)  # ⚠️ Data NOT committed! (unless wrapper commits)
# Data lost!
```

**Impact:**
- **Data Inconsistency:** Partial operations leave database invalid
- **Hard to Debug:** Corruption discovered much later in different code
- **Compliance Issue:** Data integrity violations (ACID not guaranteed)
- **Cascading Errors:** Downstream code sees incomplete records

**Remediation:**

```python
from contextlib import contextmanager
from typing import Optional

@contextmanager
def transaction(db):
    """Context manager for atomic transactions across SQLite and PostgreSQL"""
    try:
        # Begin transaction explicitly
        if hasattr(db, '_conn'):  # PostgreSQL wrapper
            db._conn.begin()
        else:  # SQLite
            db.execute("BEGIN TRANSACTION")
        
        yield db
        
        # Commit if no exception
        if hasattr(db, '_conn'):
            db._conn.commit()
        else:
            db.execute("COMMIT")
            
    except Exception as e:
        # Rollback on any error
        try:
            if hasattr(db, '_conn'):
                db._conn.rollback()
            else:
                db.execute("ROLLBACK")
        except Exception:
            pass  # Ignore rollback errors
        raise e

# Usage in routes:
@app.route('/api/tasks', methods=['POST'])
def create_task():
    db = get_db()
    
    try:
        with transaction(db):  # ← Atomic block
            # Insert task
            cursor = db.execute(
                "INSERT INTO tasks (user_id, title) VALUES (?, ?)",
                (user_id, title)
            )
            task_id = cursor.lastrowid
            
            # Insert details (same transaction)
            db.execute(
                "INSERT INTO task_details (task_id, description) VALUES (?, ?)",
                (task_id, description)
            )
            
            # Update stats (same transaction)
            db.execute(
                "UPDATE stats SET tasks_count=tasks_count+1 WHERE user_id=?",
                (user_id,)
            )
            # ← If any operation fails, ALL are rolled back
            
        return {"task_id": task_id}, 201
        
    except DatabaseError as e:
        # All changes automatically rolled back
        return {"error": "Failed to create task"}, 500
```

---

### 🔴 **CRITICAL-02: PostgreSQL Wrapper Missing Commit After execute() — Data Loss**

**Severity:** CRITICAL  
**Files Affected:**
- [app/db.py](app/db.py#L56-L95) — PostgreSQLConnectionWrapper.execute() method
- [app/db.py](app/db.py#L207-L225) — _return_postgres_connection() doesn't commit on success

**Root Cause:**
PostgreSQL wrapper's `execute()` method modifies data but doesn't commit. Connection returned to pool without explicit commit call. If connection closed before caller references the data, changes are lost.

**Evidence:**

```python
# LINE 56-95 (app/db.py) — PostgreSQLConnectionWrapper.execute()
def execute(self, sql, params=None):
    """Execute SQL and return self (the wrapper).

    Returning self (not the raw cursor) means callers can access
    .lastrowid and .rowcount correctly, while .fetchone()/.fetchall()
    still delegate through to the underlying psycopg2 cursor.

    For INSERT on SERIAL tables, appends RETURNING id automatically so
    that .lastrowid is populated without any SAVEPOINT/lastval hacks.
    """
    sql_converted = self._convert_sql_placeholders(sql)

    # Append RETURNING id for INSERTs on SERIAL tables
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

    return self  # Returns wrapper but NEVER commits!
    # ⚠️ Data written to cursor but not committed to database
```

**Where Data Loss Occurs:**

```python
# LINE 207-225 (app/db.py) — _return_postgres_connection()
def _return_postgres_connection(pool, conn):
    """Return connection to pool after request"""
    if conn is None:
        return

    close_connection = bool(getattr(conn, "closed", 0))
    if not close_connection:
        try:
            conn.rollback()  # ⚠️ ROLLBACK called here!
            # Any uncommitted changes are lost!
        except Exception:
            close_connection = True

    try:
        pool.putconn(conn, close=close_connection)  # Return to pool
    except Exception:
        try:
            conn.close()
        except Exception:
            pass
```

**Problem Scenario:**

```
Route handler:
1. db = get_db()  # Checkout PostgreSQL connection from pool
2. db.execute(
    "INSERT INTO tasks (user_id, title) VALUES (%s, %s)",
    (user_id, title)
   )  # Data written to cursor, not committed
3. return {"success": True}  # Route returns

Flask teardown (close_db):
4. _return_postgres_connection called
5. conn.rollback() called  # ⚠️ INSERT rolled back!
6. Connection returned to pool

Result: Data inserted but never committed!
```

**Impact:**
- **Data Loss:** Inserts/updates executed but rolled back
- **Silent Failure:** No error raised, caller thinks data persisted
- **Debugging Hell:** Data mysteriously disappears after commit
- **Cascading Issues:** Subsequent queries can't find the "inserted" data

**Remediation:**

```python
class PostgreSQLConnectionWrapper:
    def __init__(self, psycopg2_conn, *, release_callback=None):
        self._conn = psycopg2_conn
        self._cursor = psycopg2_conn.cursor(cursor_factory=RealDictCursor)
        self._release_callback = release_callback
        self._closed = False
        self.lastrowid = None
        self.rowcount = 0
        self._in_transaction = False  # Track transaction state
    
    def execute(self, sql, params=None):
        """Execute SQL with auto-commit for non-SELECT queries"""
        sql_converted = self._convert_sql_placeholders(sql)
        
        # ... (existing placeholder conversion code) ...
        
        # BEGIN transaction if not already in one
        if not self._in_transaction:
            self._conn.begin()
            self._in_transaction = True
        
        if params:
            self._cursor.execute(sql_converted, params)
        else:
            self._cursor.execute(sql_converted)
        
        self.rowcount = self._cursor.rowcount
        
        # Auto-commit for INSERT/UPDATE/DELETE
        if re.search(r'\b(INSERT|UPDATE|DELETE)\b', sql, re.IGNORECASE):
            self._conn.commit()
            self._in_transaction = False
        
        return self
    
    def commit(self):
        """Explicit commit"""
        if self._in_transaction:
            self._conn.commit()
            self._in_transaction = False
    
    def rollback(self):
        """Explicit rollback"""
        if self._in_transaction:
            self._conn.rollback()
            self._in_transaction = False

def _return_postgres_connection(pool, conn):
    """Return connection to pool after request"""
    if conn is None:
        return

    # Commit any pending transaction before returning to pool
    try:
        if hasattr(conn, '_in_transaction') and conn._in_transaction:
            conn.commit()  # Commit pending changes
    except Exception as e:
        print(f"[DB] Error committing before pool return: {e}")
        try:
            conn.rollback()
        except Exception:
            pass

    close_connection = bool(getattr(conn, "closed", 0))
    if not close_connection:
        try:
            # Now safe to rollback (no pending changes)
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
```

---

### 🔴 **CRITICAL-03: Schema Initialization Not Idempotent — Table Drop on Migration**

**Severity:** CRITICAL  
**Files Affected:**
- [app/db.py](app/db.py#L301-L345) — init_schema() for PostgreSQL drops tables on migration

**Root Cause:**
PostgreSQL schema initialization detects "broken" schema (missing SERIAL sequences) and drops ALL tables to rebuild them. Data loss on migration.

**Evidence:**

```python
# LINE 301-345 (app/db.py) — init_schema() drops tables!
def init_schema(conn):
    """Initialize database schema.
    
    For PostgreSQL: detects broken schema and DROPS ALL TABLES
    """
    config = _db_config()

    if config["type"] == "postgresql":
        # ... (read schema file) ...
        
        try:
            # Check if schema already has SERIAL sequences
            cur.execute("""
                SELECT column_default
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'users'
                  AND column_name = 'id'
            """)
            row = cur.fetchone()
            schema_broken = (row is None) or (row[0] is None) or ('nextval' not in str(row[0]))

            if schema_broken:  # ⚠️ If schema "broken", drop ALL data!
                print("[DB] Broken/missing schema detected — dropping all tables...")
                for tbl in [
                    'focus_sessions', 'notes', 'stats_snapshots', 'user_progress',
                    'nutrition_entries', 'project_subtasks', 'tasks', 'workout_templates',
                    'workouts', 'projects', 'login_attempts', 'sessions', 'users',
                ]:
                    cur.execute(f'DROP TABLE IF EXISTS {tbl} CASCADE')
                    # ⚠️ User data deleted!
                
                raw_conn.commit()
                print("[DB] Dropped broken tables — creating fresh schema")
            
            cur.execute(schema_sql)  # Re-create schema
            raw_conn.commit()
        except Exception as e:
            raw_conn.rollback()
            raise
```

**Problem Scenario:**

```
Production database:
- 1000 users
- 50,000 tasks
- 10,000 nutrition entries
- All data in PostgreSQL

Deploy migration:
1. Code deployer runs init_schema()
2. Schema check: users.id has no SERIAL default (was created via SQLite schema)
3. Schema marked as "broken"
4. All tables dropped: DROP TABLE users CASCADE
5. All user data, tasks, nutrition entries DELETED
6. Schema recreated empty
7. 1000 users' data gone forever

Result: Complete data loss in production
```

**Impact:**
- **Data Loss:** Production data deleted on migration
- **Irreversible:** No recovery without backups
- **Deployment Risk:** Every schema change risks deletion
- **Compliance Issue:** GDPR violation (data destruction without consent)

**Remediation:**

```python
def init_schema(conn):
    """Initialize database schema safely (no drops on migration)"""
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
            # Check if ANY tables exist
            cur.execute("""
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'users'
                LIMIT 1
            """)
            users_table_exists = cur.fetchone() is not None

            if not users_table_exists:
                # Fresh database: create all tables
                print("[DB] Fresh database detected, creating schema...")
                cur.execute(schema_sql)
            else:
                # Database exists: run migrations (use Alembic or similar)
                print("[DB] Database exists, running migrations only...")
                # Use dedicated migration system (see MAJOR-05)
                # Don't drop tables here
            
            raw_conn.commit()
            print("[DB] PostgreSQL schema initialized successfully")
        
        except Exception as e:
            raw_conn.rollback()
            print(f"[DB] Schema error: {e}")
            raise
        finally:
            cur.close()
    else:
        # SQLite: use executescript (safer, doesn't drop data)
        schema_file = _schema_file()
        if not os.path.exists(schema_file):
            raise FileNotFoundError(f"Missing schema file: {schema_file}")

        with open(schema_file, "r", encoding="utf-8") as f:
            schema_sql = f.read()

        # CREATE TABLE IF NOT EXISTS prevents overwrites
        conn.executescript(schema_sql)
```

---

## MAJOR ISSUES (8)

### 🟠 **MAJOR-01: PostgreSQL Wrapper Hides Database Differences — Subtle Bugs**

**Severity:** MAJOR  
**Files Affected:**
- [app/db.py](app/db.py#L38-L95) — PostgreSQLConnectionWrapper conversion logic

**Evidence:**

```python
# The wrapper converts SQLite SQL to PostgreSQL SQL
# But doesn't handle all edge cases:

# WORKS:
db.execute("SELECT * FROM tasks WHERE id = ?", (1,))

# BREAKS (parameterized LIKE with ESCAPE):
db.execute("SELECT * FROM tasks WHERE title LIKE ? ESCAPE ?", ('%foo%', '\\'))
# Converted to: SELECT * FROM tasks WHERE title LIKE %s ESCAPE %s
# But % and \ are special, might not work as expected

# SQLite AUTOINCREMENT not handled
db.execute("INSERT INTO tasks (...) VALUES (...)")
# cursor.lastrowid works in SQLite but might be undefined in PostgreSQL
# (unless RETURNING id appended)
```

**Remediation:** Document all SQL compatibility limitations, add type hints, test with both databases.

---

### 🟠 **MAJOR-02: Schema Evolution Scattered in ensure_* Functions — Hard to Track**

**Severity:** MAJOR  
**Files Affected:**
- [app/db.py](app/db.py#L355-L750+) — ensure_tasks_tags_column, ensure_recurrence_columns, ensure_focus_sessions_columns, etc.

**Evidence:**

```python
# Schema changes are scattered across 10+ functions:
ensure_tasks_tags_column()       # Adds tags_json, note_content columns
ensure_tasks_recurrence_columns()  # Adds recurrence, recurrence_parent_id
ensure_workout_templates_table()  # Creates entire table
ensure_auth_columns()            # Adds password_hash, level, goal, etc.
ensure_focus_sessions_columns()  # Adds updated_at, task_id, project_id
ensure_goals_columns()           # (implied) Adds goals table columns

# Each function is called from different places
# Hard to track what's been applied
# No migration history or version tracking
```

**Impact:**
- **Unclear Order:** Don't know which migrations run first
- **Reapplied Safely:** Called repeatedly (CREATE TABLE IF EXISTS) but inefficient
- **No Rollback:** If migration fails halfway, unclear state
- **Testing Nightmare:** Hard to test schema state

**Remediation:**

Create centralized migration system (Alembic for Flask):

```python
# migrations/versions/001_initial_schema.py
def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        # ...
    )

def downgrade():
    op.drop_table('users')

# Run migrations explicitly:
# flask db upgrade  # Apply pending migrations
# flask db downgrade  # Rollback last migration
```

---

### 🟠 **MAJOR-03: Connection Pool Hardcoded Pool Size — No Tuning**

**Severity:** MAJOR  
**Evidence:**

```python
# LINE 170-177 (app/db.py)
def _create_postgres_pool(config):
    return ThreadedConnectionPool(
        config.get("pool_minconn", 1),  # Min 1 connection
        config.get("pool_maxconn", 5),  # Max 5 connections
        config["url"],
    )

# Hardcoded 1-5 connections
# Not configurable per environment
# No load-based scaling
# High concurrency = connection exhaustion
```

**Remediation:**

```python
def _create_postgres_pool(config):
    min_conns = config.get("pool_minconn", 2)
    max_conns = config.get("pool_maxconn", 10)
    
    # Warn if pool too small
    if max_conns < 5:
        logging.warning(f"PostgreSQL pool small ({max_conns}), may cause timeouts")
    
    return ThreadedConnectionPool(
        min_connections=min_conns,
        max_connections=max_conns,
        dsn=config["url"],
    )
```

---

### 🟠 **MAJOR-04: No Connection Timeout Configuration**

**Severity:** MAJOR  
**Issue:** PostgreSQL connections can hang indefinitely if query slow or network blocked.

```python
# No timeout set on connection or query execution
raw_conn = pool.getconn()
raw_conn.set_isolation_level(...)  # No timeout
```

**Remediation:**

```python
def _create_postgres_pool(config):
    pool = ThreadedConnectionPool(
        config.get("pool_minconn", 1),
        config.get("pool_maxconn", 5),
        config["url"],
        connect_timeout=10,  # ← Add timeout
    )
    return pool

# Per-query timeout:
def execute_with_timeout(conn, sql, params, timeout=30):
    """Execute with timeout"""
    conn.set_statement_timeout(timeout * 1000)  # milliseconds
    try:
        return conn.execute(sql, params)
    finally:
        conn.set_statement_timeout(0)  # Reset
```

---

### 🟠 **MAJOR-05: No Formal Migration System — Ad-hoc Schema Updates**

**Severity:** MAJOR  
**Issue:** Schema changes via ensure_* functions, no version tracking, no rollback capability.

**Remediation:** Implement Alembic for Flask:

```bash
flask db init  # Initialize migration system
flask db migrate -m "add user email field"  # Create migration
flask db upgrade  # Apply migration
flask db history  # See migration history
```

---

### 🟠 **MAJOR-06: Foreign Key Constraints Not Enforced Consistently**

**Severity:** MAJOR  
**Evidence:**

```python
# SQLite: Explicitly enabled
conn.execute("PRAGMA foreign_keys = ON")
# ✓ Enforced

# PostgreSQL: Depends on database configuration
# Default in PostgreSQL: constraints enabled
# ✓ Assumed enforced
# ⚠️ But if someone disables: no warning
```

---

### 🟠 **MAJOR-07: Index Creation Scattered and Reactive**

**Severity:** MAJOR  
**Evidence:**

```python
# Indexes added in multiple places:
# - schema.sql (initial)
# - ensure_tasks_recurrence_columns() (migration)
# - ensure_auth_columns() (migration)
# - Various ensure_* functions

# No index maintenance or monitoring
# No EXPLAIN queries to verify index usage
```

---

### 🟠 **MAJOR-08: No Connection State Validation**

**Severity:** MAJOR  
**Issue:** Connection returned from pool without checking if still alive.

```python
def get_db():
    if "db" not in g:
        # ... create connection ...
        g.db = conn
    
    return g.db
    # ⚠️ If connection died since creation, error on first query

# Should check:
# - Connection still open?
# - Network still connected?
# - Database still accessible?
```

**Remediation:**

```python
def get_db():
    if "db" not in g:
        config = _db_config()
        
        if config["type"] == "postgresql":
            g.db = _checkout_postgres_connection(_get_postgres_pool())
        else:
            conn = sqlite3.connect(_db_file())
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA foreign_keys = ON")
            g.db = conn
    
    # Validate connection is alive
    try:
        g.db.execute("SELECT 1")  # Quick ping
    except Exception as e:
        # Connection dead, reconnect
        g.pop("db", None)
        return get_db()  # Retry
    
    return g.db
```

---

## MINOR ISSUES (7)

### 🟡 **MINOR-01: Implicit Conversion sqlite3.Row → dict**

**Severity:** MINOR  
**Evidence:**

```python
# SQLite returns sqlite3.Row objects
row = conn.execute("SELECT * FROM users WHERE id = 1").fetchone()
# row is sqlite3.Row (dict-like)

# PostgreSQL returns psycopg2 mapping
row = conn.execute("SELECT * FROM users WHERE id = 1").fetchone()
# row is psycopg2 Row (dict-like)

# Caller must handle both types
if isinstance(row, dict):
    email = row['email']
else:
    email = row.get('email')  # Defensive
```

**Remediation:** Normalize return type in wrapper.

---

### 🟡 **MINOR-02: INSERT OR IGNORE Not Uniformly Converted**

**Severity:** MINOR  
**Evidence:**

```python
# SQLite syntax
db.execute("INSERT OR IGNORE INTO users (email) VALUES (?)", (email,))

# Converted to PostgreSQL:
# INSERT INTO users (email) VALUES (%s) ON CONFLICT DO NOTHING

# But ON CONFLICT doesn't specify which column(s) conflict
# Might not work if multiple unique constraints exist
```

---

### 🟡 **MINOR-03: No Query Logging**

**Severity:** MINOR  
**Issue:** Can't debug slow queries or audit data access.

**Remediation:**

```python
def execute(self, sql, params=None):
    import logging
    logger = logging.getLogger("db")
    
    start = time.time()
    result = self._cursor.execute(sql, params)
    elapsed = time.time() - start
    
    if elapsed > 1.0:  # Slow query
        logger.warning(f"Slow query ({elapsed:.2f}s): {sql[:100]}")
    
    logger.debug(f"Query: {sql} | Params: {params}")
    return result
```

---

### 🟡 **MINOR-04: SQLite WAL Mode Not Enabled**

**Severity:** MINOR  
**Issue:** SQLite in default mode has poor concurrent write performance.

**Remediation:**

```python
conn = sqlite3.connect(db_file)
conn.execute("PRAGMA journal_mode = WAL")  # Enable Write-Ahead Logging
conn.row_factory = sqlite3.Row
conn.execute("PRAGMA foreign_keys = ON")
```

---

### 🟡 **MINOR-05: No Automatic Backup/Snapshot for SQLite**

**Severity:** MINOR  
**Issue:** SQLite database file can be corrupted, no backup mechanism.

---

### 🟡 **MINOR-06: Pool Not Cleaned on App Shutdown**

**Severity:** MINOR  
**Evidence:**

```python
# register_db(app) registers teardown handler
def register_db(app):
    app.teardown_appcontext(close_db)

# close_db only closes request connection
def close_db(_error):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()

# ⚠️ But PostgreSQL pool connections not closed on app shutdown
# Pool connection.close() never called on shutdown
```

**Remediation:**

```python
def close_pool(app):
    """Close PostgreSQL pool on app shutdown"""
    pool = app.extensions.pop(_POSTGRES_POOL_KEY, None)
    if pool is not None:
        pool.closeall()

# Register:
app.config["DB_TEARDOWN"] = close_pool
```

---

### 🟡 **MINOR-07: No Database Size Monitoring**

**Severity:** MINOR  
**Issue:** SQLite database file grows unbounded, no alert.

**Remediation:**

```python
def get_db_size(conn):
    """Get database size in bytes"""
    if isinstance(conn, PostgreSQLConnectionWrapper):
        result = conn.execute(
            "SELECT pg_database_size(current_database()) as size"
        ).fetchone()
        return result['size'] if result else 0
    else:
        # SQLite
        import os
        db_file = current_app.config["DB_CONFIG"]["path"]
        return os.path.getsize(db_file) if os.path.exists(db_file) else 0
```

---

## Summary Table

| # | Issue | Severity | Impact | Component |
|---|-------|----------|--------|-----------|
| CRITICAL-01 | No Transaction Context Manager | CRITICAL | Partial State Risk | get_db() |
| CRITICAL-02 | PostgreSQL Wrapper Missing Commit | CRITICAL | Data Loss on Shutdown | PostgreSQLConnectionWrapper |
| CRITICAL-03 | Schema Init Drops Production Tables | CRITICAL | Data Destruction | init_schema() |
| MAJOR-01 | Wrapper Hides Database Differences | MAJOR | Subtle Bugs | PostgreSQLConnectionWrapper |
| MAJOR-02 | Schema Evolution Scattered | MAJOR | Hard to Track | ensure_* functions |
| MAJOR-03 | Pool Size Hardcoded | MAJOR | Connection Exhaustion | _create_postgres_pool() |
| MAJOR-04 | No Connection Timeout | MAJOR | Hanging Queries | PostgreSQL pool |
| MAJOR-05 | No Formal Migration System | MAJOR | Ad-hoc Updates | Schema management |
| MAJOR-06 | Foreign Keys Not Consistently Enforced | MAJOR | Data Inconsistency | Schema |
| MAJOR-07 | Indexes Scattered | MAJOR | No Index Maintenance | ensure_* functions |
| MAJOR-08 | No Connection State Validation | MAJOR | Connection Errors | get_db() |
| MINOR-01 | Implicit sqlite3.Row Conversion | MINOR | Type Inconsistency | Row handling |
| MINOR-02 | INSERT OR IGNORE Not Uniform | MINOR | Conflict Handling | PostgreSQLConnectionWrapper |
| MINOR-03 | No Query Logging | MINOR | Debugging Hard | execute() |
| MINOR-04 | SQLite WAL Mode Disabled | MINOR | Slow Concurrency | SQLite config |
| MINOR-05 | No Automatic Backup | MINOR | Corruption Risk | SQLite |
| MINOR-06 | Pool Not Cleaned on Shutdown | MINOR | Connection Leak | register_db() |
| MINOR-07 | No Database Size Monitoring | MINOR | Unchecked Growth | Database |

---

## Remediation Effort Estimate

| Severity | Count | Effort | Priority |
|----------|-------|--------|----------|
| CRITICAL | 3 | 20-30 hours | **IMMEDIATE** (blocks production readiness) |
| MAJOR | 8 | 30-45 hours | **HIGH** (next sprint) |
| MINOR | 7 | 10-15 hours | **MEDIUM** (backlog) |
| **TOTAL** | **18** | **60-90 hours** | — |

---

## Critical Path (Must Fix Before Production)

1. **CRITICAL-03:** Remove table drop logic from init_schema() (prevents data destruction)
2. **CRITICAL-02:** Add explicit commit() calls in PostgreSQL wrapper
3. **CRITICAL-01:** Implement transaction context manager
4. **MAJOR-02:** Migrate schema to Alembic migrations
5. **MAJOR-05:** Document all PostgreSQL/SQLite differences

---

## Conclusion

The database layer is **sophisticated in design** (multi-database support, connection pooling) but has **production-blocking bugs** (data loss, missing commits, dangerous table drops). The PostgreSQL wrapper is clever but masks important database differences. Transaction support is missing entirely, creating data corruption risks.

**For production deployment, this layer needs:**
1. Transaction support with context managers
2. Safe schema initialization (no data drops)
3. Proper commit handling in PostgreSQL wrapper
4. Formal migration system (Alembic)
5. Connection validation and timeout handling

The good news: Most issues are fixable with focused engineering. The bad news: Multiple issues must be fixed together to ensure data safety.
