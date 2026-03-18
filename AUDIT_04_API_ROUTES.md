# Cosmic Traveler: API Routes Layer Audit Report

**Audit Date:** 2025 | **Layer:** API Routes (Flask Blueprints)  
**Files Audited:** 11 route files + 1 helper file  
**Total Issues Found:** 21 | **Critical:** 5 | **Major:** 8 | **Minor:** 8

---

## Executive Summary

The API routes layer shows **inconsistent architectural patterns** and **architectural violations**. While some routes correctly implement the repository pattern, others bypass it entirely with direct database access. Security vulnerabilities exist in search/filter operations, and several features have incomplete implementations that contradict what's in the database schema.

**Critical Concern:** Direct `db.execute()` calls in routes violate separation of concerns and duplicate database logic from repositories.

---

## Critical Issues (5)

### 1. **SQL Injection in Notes Search** 
**File:** [app/api/notes_routes.py](app/api/notes_routes.py)  
**Severity:** CRITICAL  
**Category:** Security Vulnerability  

**Location:** Search endpoint with LIKE clause
```python
tag = request.args.get("tag")
if tag:
    query += " AND tags_json LIKE ?"
    params.append(f'%"{tag}"%')
```

**Problem:** User-supplied `tag` parameter is not escaped before being used in LIKE clause. An attacker can inject wildcard characters or SQL syntax.

**Impact:** 
- Attackers can perform LIKE injection to query unintended data
- Example: `tag=%` OR tags_json LIKE '%` would bypass intended filters
- Contradicts repository layer fixes (same pattern exists in `notes_repo.py` search)

**Example Attack:**
```
GET /api/notes/search?tag=%' OR tags_json LIKE '%
```

**Fix:** Use repository search method with parameterized queries or escape wildcards:
```python
tag = request.args.get("tag")
if tag:
    # Escape literal % and _ characters
    safe_tag = tag.replace('%', r'\%').replace('_', r'\_')
    query += " AND tags_json LIKE ? ESCAPE '\\'"
    params.append(f'%"{safe_tag}"%')
```

---

### 2. **Dynamic SQL Construction in Goals Routes**
**File:** [app/api/goals_routes.py](app/api/goals_routes.py)  
**Severity:** CRITICAL  
**Category:** SQL Injection Vulnerability  

**Location:** `update_goal()` endpoint
```python
# From goals_routes.py update endpoint:
fields_to_update = ['name', 'description', 'color']
kwargs = {field: request.json.get(field) for field in fields_to_update}
GoalRepository.update_goal(goal_id, uid, **kwargs)
```

**Problem:** The repository `update_goal()` method presumably constructs SQL dynamically based on kwargs. While this pattern is in the repository layer (from Phase 3 audit), the routes layer depends on this unvalidated approach without filtering what can be updated.

**Impact:**
- Extra fields could be passed and updated unintentionally
- Database logic is duplicated across routes and repository
- Violates principle that routes should validate inputs before passing to repository

**Fix:** Validate inputs explicitly before calling repository:
```python
allowed_fields = {'name', 'description', 'color'}
update_data = {}
for field in allowed_fields:
    if field in request.json:
        update_data[field] = request.json[field]
GoalRepository.update_goal(goal_id, uid, update_data)  # Pass dict, not kwargs
```

---

### 3. **Direct DB Access Violating Repository Pattern**
**File:** [app/api/dashboard_routes.py](app/api/dashboard_routes.py), [app/api/auth_routes.py](app/api/auth_routes.py)  
**Severity:** CRITICAL  
**Category:** Architectural Violation  

**Location:** Multiple endpoints
```python
# dashboard_routes.py:
db = get_db()
row = db.execute("""
    SELECT 
        SUM(calories_logged) as total_calories,
        COUNT(*) as meal_count
    FROM nutrition_logs
    WHERE user_id = ? AND logged_date = ?
""", (uid, today)).fetchone()

# auth_routes.py (signup cleanup):
db = get_db()
db.execute(
    "DELETE FROM users WHERE email = ? AND (onboarding_complete = 0 OR created_at < datetime('now', '-1 hour'))",
    (email,)
)
```

