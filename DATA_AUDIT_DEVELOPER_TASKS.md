# DATA REPOSITORY AUDIT — DEVELOPER ACTION ITEMS & IMPLEMENTATION TEMPLATES

**For:** Development Team  
**Date:** March 18, 2026  
**Sprint:** Week 1 (Critical Issues)

---

## 🚀 QUICK START GUIDE

### Before You Begin
```bash
# 1. Read the team summary (3 mins)
cat DATA_AUDIT_TEAM_SUMMARY.md

# 2. Read the full progress document (10 mins)
cat DATA_REPOSITORY_AUDIT_PROGRESS.md

# 3. Check current test status (2 mins)
python -m pytest tests/ -v

# 4. Create a development branch
git checkout -b feature/data-repo-audit
git push origin feature/data-repo-audit
```

---

## 📋 TASK 1: Input Validation Framework (8-12 hours)

### 1.1 Create Validation Module
**File:** `app/validators.py`  
**Effort:** 3-4 hours  
**Status:** ❌ NOT STARTED

```python
# app/validators.py
"""Input validation for repository operations"""

import re
from dataclasses import dataclass
from typing import Optional, List
from datetime import datetime


class ValidationError(ValueError):
    """Raised when input validation fails"""
    def __init__(self, message: str, field: str = None):
        super().__init__(message)
        self.field = field


def safe_string(text: str, min_len: int = 1, max_len: int = 500, 
                field_name: str = "field") -> str:
    """Validate and sanitize a string field"""
    if not isinstance(text, str):
        raise ValidationError(
            f"{field_name} must be a string, got {type(text).__name__}",
            field_name
        )
    
    text = text.strip()
    
    if len(text) < min_len:
        raise ValidationError(
            f"{field_name} cannot be empty or less than {min_len} chars",
            field_name
        )
    
    if len(text) > max_len:
        raise ValidationError(
            f"{field_name} cannot exceed {max_len} characters (got {len(text)})",
            field_name
        )
    
    # Remove HTML/script tags
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    
    return text.strip()


def safe_int(value, min_val: int = None, max_val: int = None, 
             field_name: str = "field") -> int:
    """Validate and convert integer"""
    try:
        result = int(value)
    except (ValueError, TypeError):
        raise ValidationError(
            f"{field_name} must be integer, got {type(value).__name__}",
            field_name
        )
    
    if min_val is not None and result < min_val:
        raise ValidationError(
            f"{field_name} must be >= {min_val}, got {result}",
            field_name
        )
    
    if max_val is not None and result > max_val:
        raise ValidationError(
            f"{field_name} must be <= {max_val}, got {result}",
            field_name
        )
    
    return result


def safe_date(value: str, field_name: str = "date") -> str:
    """Validate date format (YYYY-MM-DD)"""
    if not isinstance(value, str):
        raise ValidationError(
            f"{field_name} must be string in YYYY-MM-DD format",
            field_name
        )
    
    try:
        datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise ValidationError(
            f"{field_name} must be YYYY-MM-DD format, got {value}",
            field_name
        )
    
    return value


@dataclass
class TaskValidator:
    """Validate task input"""
    user_id: int
    title: str
    description: str = ""
    priority: int = 0
    project_id: Optional[int] = None
    
    def __post_init__(self):
        """Validate all fields during initialization"""
        # Validate user_id
        if not isinstance(self.user_id, int) or self.user_id <= 0:
            raise ValidationError(
                f"user_id must be positive integer, got {self.user_id}",
                "user_id"
            )
        
        # Validate title (required, 1-500 chars)
        self.title = safe_string(
            self.title, 
            min_len=1, 
            max_len=500,
            field_name="title"
        )
        
        # Validate description (optional, 0-5000 chars)
        self.description = safe_string(
            self.description,
            min_len=0,
            max_len=5000,
            field_name="description"
        )
        
        # Validate priority (0-10)
        self.priority = safe_int(
            self.priority,
            min_val=0,
            max_val=10,
            field_name="priority"
        )
        
        # Validate project_id (if specified)
        if self.project_id is not None:
            self.project_id = safe_int(
                self.project_id,
                min_val=1,
                field_name="project_id"
            )


@dataclass
class NutritionValidator:
    """Validate nutrition log input"""
    user_id: int
    food_name: str
    calories: int
    protein: int = 0
    date: str = None
    
    def __post_init__(self):
        if not isinstance(self.user_id, int) or self.user_id <= 0:
            raise ValidationError("Invalid user_id", "user_id")
        
        self.food_name = safe_string(
            self.food_name,
            min_len=1,
            max_len=200,
            field_name="food_name"
        )
        
        self.calories = safe_int(
            self.calories,
            min_val=0,
            max_val=10000,
            field_name="calories"
        )
        
        self.protein = safe_int(
            self.protein,
            min_val=0,
            max_val=500,
            field_name="protein"
        )
        
        if self.date:
            self.date = safe_date(self.date, "date")


@dataclass
class WorkoutValidator:
    """Validate workout input"""
    user_id: int
    workout_type: str
    duration_minutes: int
    intensity: str = "moderate"
    
    def __post_init__(self):
        if not isinstance(self.user_id, int) or self.user_id <= 0:
            raise ValidationError("Invalid user_id", "user_id")
        
        self.workout_type = safe_string(
            self.workout_type,
            min_len=1,
            max_len=100,
            field_name="workout_type"
        )
        
        self.duration_minutes = safe_int(
            self.duration_minutes,
            min_val=1,
            max_val=480,  # Max 8 hours
            field_name="duration_minutes"
        )
        
        valid_intensities = {"light", "moderate", "vigorous"}
        if self.intensity not in valid_intensities:
            raise ValidationError(
                f"intensity must be one of {valid_intensities}",
                "intensity"
            )


# Add more validators as needed:
# - StreakValidator
# - NoteValidator
# - ProjectValidator
# - etc.
```

