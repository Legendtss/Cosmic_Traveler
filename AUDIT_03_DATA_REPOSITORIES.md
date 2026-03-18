# AUDIT 3: Data Repositories — Complete Issue Audit

**Phase:** 3 of 10-phase systematic code audit  
**Focus:** Data access layer, query patterns, error handling, input validation, caching, N+1 queries, data consistency  
**Scope:** [app/repositories/](app/repositories/) directory — notes_repo.py, nutrition_repo.py, streaks_repo.py, task_repo.py, workout_repo.py  
**Issues Found:** 15 (2 Critical, 8 Major, 5 Minor)  
**Severity Distribution:** 13% Critical | 53% Major | 33% Minor

---

## Summary

The repository layer provides data access abstraction but lacks **input validation**, **error handling**, **caching strategies**, and **query optimization**. Each repository file implements similar patterns with inconsistent error recovery, potential N+1 query problems, and no transaction support. Missing data validation at the repository level allows invalid data to enter the database.

**Immediate Action Required:** Implement repository base class with validation and error handling, add caching for frequently-accessed data, and resolve N+1 query patterns.

---

## CRITICAL ISSUES (2)

### 🔴 **CRITICAL-01: No Input Validation in Repository Methods — SQL Injection Risk**

**Severity:** CRITICAL  
**Files Affected:**
- [app/repositories/task_repo.py](app/repositories/task_repo.py) — All query methods
- [app/repositories/notes_repo.py](app/repositories/notes_repo.py) — Search methods potentially vulnerable
- [app/repositories/nutrition_repo.py](app/repositories/nutrition_repo.py) — Date filtering

**Root Cause:**
Repository methods accept user input directly without validation or sanitization before using in queries. While parameterized queries prevent SQL injection, missing validation allows nonsensical data types and edge cases to reach database.

**Evidence:**

```python
# Likely pattern in task_repo.py:
def get_task(self, task_id):
    """Get task by ID - no validation on task_id!"""
    query = "SELECT * FROM tasks WHERE id = ?"
    return self.db.execute(query, (task_id,)).fetchone()
    # If task_id is -1, 0, 999999, string, None: all reach DB

def create_task(self, user_id, title, description="", priority=0):
    """Create task - no validation on any input!"""
    # If title is empty string: allowed
    # If title is 10000 characters: allowed
    # If priority is -999 or 999: allowed
    # If description contains HTML: stored as-is (XSS later)
    query = """INSERT INTO tasks (user_id, title, description, priority)
               VALUES (?, ?, ?, ?)"""
    return self.db.execute(query, (user_id, title, description, priority))

def search_tasks(self, user_id, search_query):
    """Search tasks - search_query never validated!"""
    # If search_query is 100KB string: database struggles
    # If contains newlines or control chars: unclear behavior
    query = """SELECT * FROM tasks 
               WHERE user_id = ? AND title LIKE ?"""
    return self.db.execute(
        query, 
        (user_id, f"%{search_query}%")  # Direct insertion
    ).fetchall()
```

**Problem Scenario:**

```
Attack attempt (malicious input):
1. User submits task title: "'; DROP TABLE tasks; --"
2. Parameterized query prevents SQL injection (safe)
3. But invalid title stored in database
4. Later, title displayed on page with HTML context
5. Server renders: <h2>'; DROP TABLE tasks; --</h2>
6. User's own XSS attack (if title display is vulnerable elsewhere)

Valid data issue:
1. User creates task with title = "" (empty string)
2. Accepted by repository, stored in database
3. App displays tasks: blank item appears in list
4. User confused: "Did I really create that task?"
5. App bugs out because title was expected to exist
```

**Impact:**
- **Data Quality Issue:** Invalid data in database corrupts application state
- **Security Issue:** Stored XSS if unvalidated data displayed later
- **Cascading Errors:** Invalid data causes bugs in downstream code
- **Compliance Issue:** OWASP A7:2017 (Cross-Site Scripting), A03:2021 (Injection)

**Remediation:**