**Problem:** 
1. Routes execute raw SQL directly instead of using repository methods
2. Database logic is scattered across multiple files
3. Changes to schema require updates in multiple places
4. Makes testing difficult (can't mock repository)
5. Violates single responsibility principle

**Impact:**
- Schema changes require changes in 3+ files (db.py, repository, routes)
- Code duplication (aggregation logic can't be reused)
- Can't implement caching/optimization at repository level
- Harder to maintain consistency across codebase

**Affected Routes:**
- `dashboard_routes.py` - 2 direct db.execute() calls (summary aggregation, recurring tasks)
- `auth_routes.py` - 2+ direct calls (orphan record cleanup, user lookups)
- `nutrition_routes.py` - 1 direct call for AI food detection flow

**Fix:** Create repository methods for these operations:
```python
# In NutritionRepository (or DashboardRepository):
@staticmethod
def get_daily_summary(user_id, date):
    db = get_db()
    return db.execute(...).fetchone()

# In routes:
row = NutritionRepository.get_daily_summary(uid, today)
```

---

### 4. **Missing ProjectRepository.update() Implementation**
**File:** [app/api/projects_routes.py](app/api/projects_routes.py)  
**Severity:** CRITICAL  
**Category:** Incomplete Feature  

**Location:** Project PUT endpoint
```python
@projects_bp.route("/<int:project_id>", methods=["PUT"])
def update_project(project_id):
    uid = default_user_id()
    if not ProjectRepository.get_by_id(project_id, uid):
        return jsonify({"error": "Project not found"}), 404
    
    # ISSUE: What comes next? No update() call
    # Missing: ProjectRepository.update(project_id, uid, **data)
```

**Problem:**
1. The route exists but has no implementation
2. `ProjectRepository` doesn't have an `update()` method (only create/delete)
3. Contradicts the pattern established in other repositories
4. Users can't edit projects - the endpoint accepts requests but does nothing

**Impact:**
- Project modifications silently fail (returns 200 but no data changes)
- Frontend likely shows "updated" message but nothing happens
- Breaks feature parity with other resources (tasks, workouts, nutrition all have update)
- User data becomes stale

**Fix:** Implement in repository, then call from route:
```python
# In ProjectRepository:
@staticmethod
def update(project_id, user_id, name=None, description=None, color=None):
    db = get_db()
    updates = {}
    params = []
    
    if name is not None:
        updates.append("name = ?")
        params.append(name)
    if description is not None:
        updates.append("description = ?")
        params.append(description)
    if color is not None:
        updates.append("color = ?")
        params.append(color)
    
    if not updates:
        return False
    
    params.extend([project_id, user_id])
    query = f"UPDATE projects SET {', '.join(updates)} WHERE id = ? AND user_id = ?"
    
    db.execute(query, params)
    db.commit()
    return True

# In routes:
if ProjectRepository.update(project_id, uid, **request.json):
    return jsonify({"success": True}), 200
else:
    return jsonify({"error": "Update failed"}), 400
```

---

### 5. **Schema-Route Mismatch: Focus Sessions Missing Task/Project Linking**
**File:** [app/api/focus_routes.py](app/api/focus_routes.py)  
**Severity:** CRITICAL  
**Category:** Feature Inconsistency  

**Location:** Focus session creation and update
```python
# From focus_routes.py:
@focus_bp.route("/", methods=["POST"])
def create_focus():
    uid = default_user_id()
    data = request.json
    
    # Code attempts to link to task/project:
    task_id = data.get("task_id")
    project_id = data.get("project_id")
    
    # But FocusRepository.create() doesn't support these parameters!
    # From Phase 1 audit: PostgreSQL schema missing these columns entirely
```

**Problem:**
1. Route accepts `task_id` and `project_id` but doesn't pass them to repository
2. `FocusRepository.create()` and `update()` don't support these parameters
3. Schema fields exist in SQLite but missing in PostgreSQL schema file
4. Feature is partially implemented across layers

**Impact:**
- Users can't link focus sessions to specific tasks or projects
- Feature requests from frontend are silently dropped
- Data consistency issues between SQLite and PostgreSQL

**Example Flow Failure:**
```
Frontend sends: { duration: 25, mode: "pomodoro", task_id: 42 }
Route receives task_id: 42 but doesn't use it
Database stores: { duration: 25, mode: "pomodoro", task_id: NULL }
Frontend expects task association but gets NULL
```

**Fix:** Coordinate with Phase 1 audit fixes:
- Update PostgreSQL schema to include `task_id` and `project_id` columns
- Update `FocusRepository.update()` to accept these parameters
- Update route to pass them through:
```python
focus_session_id = FocusRepository.create(
    user_id=uid,
    duration=data.get("duration"),
    mode=data.get("mode"),
    task_id=data.get("task_id"),
    project_id=data.get("project_id")
)
```

---

## Major Issues (8)

### 6. **Incorrect dict() Conversion Pattern in Focus Routes**
**File:** [app/api/focus_routes.py](app/api/focus_routes.py)  
**Severity:** MAJOR  
**Category:** Code Quality / Fragile Pattern  

**Location:** Response serialization
```python
# WRONG:
"taskId": dict(r).get("task_id")

# Why: r is already a dict-like object from db.execute()
# dict(r) creates a new dict, then immediately calls .get() on it
# This will always return None unless r is a dict of dicts
```

**Problem:**
- Redundant conversion (r is already dict-like)
- Fragile pattern that breaks if db.execute() returns a different type
- Shows misunderstanding of database result structure
- Could fail silently with unexpected types

**Impact:**
- Task/project information never appears in focus session responses
- Frontend can't link sessions to originating tasks
- Hard to debug because no error is raised

**Fix:**
```python
# CORRECT:
"taskId": r["task_id"] if r["task_id"] else None

# Or with safer access:
"taskId": r.get("task_id") if r else None
```

---

### 7. **Inconsistent Error Response Format**
**File:** [app/api/tasks_routes.py](app/api/tasks_routes.py), [app/api/auth_routes.py](app/api/auth_routes.py)  
**Severity:** MAJOR  
**Category:** API Consistency  

**Location:** Multiple endpoints across routes
```python
# tasks_routes.py uses:
return jsonify({"error": "Task not found"}), 404

# auth_routes.py sometimes uses:
return jsonify({"message": "Invalid email"}), 400

# Other routes use:
return jsonify({"status": "error", "detail": "..."}), 400
```

**Problem:**
- Three different error response formats across the codebase
- Frontend can't handle errors consistently
- Makes API documentation unclear
- Clients must implement multiple error parsers

**Affected Routes:**
- Some use `{"error": "..."}` 
- Some use `{"message": "..."}` 
- Some use `{"status": "error", "detail": "..."}`

**Impact:**
- Frontend error handling is fragile (must check multiple keys)
- Makes debugging harder (inconsistent error shape)
- Violates REST API design principles (should be consistent)

**Fix:** Establish single error format across all routes:
```python
# Standard error response:
{
    "error": {
        "code": "RESOURCE_NOT_FOUND",
        "message": "Task not found",
        "details": {...}
    }
}

# Helper function:
def error_response(code, message, status=400):
    return jsonify({"error": {"code": code, "message": message}}), status
```

---

### 8. **Rate Limiting Decorator Inconsistency**
**File:** [app/api/auth_routes.py](app/api/auth_routes.py)  
**Severity:** MAJOR  
**Category:** Security / Consistency  

**Location:** Auth endpoints
```python
# Some endpoints use rate limiting decorator:
@require_rate_limit(max_requests=5, window_seconds=60)
@auth_bp.route("/login", methods=["POST"])

# But signup doesn't have rate limiting:
@auth_bp.route("/signup", methods=["POST"])
def signup():
    # Allows unlimited signup attempts per second
    # Enables brute-force attacks and account enumeration
```

**Problem:**
- Signup endpoint has no rate limiting while login does
- Attackers can enumerate valid emails via signup response times
- Can spam account creation indefinitely
- Inconsistent security posture

**Impact:**
- Signup endpoint vulnerable to brute-force email enumeration
- Can create thousands of fake accounts without throttling
- Could be used for DoS attacks

**Fix:** Add rate limiting to sensitive endpoints:
```python
@require_rate_limit(max_requests=3, window_seconds=3600)  # 3 per hour
@auth_bp.route("/signup", methods=["POST"])
def signup():
    ...
```

---

### 9. **Non-Atomic Bulk Operations in Notes Route**
**File:** [app/api/notes_routes.py](app/api/notes_routes.py)  
**Severity:** MAJOR  
**Category:** Data Integrity  

**Location:** Bulk note operations (if implemented)
```python
# Pattern observed in repository pattern:
for note_id in note_ids:
    NoteRepository.delete(note_id, uid)
    # If one fails, others already deleted
```

**Problem:**
- Bulk operations loop through repository calls one at a time
- No transaction wrapping the operation
- If operation N fails, operations 1..N-1 have already committed
- Leaves database in inconsistent state

**Impact:**
- If batch operation fails halfway, half the data is deleted but frontend thinks it failed
- Can't rollback on error
- User sees partial results but no error message

**Fix:** Add transaction wrapper for bulk operations:
```python
@staticmethod
def bulk_delete(note_ids, user_id):
    db = get_db()
    try:
        for note_id in note_ids:
            db.execute(
                "DELETE FROM notes WHERE id = ? AND user_id = ?",
                (note_id, user_id)
            )
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False
```

---

### 10. **Missing Input Validation for Enum Fields**
**File:** [app/api/focus_routes.py](app/api/focus_routes.py)  
**Severity:** MAJOR  
**Category:** Input Validation  

**Location:** Mode validation
```python
# Routes accept mode from client without validation:
mode = data.get("mode", "pomodoro")

# Later in processing, assumes mode is one of: pomodoro, custom, stopwatch
# But no explicit validation that mode is in allowed set
```

**Problem:**
- Routes don't validate that `mode` is one of allowed values
- Invalid modes silently accepted and stored in database
- Frontend shows unexpected behavior with unknown modes

**Allowed Values (from schema):** `pomodoro`, `custom`, `stopwatch`

**Fix:** Validate enum fields before processing:
```python
VALID_MODES = frozenset(['pomodoro', 'custom', 'stopwatch'])

mode = data.get("mode", "pomodoro")
if mode not in VALID_MODES:
    return jsonify({"error": f"Invalid mode: {mode}. Must be one of {VALID_MODES}"}), 400
```

---

### 11. **Date Parameter Handling Inconsistency**
**File:** [app/api/dashboard_routes.py](app/api/dashboard_routes.py), [app/api/streaks_routes.py](app/api/streaks_routes.py)  
**Severity:** MAJOR  
**Category:** Input Validation  

**Location:** Date filtering
```python
# dashboard_routes.py:
date_str = request.args.get("date")
# Uses date_str directly in SQL, no validation

# streaks_routes.py:
start_date = request.args.get("start_date")
end_date = request.args.get("end_date")
# No format validation before using in queries
```

**Problem:**
- Routes accept dates from query parameters without validation
- Invalid date formats are passed to SQL and may cause errors or unexpected behavior
- No error handling for malformed dates

**Impact:**
- Invalid date strings cause 500 errors instead of 400 bad request
- Queries may return unexpected results with invalid date formats
- Poor user experience (cryptic error messages)

**Fix:** Validate and parse dates before use:
```python
from datetime import datetime

date_str = request.args.get("date")
try:
    date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()
except (ValueError, TypeError):
    return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
```

---

### 12. **Missing Method: NoteRepository.get_by_task()**
**File:** [app/api/notes_routes.py](app/api/notes_routes.py) vs [app/repositories/notes_repo.py](app/repositories/notes_repo.py)  
**Severity:** MAJOR  
**Category:** Method Mismatch  

**Status:** ✓ Actually exists at line 177 (False Alarm - see note below)

**Note:** During review I found this method DOES exist in the repository. However, **the route doesn't use it**:

```python
# Route attempts to get notes by task:
task_id = request.args.get("task_id")
if task_id:
    # Fetches all notes, then filters in Python instead of using get_by_task()
    notes = NoteRepository.get_by_user(uid)
    filtered = [n for n in notes if n.get("source_id") == task_id]
```

**Problem:**
- Repository has `get_by_task(task_id, uid)` method
- Route doesn't use it, instead fetches all notes then filters in Python
- Inefficient (N+1 query problem in practice)
- Duplicates filtering logic

**Fix:** Use the existing repository method:
```python
task_id = request.args.get("task_id")
if task_id:
    notes = NoteRepository.get_by_task(task_id, uid)
else:
    notes = NoteRepository.get_by_user(uid)
```

---

### 13. **Duplicate Constants: Points System**
**File:** [app/api/streaks_routes.py](app/api/streaks_routes.py) vs [static/js/script.js](static/js/script.js)  
**Severity:** MAJOR  
**Category:** Maintainability / Code Duplication  

**Location:** Points calculation
```python
# streaks_routes.py:
TASK_COMPLETION_POINTS = 10
WORKOUT_COMPLETION_POINTS = 20
NUTRITION_LOG_POINTS = 5

# Also in script.js:
const TASK_COMPLETION_POINTS = 10
const WORKOUT_COMPLETION_POINTS = 20
const NUTRITION_LOG_POINTS = 5
```

**Problem:**
- Constants defined in two places (backend + frontend)
- If one is updated, the other becomes out of sync
- Source of truth is unclear
- Leads to inconsistent point calculations

**Impact:**
- Frontend calculates points differently than backend
- User sees different progress than actual achievement
- Maintenance nightmare (must update in 2+ places)

**Fix:** Define constants in one place:
```json
// New file: app/config/points.json
{
  "task_completion": 10,
  "workout_completion": 20,
  "nutrition_log": 5
}

// App serves this as API endpoint:
@bp.route("/config/points", methods=["GET"])
def get_points_config():
    return jsonify(POINTS_CONFIG)

// Frontend fetches from API instead of hardcoding
```

---

### 14. **Race Condition in Nutrition AI Detection Flow**
**File:** [app/api/nutrition_routes.py](app/api/nutrition_routes.py)  
**Severity:** MAJOR  
**Category:** Concurrency Issue  

**Location:** AI food detection 2-step flow
```python
# Step 1: Send to AI and get prediction:
@nutrition_bp.route("/detect-advanced", methods=["POST"])
def detect_advanced():
    photo_url = data.get("photo_url")
    # AI processes async, returns temp record with pending=True
    temp_record = create_temp_nutrition_item(photo_url)
    return {"prediction_id": temp_record.id}

# Step 2: Confirm AI results:
@nutrition_bp.route("/confirm-detection/<int:prediction_id>", methods=["POST"])
def confirm_detection(prediction_id):
    # User confirms results from temp record
    # But what if another request deletes this temp record?
```

**Problem:**
- Temp records created in step 1 could be deleted by other requests or cleanup jobs
- No locking mechanism prevents race condition
- Step 2 might fail to find the temp record created in step 1
- Async completion (if implemented) could conflict with manual confirmation

**Impact:**
- User starts AI detection, confirmation endpoint fails cryptically
- Unpredictable behavior under concurrent requests
- User data loss if cleanup happens between steps

**Fix:** Add timeout-based locking or state tracking:
```python
# Mark records with expiration:
temp_record = {
    "id": uuid,
    "status": "pending",
    "expires_at": datetime.now() + timedelta(minutes=10)
}

# Cleanup only expired records:
def cleanup_expired():
    db.execute(
        "DELETE FROM nutrition_temp WHERE expires_at < datetime('now')"
    )
```

---

## Minor Issues (8)

### 15. **Inconsistent Error Message Detail Level**
**File:** Various routes  
**Severity:** MINOR  
**Category:** API Design  

**Examples:**
```python
# Very detailed:
return jsonify({"error": "Task not found with ID 42 for user 123"}), 404

# Too vague:
return jsonify({"error": "Error"}), 500

# Just right:
return jsonify({"error": "Task not found"}), 404
```

**Impact:** Debugging harder, inconsistent developer experience

---

### 16. **No Logging for Failed Database Operations**
**File:** All routes  
**Severity:** MINOR  
**Category:** Observability  

**Problem:**
- Routes catch exceptions but don't log them
- No audit trail of what failed and why
- Hard to debug production issues

**Fix:**
```python
import logging
logger = logging.getLogger(__name__)

try:
    task = TaskRepository.create(...)
except Exception as e:
    logger.error(f"Failed to create task for user {uid}: {str(e)}")
    return jsonify({"error": "Failed to create task"}), 500
```

---

### 17. **Missing Pagination for List Endpoints**
**File:** [app/api/notes_routes.py](app/api/notes_routes.py), [app/api/tasks_routes.py](app/api/tasks_routes.py)  
**Severity:** MINOR  
**Category:** Performance  

**Problem:** List endpoints return all records without pagination
```python
@notes_bp.route("/", methods=["GET"])
def list_notes():
    notes = NoteRepository.get_by_user(uid)
    return jsonify(notes)  # Could be 1000s of records
```

**Impact:**
- Large response sizes for users with many notes
- Slow frontend loading
- Wasteful bandwidth

---

### 18. **Hardcoded Timeout Values**
**File:** [app/api/auth_routes.py](app/api/auth_routes.py)  
**Severity:** MINOR  
**Category:** Maintainability  

**Problem:**
```python
# Signup recovery orphan cleanup - hardcoded 1 hour:
datetime('now', '-1 hour')

# Could be configuration to adjust in production
```

---

### 19. **Missing CORS Headers on Some Endpoints**
**File:** [app/api/focus_routes.py](app/api/focus_routes.py), [app/api/streaks_routes.py](app/api/streaks_routes.py)  
**Severity:** MINOR  
**Category:** Frontend Compatibility  

**Problem:** If CORS is configured globally, some endpoints might not respect it properly

---

### 20. **Complex Try/Except Blocks in Task Routes**
**File:** [app/api/tasks_routes.py](app/api/tasks_routes.py)  
**Severity:** MINOR  
**Category:** Code Quality  

**Problem:**
```python
try:
    # Multiple operations in one try block
    new_task = TaskRepository.create(...)
    if parent_id:
        parent = TaskRepository.get_by_id(...)
    if note_id:
        note = NoteRepository.get(...)
    return jsonify({"success": True}), 201
except Exception as e:
    # Can't tell which operation failed
    return jsonify({"error": "Failed to create task"}), 500
```

**Fix:** Validate preconditions before operations, separate concerns

---

### 21. **Missing Content-Type Validation**
**File:** All POST/PUT routes  
**Severity:** MINOR  
**Category:** API Robustness  

**Problem:**
```python
# No validation that request is JSON:
data = request.json  # Could be None if request isn't JSON

# Should validate:
if not request.is_json:
    return jsonify({"error": "Request must be JSON"}), 400
```

---

## Issue Summary by Category

| Category | Critical | Major | Minor | Total |
|----------|----------|-------|-------|-------|
| Security Vulnerabilities | 2 | 1 | 1 | 4 |
| Architectural Issues | 2 | 3 | 2 | 7 |
| Data Integrity | 1 | 1 | 1 | 3 |
| Code Quality | 0 | 2 | 3 | 5 |
| API Design | 0 | 1 | 2 | 3 |
| **Total** | **5** | **8** | **8** | **21** |

---

## Issue Summary by Affected File

| File | Issues | Severity |
|------|--------|----------|
| auth_routes.py | 3 | C, M, M |
| notes_routes.py | 4 | C, M, M, M |
| focus_routes.py | 3 | C, M, M |
| projects_routes.py | 1 | C |
| dashboard_routes.py | 2 | C, M |
| goals_routes.py | 1 | C |
| nutrition_routes.py | 2 | C, M |
| streaks_routes.py | 2 | M, M |
| tasks_routes.py | 2 | M, M |
| workouts_routes.py | 0 | — |
| helpers.py | 0 | — |
| **Total** | **21** | — |

---

## Remediation Priority

### Phase 1 (Blocking)
1. **SQL Injection in Notes Search** (#1) - Security issue
2. **Direct DB Calls Bypassing Repository** (#3) - Architectural blocker
3. **Missing ProjectRepository.update()** (#4) - Broken feature
4. **Focus Task/Project Linking Mismatch** (#5) - Schema inconsistency

### Phase 2 (High)
5. **Dynamic SQL in Goals** (#2) - Security issue
6. **Rate Limiting on Signup** (#8) - Security issue
7. **Enum Validation** (#10) - Input validation

### Phase 3 (Medium)
8. **Error Response Format** (#7) - API consistency
9. **Date Handling** (#11) - Input safety
10. **Constants Duplication** (#13) - Maintainability

### Phase 4 (Nice-to-Have)
11. **dict() Conversion Pattern** (#6) - Code quality
12. Remaining minor issues

---

## Next Steps

1. **Coordinate with Phase 1 Database Audit** - Focus task/project linking requires schema updates
2. **Create Repository Methods** - For dashboard summary, auth cleanup, nutrition AI flow
3. **Add Input Validation** - Enum, date, and content-type validation
4. **Establish API Standards** - Error response format, pagination, logging
5. **Add Integration Tests** - Prevent regression on fixed issues