**Checklist:**
- [ ] File created: `app/validators.py`
- [ ] All validators defined (at least Task, Nutrition, Workout)
- [ ] ValidationError exception defined
- [ ] Helper functions (safe_string, safe_int, safe_date) implemented
- [ ] Type hints added to all functions
- [ ] Docstrings added to all classes

---

### 1.2 Update task_repo.py to Use Validators
**File:** `app/repositories/task_repo.py`  
**Effort:** 2-3 hours  
**Status:** ❌ NOT STARTED

Before each INSERT or UPDATE, add validation:

```python
from ..validators import TaskValidator, ValidationError

class TaskRepository:
    @staticmethod
    def create_task(user_id: int, title: str, description: str = "", 
                   priority: int = 0, project_id: int = None) -> int:
        """Create task with validation"""
        try:
            # Validate inputs
            validator = TaskValidator(
                user_id=user_id,
                title=title,
                description=description,
                priority=priority,
                project_id=project_id
            )
        except ValidationError as e:
            raise ValueError(f"Task validation failed: {e.args[0]}") from e
        
        # Proceed with validated data
        db = get_db()
        now = now_iso()
        
        cursor = db.execute(
            """INSERT INTO tasks 
               (user_id, title, description, priority, project_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (validator.user_id, validator.title, validator.description,
             validator.priority, validator.project_id, now, now)
        )
        
        return cursor.lastrowid

    @staticmethod
    def update_task(task_id: int, user_id: int, **updates) -> bool:
        """Update task with validation"""
        # Validate task_id
        if not isinstance(task_id, int) or task_id <= 0:
            raise ValueError("Invalid task_id")
        
        # Validate user_id
        if not isinstance(user_id, int) or user_id <= 0:
            raise ValueError("Invalid user_id")
        
        # Validate each update field
        validated = {}
        if 'title' in updates:
            validated['title'] = safe_string(
                updates['title'], 1, 500, "title"
            )
        
        if 'description' in updates:
            validated['description'] = safe_string(
                updates['description'], 0, 5000, "description"
            )
        
        if 'priority' in updates:
            validated['priority'] = safe_int(
                updates['priority'], 0, 10, "priority"
            )
        
        # Build update query dynamically
        if not validated:
            return False
        
        db = get_db()
        set_clause = ", ".join(f"{k} = ?" for k in validated.keys())
        values = list(validated.values()) + [now_iso(), task_id, user_id]
        
        db.execute(
            f"""UPDATE tasks 
               SET {set_clause}, updated_at = ?
               WHERE id = ? AND user_id = ?""",
            values
        )
        
        return db.total_changes > 0
```