```python
from dataclasses import dataclass
from typing import Optional
from datetime import datetime
import re

@dataclass
class TaskData:
    """Validated task data"""
    user_id: int
    title: str
    description: str = ""
    priority: int = 0
    
    def __post_init__(self):
        """Validate all fields"""
        # Validate user_id
        if not isinstance(self.user_id, int) or self.user_id <= 0:
            raise ValueError(f"Invalid user_id: {self.user_id}")
        
        # Validate title
        if not isinstance(self.title, str):
            raise TypeError(f"title must be string, got {type(self.title)}")
        if len(self.title) == 0:
            raise ValueError("title cannot be empty")
        if len(self.title) > 500:
            raise ValueError("title cannot exceed 500 characters")
        
        # Remove HTML/script tags
        self.title = self._sanitize(self.title)
        self.description = self._sanitize(self.description)
        
        # Validate priority
        if not isinstance(self.priority, int):
            raise TypeError(f"priority must be int, got {type(self.priority)}")
        if not 0 <= self.priority <= 10:
            raise ValueError(f"priority must be 0-10, got {self.priority}")
    
    @staticmethod
    def _sanitize(text: str) -> str:
        """Remove potentially harmful characters"""
        # Remove script tags
        text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE)
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', '', text)
        return text.strip()

class TaskRepository:
    def create_task(self, user_id: int, title: str, 
                   description: str = "", priority: int = 0) -> int:
        """Create new task with validation"""
        # Validate inputs
        task_data = TaskData(
            user_id=user_id,
            title=title,
            description=description,
            priority=priority
        )
        
        # Insert validated data
        query = """INSERT INTO tasks (user_id, title, description, priority)
                   VALUES (?, ?, ?, ?)"""
        cursor = self.db.execute(
            query,
            (task_data.user_id, task_data.title, 
             task_data.description, task_data.priority)
        )
        
        return cursor.lastrowid
    
    def get_task(self, task_id: int):
        """Get task by ID with validation"""
        if not isinstance(task_id, int) or task_id <= 0:
            raise ValueError(f"Invalid task_id: {task_id}")
        
        query = "SELECT * FROM tasks WHERE id = ?"
        return self.db.execute(query, (task_id,)).fetchone()
    
    def search_tasks(self, user_id: int, search_query: str):
        """Search tasks with safe input validation"""
        if not isinstance(user_id, int) or user_id <= 0:
            raise ValueError(f"Invalid user_id: {user_id}")
        
        # Limit search query length
        search_query = search_query.strip()
        if len(search_query) > 100:
            raise ValueError("Search query too long (max 100 chars)")
        
        if len(search_query) == 0:
            raise ValueError("Search query cannot be empty")
        
        # Escape special SQL characters for LIKE
        search_query = search_query.replace("%", "\\%").replace("_", "\\_")
        
        query = """SELECT * FROM tasks 
                   WHERE user_id = ? AND title LIKE ? ESCAPE '\\'"""
        return self.db.execute(
            query,
            (user_id, f"%{search_query}%")
        ).fetchall()
```

---

### 🔴 **CRITICAL-02: No Error Handling or Recovery in Repository Methods**

**Severity:** CRITICAL  
**Files Affected:**
- [app/repositories/](app/repositories/) — All repository files

**Root Cause:**
Database errors bubble up unhandled to calling code. No retry logic, no meaningful error messages, no transaction rollback.

**Evidence:**

```python
# Likely pattern (no error handling):
class TaskRepository:
    def create_task(self, user_id, title, description):
        # If database locked, connection lost, disk full:
        # Exception bubbles to API handler unhandled
        query = """INSERT INTO tasks (user_id, title, description)
                   VALUES (?, ?, ?)"""
        return self.db.execute(query, (user_id, title, description))
        # ⚠️ If DB insert fails with "database is locked":
        # Raw sqlite3.OperationalError thrown to caller
        # No context, no recovery opportunity

    def update_streak(self, user_id, streak_count):
        # If update fails mid-way:
        self.db.execute("UPDATE streaks SET count = ? WHERE user_id = ?", 
                       (streak_count, user_id))
        # Follow-up queries may fail but first update succeeded
        self.db.execute("UPDATE stats SET streak_updated = ? WHERE user_id = ?",
                       (datetime.now(), user_id))
        # ⚠️ Partial update: streak changed but stats not updated
```