**Checklist:**
- [ ] Import validators at top of file
- [ ] Wrap all INSERT operations with validation
- [ ] Wrap all UPDATE operations with validation
- [ ] Handle ValidationError with meaningful error messages
- [ ] Test with invalid inputs (empty title, negative priority, etc.)

---

### 1.3 Update Other Repositories
**Files:** `nutrition_repo.py`, `workout_repo.py`, `notes_repo.py`, `streaks_repo.py`  
**Effort:** 3-4 hours  
**Status:** ❌ NOT STARTED

Same pattern as above. Each repository should:
1. Import its validator
2. Call validator before INSERT/UPDATE
3. Catch ValidationError and raise ValueError with context
4. Use validated data for database operations

Example for nutrition_repo.py:
```python
from ..validators import NutritionValidator

def log_meal(user_id, food_name, calories, protein=0, date=None):
    """Log nutrition with validation"""
    try:
        validated = NutritionValidator(
            user_id=user_id,
            food_name=food_name,
            calories=calories,
            protein=protein,
            date=date
        )
    except ValidationError as e:
        raise ValueError(f"Nutrition validation failed: {e}")
    
    # Use validated data
    db = get_db()
    cursor = db.execute(
        "INSERT INTO nutrition_logs (user_id, food_name, calories, protein, date) VALUES (?, ?, ?, ?, ?)",
        (validated.user_id, validated.food_name, validated.calories, 
         validated.protein, validated.date or today_str())
    )
    return cursor.lastrowid
```

**Checklist:**
- [ ] All 5 repositories have validators imported
- [ ] All create/insert methods use validation
- [ ] All update methods use validation  
- [ ] ValidationErrors caught and converted to ValueError with context
- [ ] No method accepts unchecked input to database

---

## 📋 TASK 2: Error Handling & Retry Logic (6-8 hours)

### 2.1 Create Exception Hierarchy
**File:** `app/exceptions.py`  
**Effort:** 1 hour  
**Status:** ❌ NOT STARTED

```python
# app/exceptions.py
"""Exception hierarchy for repository operations"""


class RepositoryError(Exception):
    """Base exception for all repository errors"""
    pass


class ValidationError(RepositoryError):
    """Input validation failed (don't retry)"""
    def __init__(self, message: str, field: str = None):
        super().__init__(message)
        self.field = field


class RetryableError(RepositoryError):
    """Transient database error (safe to retry)"""
    pass


class DataNotFoundError(RepositoryError):
    """Requested data doesn't exist"""
    pass


class OwnershipError(RepositoryError):
    """User doesn't have permission to access this data"""
    pass


class IntegrityError(RepositoryError):
    """Database constraint violation (don't retry)"""
    pass
```

**Checklist:**
- [ ] File created: `app/exceptions.py`
- [ ] All exception classes defined
- [ ] Docstrings explain when to use each exception
- [ ] ValidationError includes field parameter

---

### 2.2 Implement Retry Decorator
**File:** `app/db.py` (add to existing file)  
**Effort:** 1-2 hours  
**Status:** ❌ NOT STARTED

```python
# Add to app/db.py

import time
import logging
import sqlite3
import functools

logger = logging.getLogger(__name__)


def retry_on_transient_error(max_retries: int = 3, backoff_ms: int = 100):
    """Decorator to retry repository operations on transient database errors.
    
    Args:
        max_retries: Number of times to retry (default 3)
        backoff_ms: Initial backoff in milliseconds (exponential backoff)
    
    Raises:
        RetryableError: If all retries exhausted
        ValidationError: If input validation failed (don't retry)
        IntegrityError: If database constraint violated (don't retry)
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            from .exceptions import RetryableError, ValidationError, IntegrityError
            
            last_error = None
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                
                except ValidationError:
                    # Don't retry validation errors
                    raise
                
                except IntegrityError:
                    # Don't retry integrity errors
                    raise
                
                except sqlite3.OperationalError as e:
                    # Database locked, busy, etc. - retry
                    error_msg = str(e).lower()
                    if "locked" in error_msg or "busy" in error_msg:
                        last_error = e
                        
                        if attempt < max_retries - 1:
                            # Exponential backoff: 100ms, 200ms, 400ms, etc.
                            sleep_time = (backoff_ms * (2 ** attempt)) / 1000.0
                            logger.warning(
                                f"Database transient error (attempt {attempt + 1}/{max_retries}), "
                                f"retrying in {sleep_time:.2f}s: {e}"
                            )
                            time.sleep(sleep_time)
                            continue
                    
                    # Not a transient error
                    raise RetryableError(f"Database error: {e}") from e
                
                except sqlite3.IntegrityError as e:
                    raise IntegrityError(f"Data integrity error: {e}") from e
            
            # All retries exhausted
            logger.error(
                f"Database operation failed after {max_retries} attempts: {last_error}"
            )
            raise RetryableError(
                f"Database operation failed after {max_retries} attempts"
            ) from last_error
        
        return wrapper
    
    return decorator


def with_transaction(func):
    """Decorator to make repository operation transactional.
    
    Wraps operation in BEGIN/COMMIT.
    Automatically ROLLBACK on exception.
    """
    @functools.wraps(func)
    def wrapper(self, *args, **kwargs):
        from .exceptions import RepositoryError
        
        db = get_db()
        try:
            db.execute("BEGIN")
            result = func(self, *args, **kwargs)
            db.execute("COMMIT")
            return result
        except Exception as e:
            db.execute("ROLLBACK")
            logger.error(f"Transaction rolled back due to: {e}")
            raise RepositoryError(f"Transaction failed: {e}") from e
    
    return wrapper
```

**Checklist:**
- [ ] Retry decorator added to app/db.py
- [ ] Transaction decorator added
- [ ] Decorators handle all SQLite error types
- [ ] Exponential backoff implemented
- [ ] Logging added for retry attempts

---

### 2.3 Add Error Handling to All Repositories

**Effort:** 3-4 hours  
**Status:** ❌ NOT STARTED

Example pattern for task_repo.py:

```python
from ..exceptions import retry_on_transient_error, with_transaction
from ..db import retry_on_transient_error

class TaskRepository:
    @staticmethod
    @retry_on_transient_error(max_retries=3)  # Add this decorator
    def create_task(user_id: int, title: str, description: str = "", 
                   priority: int = 0) -> int:
        """Create task with retry logic"""
        try:
            # Validation
            validator = TaskValidator(...)
            
            # Insert
            db = get_db()
            cursor = db.execute(...)
            return cursor.lastrowid
        
        except ValidationError as e:
            # Log validation errors but don't hide them
            logger.warning(f"Task validation failed: {e}")
            raise ValueError(str(e)) from e
        
        except sqlite3.IntegrityError as e:
            logger.error(f"Task integrity error: {e}")
            raise IntegrityError(f"Could not create task: {e}") from e
    
    @staticmethod
    @retry_on_transient_error(max_retries=3)
    @with_transaction  # Wrap in transaction
    def complete_task(task_id: int, user_id: int) -> bool:
        """Complete task and award points (atomic)"""
        try:
            db = get_db()
            
            # Update task
            db.execute(
                "UPDATE tasks SET completed=1, updated_at=? WHERE id=? AND user_id=?",
                (now_iso(), task_id, user_id)
            )
            
            # Award points
            db.execute(
                "UPDATE users SET points=points+10 WHERE id=?",
                (user_id,)
            )
            
            if db.total_changes == 0:
                raise DataNotFoundError("Task not found or not owned by user")
            
            return True
        
        except DataNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Complete task error: {e}")
            raise RepositoryError(f"Could not complete task: {e}") from e
```