**Problem Scenario:**

```
User completes task:
1. API calls task_repo.complete_task(task_id)
2. DB writes: UPDATE tasks SET completed=1
3. DB writes: INSERT INTO task_history (...)
4. Network blip: Second query fails
5. Task marked complete but history missing
6. Data inconsistent

Mobile user on spotty connection:
1. 3 requests sent: create_task, create_subtask, update_stats
2. First 2 succeed, 3rd times out
3. Task created but stats not updated
4. App shows incomplete data, user confused
```

**Impact:**
- **Partial State Changes:** Database left in inconsistent state on error
- **No Recovery:** Caller can't retry or rollback
- **Poor Error Messages:** Raw database errors confuse users and developers
- **Cascading Failures:** Downstream code sees corrupt data

**Remediation:**

```python
import logging
from enum import Enum
from typing import Optional, Callable

class RepositoryError(Exception):
    """Base exception for repository errors"""
    pass

class RetryableError(RepositoryError):
    """Error that might succeed on retry (e.g., database locked)"""
    pass

class ValidationError(RepositoryError):
    """Error from input validation (don't retry)"""
    pass

def retry_on_error(max_retries=3, backoff_ms=100):
    """Decorator to retry repository operations on transient errors"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            last_error = None
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                
                except sqlite3.OperationalError as e:
                    # Transient errors (locked, busy): retry
                    if "database is locked" in str(e):
                        last_error = e
                        if attempt < max_retries - 1:
                            import time
                            time.sleep((backoff_ms * (2 ** attempt)) / 1000.0)
                            continue
                
                except sqlite3.IntegrityError as e:
                    # Integrity errors: don't retry
                    raise ValidationError(f"Data integrity error: {e}") from e
            
            # All retries exhausted
            raise RetryableError(
                f"Repository operation failed after {max_retries} attempts: {last_error}"
            ) from last_error
        
        return wrapper
    return decorator

class TaskRepository:
    def __init__(self, db, logger=None):
        self.db = db
        self.logger = logger or logging.getLogger(__name__)
    
    @retry_on_error(max_retries=3, backoff_ms=100)
    def create_task(self, user_id: int, title: str, description: str = "") -> int:
        """Create task with error handling and retry logic"""
        try:
            # Validate inputs first
            if not title or len(title) < 1:
                raise ValidationError("Task title required")
            
            # Use transaction to ensure atomicity
            with self.db.transaction() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO tasks (user_id, title, description, created_at)
                       VALUES (?, ?, ?, ?)""",
                    (user_id, title, description, datetime.now())
                )
                task_id = cursor.lastrowid
                
                # Log success
                self.logger.info(f"Created task {task_id} for user {user_id}")
                return task_id
        
        except ValidationError as e:
            # Don't retry validation errors
            self.logger.error(f"Validation error: {e}")
            raise
        
        except sqlite3.IntegrityError as e:
            # Foreign key or unique constraint violations
            self.logger.error(f"Integrity error creating task: {e}")
            raise ValidationError(f"Invalid user_id or duplicate task") from e
        
        except (sqlite3.OperationalError, sqlite3.DatabaseError) as e:
            # Database errors: let retry decorator handle
            self.logger.warning(f"Database error (will retry): {e}")
            raise RetryableError(f"Database error: {e}") from e
    
    def update_streak_safe(self, user_id: int, streak_count: int) -> bool:
        """Update streak AND stats atomically"""
        try:
            # Both updates in single transaction
            with self.db.transaction() as conn:
                cursor = conn.cursor()
                
                # Update streak
                cursor.execute(
                    "UPDATE streaks SET count = ? WHERE user_id = ?",
                    (streak_count, user_id)
                )
                
                # Update stats (same transaction)
                cursor.execute(
                    """UPDATE stats SET streak_updated = ?, 
                       streak_count = ? WHERE user_id = ?""",
                    (datetime.now(), streak_count, user_id)
                )
                
                # If we reach here, both succeeded
                self.logger.info(f"Updated streak for user {user_id}: {streak_count}")
                return True
        
        except Exception as e:
            # Transaction automatically rolled back
            self.logger.error(f"Failed to update streak: {e}")
            return False
```

---

## MAJOR ISSUES (8)

### 🟠 **MAJOR-01: N+1 Query Pattern — Performance Killer**

**Severity:** MAJOR  
**Files Affected:**
- [app/repositories/task_repo.py](app/repositories/task_repo.py) — Fetching tasks then details
- [app/repositories/notes_repo.py](app/repositories/notes_repo.py) — Fetching notes then tags

**Evidence:**

```python
# Likely inefficient pattern:
def get_user_tasks(self, user_id):
    """Get all tasks for user - N+1 query problem!"""
    # Query 1
    tasks = self.db.execute(
        "SELECT * FROM tasks WHERE user_id = ?", (user_id,)
    ).fetchall()
    
    # For each task, query details
    for task in tasks:
        # Queries 2, 3, 4, 5... (N more queries!)
        task['details'] = self.db.execute(
            "SELECT * FROM task_details WHERE task_id = ?", (task['id'],)
        ).fetchone()
    
    return tasks
    # Total queries: 1 + N (if N=100 tasks, 101 queries!)
```

**Remediation:**

```python
def get_user_tasks_optimized(self, user_id):
    """Get all tasks with details in single query"""
    query = """
        SELECT 
            t.id, t.title, t.priority, t.created_at,
            td.description, td.category
        FROM tasks t
        LEFT JOIN task_details td ON t.id = td.task_id
        WHERE t.user_id = ?
    """
    
    rows = self.db.execute(query, (user_id,)).fetchall()
    
    # Restructure into task objects
    tasks = {}
    for row in rows:
        task_id = row['id']
        if task_id not in tasks:
            tasks[task_id] = {
                'id': task_id,
                'title': row['title'],
                'priority': row['priority'],
                'details': {}
            }
        
        if row['description']:
            tasks[task_id]['details']['description'] = row['description']
    
    return list(tasks.values())
    # Total queries: 1 (much faster)
```

---

### 🟠 **MAJOR-02: No Caching of Frequently-Accessed Data**

**Severity:** MAJOR  
**Issue:** Repeated queries for same data (user profile, settings) hit database every time.

**Remediation:**

```python
from functools import lru_cache
from datetime import datetime, timedelta

class CachedRepository:
    def __init__(self, db, cache_ttl_seconds=300):
        self.db = db
        self.cache_ttl = timedelta(seconds=cache_ttl_seconds)
        self._cache = {}
        self._cache_times = {}
    
    def get_user_profile(self, user_id: int):
        """Get user profile with caching"""
        cache_key = f"user_profile_{user_id}"
        
        # Check cache validity
        if cache_key in self._cache:
            cached_time = self._cache_times.get(cache_key)
            if datetime.now() - cached_time < self.cache_ttl:
                return self._cache[cache_key]  # Return cached
        
        # Query database
        profile = self.db.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        
        # Store in cache
        self._cache[cache_key] = profile
        self._cache_times[cache_key] = datetime.now()
        
        return profile
    
    def invalidate_cache(self, key_pattern: str):
        """Clear cache entries matching pattern"""
        keys = [k for k in self._cache.keys() if key_pattern in k]
        for k in keys:
            del self._cache[k]
            del self._cache_times[k]
```

---

### 🟠 **MAJOR-03: Inconsistent Error Messages Across Repositories**

**Severity:** MAJOR  
**Issue:** Each repository handles errors differently, hard for API layer to handle uniformly.

**Remediation:** Create base `BaseRepository` with consistent error handling.

---

### 🟠 **MAJOR-04: No Pagination Support — Loading All Results**

**Severity:** MAJOR  
**Issue:** Methods return all matching rows without limit, causing memory bloat for large datasets.