**Checklist:**
- [ ] @retry_on_transient_error decorator on all public methods
- [ ] @with_transaction on multi-step operations
- [ ] Try/catch blocks for all database operations
- [ ] RepositoryError exceptions raised instead of allowing raw SQLite errors
- [ ] Appropriate log levels (warning for validation, error for database)

---

## 📋 TASK 3: Transaction Support (3-4 hours)

### 3.1 Add Transaction Context Manager
**File:** `app/db.py` (or new `app/db_transaction.py`)  
**Effort:** 2 hours  
**Status:** ❌ NOT STARTED

```python
# In app/db.py, add:

from contextlib import contextmanager


@contextmanager
def transaction():
    """Context manager for atomic database operations.
    
    Usage:
        with transaction():
            db.execute("INSERT INTO tasks ...")
            db.execute("INSERT INTO task_history ...")
        # Auto-commits if no exception
        # Auto-rollbacks if exception occurs
    """
    db = get_db()
    try:
        db.execute("BEGIN")
        yield db
        db.execute("COMMIT")
    except Exception as e:
        db.execute("ROLLBACK")
        logger.error(f"Transaction rolled back: {e}")
        raise


# Add helper to db module
def get_transaction():
    """Get transaction context manager"""
    return transaction()
```

**Checklist:**
- [ ] Transaction context manager added
- [ ] Implemented with BEGIN/COMMIT/ROLLBACK
- [ ] Exception handling in place
- [ ] Logging added for rollbacks

---

### 3.2 Wrap Critical Operations in Transactions

**Effort:** 1-2 hours  
**Status:** ❌ NOT STARTED

Identify critical multi-step operations and wrap them:

```python
# In streaks_repo.py:
def update_daily_streak(user_id: int, increment: bool = True) -> dict:
    """Update streak atomically with stats"""
    with transaction():
        # Step 1: Get current streak
        row = db.execute(
            "SELECT count FROM streaks WHERE user_id = ?",
            (user_id,)
        ).fetchone()
        
        current = row['count'] if row else 0
        new_count = current + (1 if increment else 0)
        
        # Step 2: Update streak
        db.execute(
            "UPDATE streaks SET count=?, updated_at=? WHERE user_id=?",
            (new_count, now_iso(), user_id)
        )
        
        # Step 3: Update user stats
        db.execute(
            "UPDATE users SET longest_streak=MAX(longest_streak, ?), updated_at=? WHERE id=?",
            (new_count, now_iso(), user_id)
        )
        
        # All steps succeed or all rollback
        return {"current_streak": new_count}
```

**Operations to Wrap:**
- tasks: complete_task (update + award points)
- nutrition: log_meal (create + update aggregation)
- streaks: update_streak (update + record history)
- workouts: record_workout (create + update stats)

**Checklist:**
- [ ] Identify all multi-step operations
- [ ] Wrap each in with transaction():
- [ ] Test that rollback works on error
- [ ] Verify atomicity with manual testing

---

## ✅ TESTING REQUIREMENTS

### Test File Structure
Create these test files:

```
tests/
  test_validators.py          # Validation tests
  test_repository_errors.py   # Error handling tests
  test_repository_transaction.py  # Transaction tests
  test_repository_task.py     # Task-specific tests
  test_repository_nutrition.py  # Nutrition-specific tests
  etc.
```