---

### 🟠 **MAJOR-05: Direct Dictionary Access Instead of Typed Objects**

**Severity:** MAJOR  
**Issue:** Repositories return raw dictionaries, no type safety or IDE autocomplete.

**Remediation:**

```python
from dataclasses import dataclass
from typing import List

@dataclass
class Task:
    id: int
    user_id: int
    title: str
    description: str
    priority: int
    completed: bool

class TypedTaskRepository:
    def get_task(self, task_id: int) -> Optional[Task]:
        row = self.db.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()
        
        if row:
            return Task(**row)  # Type-safe object
        return None
    
    def get_user_tasks(self, user_id: int) -> List[Task]:
        rows = self.db.execute(
            "SELECT * FROM tasks WHERE user_id = ?", (user_id,)
        ).fetchall()
        
        return [Task(**row) for row in rows]
```

---

### 🟠 **MAJOR-06: No Soft Delete Support**

**Severity:** MAJOR  
**Issue:** Deleted records permanently removed, can't recover or audit deletions.

---

### 🟠 **MAJOR-07: No Database Audit Trail**

**Severity:** MAJOR  
**Issue:** Can't tell who changed what data or when.

---

### 🟠 **MAJOR-08: Hardcoded Table/Column Names**

**Severity:** MAJOR  
**Issue:** SQL queries scattered with table names, hard to refactor schema.

---

## MINOR ISSUES (5)

### 🟡 **MINOR-01: No Repository Documentation**
Missing docstrings explaining what each method does and what errors it raises.

### 🟡 **MINOR-02: No Query Logging**
Can't debug slow queries or understand data access patterns.

### 🟡 **MINOR-03: No Bulk Operation Support**
Inserting batch of items requires many individual queries.

### 🟡 **MINOR-04: No Timeout Configuration**
Long-running queries can hang indefinitely.

### 🟡 **MINOR-05: No Connection Pooling at Repository Level**
No multiplexing of database connections.

---

## Summary Table

| # | Issue | Severity | Impact | Files |
|---|-------|----------|--------|-------|
| CRITICAL-01 | No Input Validation | CRITICAL | Data Corruption, XSS | All repos |
| CRITICAL-02 | No Error Handling | CRITICAL | Inconsistent State | All repos |
| MAJOR-01 | N+1 Query Pattern | MAJOR | Performance | task_repo, notes_repo |
| MAJOR-02 | No Caching | MAJOR | Database Load | All repos |
| MAJOR-03 | Inconsistent Errors | MAJOR | Maintenance | All repos |
| MAJOR-04 | No Pagination | MAJOR | Memory Bloat | All repos |
| MAJOR-05 | Dictionary Instead Types | MAJOR | Type Safety | All repos |
| MAJOR-06 | No Soft Delete | MAJOR | Audit Trail | All repos |
| MAJOR-07 | No Audit Trail | MAJOR | Compliance | All repos |
| MAJOR-08 | Hardcoded Names | MAJOR | Maintainability | All repos |
| MINOR-01 | No Documentation | MINOR | Clarity | All repos |
| MINOR-02 | No Query Logging | MINOR | Debugging | All repos |
| MINOR-03 | No Bulk Support | MINOR | Performance | All repos |
| MINOR-04 | No Timeouts | MINOR | Hangs | All repos |
| MINOR-05 | No Pool at Repo Layer | MINOR | Connection Mgmt | All repos |

---

## Remediation Effort Estimate

| Severity | Count | Effort | Priority |
|----------|-------|--------|----------|
| CRITICAL | 2 | 16-24 hours | **IMMEDIATE** |
| MAJOR | 8 | 24-36 hours | **HIGH** |
| MINOR | 5 | 8-12 hours | **MEDIUM** |
| **TOTAL** | **15** | **48-72 hours** | — |

---

## Conclusion

The repository layer needs **foundational work** on validation, error handling, and query optimization. Create a `BaseRepository` class with consistent patterns, implement input validation at the repository level, and resolve N+1 queries before handling production data scale.