### Sample Test: Validation
```python
# tests/test_validators.py
import pytest
from app.validators import TaskValidator, ValidationError, safe_string


def test_task_validator_valid():
    """Test valid task input"""
    validator = TaskValidator(
        user_id=1,
        title="Buy groceries",
        description="Milk, bread, eggs"
    )
    assert validator.user_id == 1
    assert validator.title == "Buy groceries"


def test_task_validator_empty_title():
    """Test that empty title is rejected"""
    with pytest.raises(ValidationError, match="cannot be empty"):
        TaskValidator(user_id=1, title="")


def test_task_validator_long_title():
    """Test that very long title is rejected"""
    long_title = "x" * 501
    with pytest.raises(ValidationError, match="cannot exceed"):
        TaskValidator(user_id=1, title=long_title)


def test_task_validator_invalid_priority():
    """Test that invalid priority is rejected"""
    with pytest.raises(ValidationError, match="must be"):
        TaskValidator(user_id=1, title="Task", priority=999)


def test_safe_string_removes_html():
    """Test that HTML tags are removed"""
    result = safe_string("<script>alert('xss')</script>Hello", field_name="test")
    assert "script" not in result
    assert "Hello" in result
```

### Sample Test: Error Handling
```python
# tests/test_repository_errors.py
import pytest
from unittest.mock import patch
import sqlite3
from app.repositories.task_repo import TaskRepository
from app.db import retry_on_transient_error
from app.exceptions import RetryableError, ValidationError


def test_retry_on_locked_database():
    """Test that retries on database locked"""
    attempts = []
    
    @retry_on_transient_error(max_retries=3, backoff_ms=10)
    def always_locked():
        attempts.append(1)
        raise sqlite3.OperationalError("database is locked")
    
    with pytest.raises(RetryableError):
        always_locked()
    
    # Should have tried 3 times
    assert len(attempts) == 3


def test_no_retry_on_validation_error():
    """Test that validation errors don't retry"""
    attempts = []
    
    @retry_on_transient_error(max_retries=3)
    def validation_fails():
        attempts.append(1)
        raise ValidationError("Invalid input", field="title")
    
    with pytest.raises(ValidationError):
        validation_fails()
    
    # Should only try once
    assert len(attempts) == 1
```

---

## 🎯 COMPLETION CHECKLIST

### By End of Task 1 (Validation)
- [ ] `app/validators.py` created with all validators
- [ ] All repositories import and use validators
- [ ] All INSERT operations validate input
- [ ] All UPDATE operations validate input
- [ ] test_validators.py has >80% coverage
- [ ] No test failures

### By End of Task 2 (Error Handling)
- [ ] `app/exceptions.py` created with exception hierarchy
- [ ] Retry decorator implemented in db.py
- [ ] All repositories use @retry_on_transient_error
- [ ] test_repository_errors.py has >80% coverage
- [ ] Manual test: database locked → retry → success

### By End of Task 3 (Transactions)
- [ ] Transaction context manager in db.py
- [ ] All multi-step operations wrapped in `with transaction():`
- [ ] test_repository_transaction.py has >80% coverage
- [ ] Manual test: error mid-transaction → rollback verified

### Overall
- [ ] All 3 tasks complete
- [ ] Unit test coverage >80%
- [ ] Code review passed
- [ ] No merge conflicts
- [ ] Ready to merge to main

---

## 🚨 COMMON PITFALLS TO AVOID

❌ **Don't:**
- Catch all exceptions with bare `except:`
- Retry on ValidationError or IntegrityError
- Skip validation "just this once"
- Use raw database errors in API responses
- Forget to close transactions on error

✅ **Do:**
- Catch specific exception types
- Log all errors with context
- Validate every input parameter
- Return user-friendly error messages
- Use context managers for transactions

---

## 📞 WHEN YOU GET STUCK

1. **Validation questions?** → Check validators.py docstrings + examples
2. **Error handling questions?** → Check exceptions.py + retry_on_transient_error
3. **Transaction questions?** → Check db.py transaction() context manager
4. **Code review feedback?** → Ask on PR discussion
5. **Need help?** → Ask in daily standup (15 mins at 10am)

---

**Last Updated:** March 18, 2026  
**Status:** ✅ Ready to implement  
**Questions?** Slack #data-audit-team
