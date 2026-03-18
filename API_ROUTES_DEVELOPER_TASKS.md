# API ROUTES AUDIT — DEVELOPER IMPLEMENTATION TASKS

**Project:** Cosmic Traveler - AI Avatar Fitness Application  
**Phase:** 4 - API Routes  
**Document Type:** Implementation Guide with Code Templates  
**Date:** March 18, 2026

---

## 🎯 HOW TO USE THIS DOCUMENT

This document is a step-by-step implementation guide for fixing all identified API Routes issues. Each section includes:

- **Current Problem** - What's wrong
- **Code Example** - What the buggy code looks like
- **Solution** - How to fix it
- **Code Template** - Ready-to-use code
- **Tests** - How to verify it works
- **Checklist** - Completion tasks

---

## CRITICAL ISSUES (Week 1)

---

## CRITICAL-01: SQL Injection in Notes Search

**Files:** [app/api/notes_routes.py](app/api/notes_routes.py)  
**Severity:** 🔴 CRITICAL  
**Security Impact:** HIGH - Allows search manipulation  
**Effort:** 2-3 hours  
**Owner:** [Assign: Security developer]

### The Problem

The notes search endpoint doesn't escape special characters in the search `tag` parameter, allowing users to inject SQL wildcards (`%`, `_`) that bypass intended search logic.

### Current Code (Vulnerable)

```python
# app/api/notes_routes.py - Current implementation
@notes_bp.route("/search", methods=["GET"])
def search_notes():
    uid = default_user_id()
    query = "SELECT * FROM notes WHERE user_id = ?"
    params = [uid]
    
    tag = request.args.get("tag")
    if tag:
        query += " AND tags_json LIKE ?"
        params.append(f'%"{tag}"%')  # ❌ VULNERABLE: tag not escaped!
    
    # User can inject: tag=%", which breaks the LIKE pattern
    notes = get_db().execute(query, params).fetchall()
    return jsonify(notes)
```

### The Fix

**Step 1:** Escape wildcard characters  
**Step 2:** Use ESCAPE clause in SQL  
**Step 3:** Validate input length

### Solution Code

```python
# app/api/notes_routes.py - Fixed implementation
@notes_bp.route("/search", methods=["GET"])
def search_notes():
    uid = get_current_user_id()  # Use proper auth
    
    query = "SELECT * FROM notes WHERE user_id = ?"
    params = [uid]
    
    tag = request.args.get("tag", "").strip()
    if tag:
        # Validate tag length first
        if len(tag) > 100:
            return jsonify({"error": "Tag too long (max 100 chars)"}), 400
        
        # Escape special LIKE characters
        # % matches any sequence, _ matches single char
        # We need to escape these to search literally
        safe_tag = tag.replace('\\', '\\\\')  # Escape backslash first
        safe_tag = safe_tag.replace('%', r'\%')  # Escape percent
        safe_tag = safe_tag.replace('_', r'\_')  # Escape underscore
        
        # Add ESCAPE clause to SQL
        query += " AND tags_json LIKE ? ESCAPE '\\'"
        params.append(f'%"{safe_tag}"%')
    
    try:
        notes = get_db().execute(query, params).fetchall()
        return jsonify({"notes": notes, "count": len(notes)}), 200
    except Exception as e:
        logger.exception(f"Notes search failed for user {uid}")
        return jsonify({"error": "Search failed"}), 500
```

### Create Helper Utility

Better approach: Create a reusable utility function:

```python
# app/utils.py - Add this function
def escape_sql_like(text, escape_char='\\'):
    """Escape text for use in SQL LIKE clause
    
    Args:
        text: String to escape
        escape_char: Character to use for escaping (default: backslash)
    
    Returns:
        Tuple of (escaped_text, escape_clause_sql)
    
    Example:
        safe_text, escape_sql = escape_sql_like("hello_world")
        query += f" AND title LIKE ? {escape_sql}"
        params.append(f"%{safe_text}%")
    """
    # Escape the escape character first
    text = text.replace(escape_char, escape_char + escape_char)
    # Escape wildcards
    text = text.replace('%', escape_char + '%')
    text = text.replace('_', escape_char + '_')
    
    escape_clause = f"ESCAPE '{escape_char}'"
    return text, escape_clause
```

Then use it:

```python
@notes_bp.route("/search", methods=["GET"])
def search_notes():
    uid = get_current_user_id()
    tag = request.args.get("tag", "").strip()
    
    if tag:
        if len(tag) > 100:
            return jsonify({"error": "Tag too long"}), 400
        
        safe_tag, escape_clause = escape_sql_like(tag)
        
        query = f"SELECT * FROM notes WHERE user_id = ? AND tags_json LIKE ? {escape_clause}"
        params = [uid, f'%"{safe_tag}"%']
    else:
        query = "SELECT * FROM notes WHERE user_id = ?"
        params = [uid]
    
    try:
        notes = get_db().execute(query, params).fetchall()
        return jsonify({"notes": notes}), 200
    except Exception:
        logger.exception("Notes search failed")
        return jsonify({"error": "Search failed"}), 500
```

### Write Tests

```python
# tests/test_notes_routes.py - Add these tests
import pytest
from app.utils import escape_sql_like

def test_escape_sql_like():
    """Test SQL LIKE escaping"""
    # Normal text should not be modified
    text, escape = escape_sql_like("hello")
    assert text == "hello"
    assert escape == "ESCAPE '\\'"
    
    # Wildcards should be escaped
    text, escape = escape_sql_like("hello%world")
    assert text == "hello\\%world"
    assert "%" not in text or text.count("%") == 0
    
    text, escape = escape_sql_like("hello_world")
    assert text == "hello\\_world"

def test_search_notes_prevents_injection():
    """Test that search prevents SQL injection via wildcards"""
    client = app.test_client()
    
    # Try to inject wildcard to match anything
    response = client.get("/api/notes/search?tag=%")
    assert response.status_code == 200  # Should work
    
    # Inject attempt should not match everything
    # This is harder to test directly, but we can verify escaping happens
    assert response.json.get("count", 0) == 0  # Should not match unintended notes

def test_search_notes_max_tag_length():
    """Test tag length validation"""
    client = app.test_client()
    
    long_tag = "a" * 101
    response = client.get(f"/api/notes/search?tag={long_tag}")
    
    assert response.status_code == 400
    assert "too long" in response.json.get("error", "").lower()

def test_search_notes_normal_operation():
    """Test normal search still works"""
    client = app.test_client()
    
    # Create test note with tag
    # Then search for it
    response = client.get("/api/notes/search?tag=task")
    assert response.status_code == 200
    assert "notes" in response.json
```

### Verification Checklist

- [ ] Code compiles without syntax errors
- [ ] All tests pass (including new injection tests)
- [ ] Search still works for normal tags
- [ ] Edge cases handled: special chars, long strings, empty tag
- [ ] Error messages are user-friendly
- [ ] Logging captures failures
- [ ] Code reviewed by 2 developers
- [ ] No performance regression (response time < 200ms)

---

## CRITICAL-02: Direct DB Access in Dashboard/Auth Routes

**Files:** [app/api/dashboard_routes.py](app/api/dashboard_routes.py), [app/api/auth_routes.py](app/api/auth_routes.py)  
**Severity:** 🔴 CRITICAL  
**Architectural Impact:** HIGH - Violates repository pattern  
**Effort:** 4-6 hours  
**Owner:** [Assign: Backend Architect + 1 Developer]

### The Problem

Multiple routes bypass the repository pattern and execute SQL directly. This violates the clean architecture, causes code duplication, and makes testing harder.

### Current Anti-Pattern

```python
# dashboard_routes.py - BAD PATTERN
@dashboard_bp.route("/daily-summary")
def get_daily_summary():
    uid = default_user_id()
    db = get_db()  # Direct DB access!
    
    row = db.execute("""
        SELECT 
            SUM(calories_logged) as total_calories,
            SUM(water_liters) as total_water
        FROM nutrition_logs
        WHERE user_id = ? AND logged_date = ?
    """, (uid, today)).fetchone()
    
    return jsonify({"calories": row['total_calories']})
```

### The Solution: Create DashboardRepository

**Step 1: Create file** [app/repositories/dashboard_repo.py](app/repositories/dashboard_repo.py)

```python
# app/repositories/dashboard_repo.py - NEW FILE
from datetime import datetime
from app.db import get_db

class DashboardRepository:
    """Repository for dashboard aggregation queries
    
    This centralizes all dashboard data queries,
    removing direct DB access from routes.
    """
    
    @staticmethod
    def get_daily_summary(user_id, date_str):
        """
        Get daily nutrition and activity summary
        
        Args:
            user_id: User ID
            date_str: Date in YYYY-MM-DD format
        
        Returns:
            Dict with nutrition and activity stats
        """
        db = get_db()
        
        try:
            # Nutrition stats
            nutrition = db.execute("""
                SELECT
                    COALESCE(SUM(calories_logged), 0) as total_calories,
                    COALESCE(SUM(protein_g), 0) as total_protein,
                    COALESCE(SUM(carbs_g), 0) as total_carbs,
                    COALESCE(SUM(fat_g), 0) as total_fat,
                    COALESCE(SUM(water_liters), 0) as total_water,
                    COUNT(*) as log_count
                FROM nutrition_logs
                WHERE user_id = ? AND logged_date = ?
            """, (user_id, date_str)).fetchone()
            
            # Task stats
            tasks = db.execute("""
                SELECT
                    COALESCE(COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END), 0) as completed,
                    COALESCE(COUNT(*), 0) as total
                FROM tasks
                WHERE user_id = ? AND DATE(created_at) = ?
            """, (user_id, date_str)).fetchone()
            
            # Workout stats
            workouts = db.execute("""
                SELECT
                    COALESCE(COUNT(*), 0) as count,
                    COALESCE(SUM(duration_minutes), 0) as total_minutes,
                    COALESCE(SUM(calories_burned), 0) as total_calories
                FROM workouts
                WHERE user_id = ? AND DATE(created_at) = ?
            """, (user_id, date_str)).fetchone()
            
            return {
                "nutrition": {
                    "calories": nutrition['total_calories'],
                    "protein": nutrition['total_protein'],
                    "carbs": nutrition['total_carbs'],
                    "fat": nutrition['total_fat'],
                    "water": nutrition['total_water'],
                    "log_count": nutrition['log_count']
                },
                "tasks": {
                    "completed": tasks['completed'],
                    "total": tasks['total']
                },
                "workouts": {
                    "count": workouts['count'],
                    "total_minutes": workouts['total_minutes'],
                    "calories": workouts['total_calories']
                }
            }
        except Exception as e:
            logger.exception(f"Failed to get daily summary for user {user_id}")
            raise
    
    @staticmethod
    def get_weekly_summary(user_id, start_date_str, end_date_str):
        """
        Get weekly aggregated summary
        
        Args:
            user_id: User ID
            start_date_str: Start date YYYY-MM-DD
            end_date_str: End date YYYY-MM-DD
        
        Returns:
            Dict with weekly stats
        """
        db = get_db()
        
        try:
            nutrition = db.execute("""
                SELECT
                    DATE(logged_date) as date,
                    COALESCE(SUM(calories_logged), 0) as total_calories
                FROM nutrition_logs
                WHERE user_id = ? AND logged_date BETWEEN ? AND ?
                GROUP BY DATE(logged_date)
                ORDER BY logged_date
            """, (user_id, start_date_str, end_date_str)).fetchall()
            
            return {
                "dates": len(nutrition),
                "daily_calories": [
                    {"date": row['date'], "calories": row['total_calories']}
                    for row in nutrition
                ]
            }
        except Exception as e:
            logger.exception(f"Failed to get weekly summary for user {user_id}")
            raise
    
    @staticmethod
    def get_recurring_tasks_due(user_id, date_str):
        """
        Get recurring tasks due on a specific date
        
        Args:
            user_id: User ID
            date_str: Date YYYY-MM-DD
        
        Returns:
            List of task dicts
        """
        db = get_db()
        
        try:
            tasks = db.execute("""
                SELECT * FROM tasks
                WHERE user_id = ? 
                    AND is_recurring = 1
                    AND DATE(due_date) = ?
                    AND (completed_at IS NULL OR DATE(completed_at) != ?)
                ORDER BY priority DESC
            """, (user_id, date_str, date_str)).fetchall()
            
            return [dict(task) for task in tasks]
        except Exception as e:
            logger.exception(f"Failed to get recurring tasks for user {user_id}")
            raise
```

**Step 2: Update dashboard_routes.py to use the repository**

```python
# app/api/dashboard_routes.py - UPDATED
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from app.utils import get_current_user_id, now_iso
from app.repositories.dashboard_repo import DashboardRepository

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')

@dashboard_bp.route("/daily-summary")
def get_daily_summary():
    """Get daily nutrition, task, and workout summary"""
    uid = get_current_user_id()
    
    # Get date from query params or use today
    date_str = request.args.get("date")
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
    
    # Validate date format
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format (use YYYY-MM-DD)"}), 400
    
    try:
        summary = DashboardRepository.get_daily_summary(uid, date_str)
        return jsonify({
            "success": True,
            "date": date_str,
            "summary": summary
        }), 200
    except Exception as e:
        logger.exception("Daily summary failed")
        return jsonify({"error": "Failed to get summary"}), 500

@dashboard_bp.route("/weekly-summary")
def get_weekly_summary():
    """Get weekly aggregated summary"""
    uid = get_current_user_id()
    
    # Default: last 7 days
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    
    # Override with query params
    start_date = request.args.get("start_date", start_date)
    end_date = request.args.get("end_date", end_date)
    
    try:
        datetime.strptime(start_date, "%Y-%m-%d")
        datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400
    
    try:
        summary = DashboardRepository.get_weekly_summary(uid, start_date, end_date)
        return jsonify({
            "success": True,
            "period": f"{start_date} to {end_date}",
            "summary": summary
        }), 200
    except Exception:
        logger.exception("Weekly summary failed")
        return jsonify({"error": "Failed to get summary"}), 500

@dashboard_bp.route("/recurring-tasks")
def get_recurring_tasks():
    """Get recurring tasks due today"""
    uid = get_current_user_id()
    
    date_str = request.args.get("date")
    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
    
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400
    
    try:
        tasks = DashboardRepository.get_recurring_tasks_due(uid, date_str)
        return jsonify({
            "success": True,
            "date": date_str,
            "count": len(tasks),
            "tasks": tasks
        }), 200
    except Exception:
        logger.exception("Getting recurring tasks failed")
        return jsonify({"error": "Failed to get tasks"}), 500
```

**Step 3: Extract auth cleanup to repository**

```python
# app/repositories/user_repo.py - ADD THIS METHOD
@staticmethod
def cleanup_orphan_records(user_id):
    """
    Delete all records for a user (cascade delete)
    Used when account is deleted.
    
    Args:
        user_id: User ID to clean up
    """
    db = get_db()
    
    try:
        # Delete in dependency order
        db.execute("DELETE FROM nutrition_logs WHERE user_id = ?", (user_id,))
        db.execute("DELETE FROM workouts WHERE user_id = ?", (user_id,))
        db.execute("DELETE FROM tasks WHERE user_id = ?", (user_id,))
        db.execute("DELETE FROM notes WHERE user_id = ?", (user_id,))
        db.execute("DELETE FROM goals WHERE user_id = ?", (user_id,))
        db.execute("DELETE FROM focus_sessions WHERE user_id = ?", (user_id,))
        db.execute("DELETE FROM users WHERE id = ?", (user_id,))
        db.commit()
        
        logger.info(f"Cleaned up all records for user {user_id}")
        return True
    except Exception as e:
        logger.exception(f"Cleanup failed for user {user_id}")
        db.rollback()
        raise
```

Then use it in auth_routes:

```python
# app/api/auth_routes.py - USE REPOSITORY
from app.repositories.user_repo import UserRepository

@auth_bp.route("/delete-account", methods=["DELETE"])
def delete_account():
    """Delete user account and all associated data"""
    uid = get_current_user_id()
    
    try:
        UserRepository.cleanup_orphan_records(uid)
        return jsonify({"success": True}), 200
    except Exception:
        logger.exception("Account deletion failed")
        return jsonify({"error": "Deletion failed"}), 500
```

### Tests

```python
# tests/test_dashboard_repo.py
def test_get_daily_summary():
    """Test daily summary aggregation"""
    user_id = create_test_user()
    date_str = "2024-03-15"
    
    # Create test data
    NutritionRepository.create(user_id, date_str, 500, 20, 50, 15, 2.0)
    
    # Get summary
    summary = DashboardRepository.get_daily_summary(user_id, date_str)
    
    assert summary["nutrition"]["calories"] == 500
    assert summary["nutrition"]["protein"] == 20

def test_get_weekly_summary():
    """Test weekly aggregation"""
    user_id = create_test_user()
    
    # Create multiple days of data
    for i in range(7):
        date = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        NutritionRepository.create(user_id, date, 500 + i*10)
    
    # Get summary
    summary = DashboardRepository.get_weekly_summary(
        user_id,
        "2024-03-08",
        "2024-03-15"
    )
    
    assert summary["dates"] == 7
```

### Verification Checklist

- [ ] DashboardRepository created with all methods
- [ ] dashboard_routes uses repository (no direct DB)
- [ ] auth_routes uses UserRepository
- [ ] All tests pass
- [ ] Routes return same data as before (no changes to API)
- [ ] Error handling is consistent
- [ ] No N+1 query problems
- [ ] Performance meets requirements (< 200ms)

---

## CRITICAL-03: Missing ProjectRepository.update()

**Files:** [app/repositories/projects_repo.py](app/repositories/projects_repo.py), [app/api/projects_routes.py](app/api/projects_routes.py)  
**Severity:** 🔴 CRITICAL  
**Feature Impact:** Users cannot edit projects  
**Effort:** 1-2 hours  
**Owner:** [Assign: 1 Backend Developer]

### The Problem

The Projects PUT endpoint tries to update a project but the repository method doesn't exist.

### Current Code

```python
# app/api/projects_routes.py - Incomplete

@projects_bp.route("/<int:project_id>", methods=["PUT"])
def update_project(project_id):
    uid = default_user_id()
    
    # ❌ BROKEN: get_by_id returns a project, but there's no update() method!
    if not ProjectRepository.get_by_id(project_id, uid):
        return jsonify({"error": "Project not found"}), 404
    
    data = request.get_json() or {}
    
    # ❌ This method doesn't exist:
    # ProjectRepository.update(project_id, uid, **data)
    
    return jsonify({"error": "Not implemented"}), 501
```

### Solution

**Implement ProjectRepository.update()**

```python
# app/repositories/projects_repo.py - ADD THIS METHOD

@staticmethod
def update(project_id, user_id, **updates):
    """
    Update a project
    
    Args:
        project_id: ID of project to update
        user_id: User ID (ownership check)
        **updates: Fields to update (name, description, color)
    
    Returns:
        True if updated, False if no changes
    
    Raises:
        ValueError: If project not found or invalid data
    """
    # Whitelist allowed fields
    ALLOWED_FIELDS = {'name', 'description', 'color'}
    
    # Filter to only allowed fields
    validated = {}
    for field in ALLOWED_FIELDS:
        if field in updates and updates[field] is not None:
            value = updates[field].strip() if isinstance(updates[field], str) else updates[field]
            
            # Validate field-specific constraints
            if field == 'name':
                if not value or len(value) > 100:
                    raise ValueError(f"Name must be 1-100 chars, got {len(value)}")
                validated['name'] = value
            
            elif field == 'description':
                if len(value) > 500:
                    raise ValueError("Description max 500 chars")
                validated['description'] = value
            
            elif field == 'color':
                # Valid colors: hex codes or predefined names
                valid_colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange']
                if value not in valid_colors and not (
                    value.startswith('#') and len(value) == 7
                ):
                    raise ValueError(f"Invalid color: {value}")
                validated['color'] = value
    
    if not validated:
        # No valid fields to update
        return False
    
    db = get_db()
    
    # Build dynamic SQL
    set_clause = ", ".join(f"{k} = ?" for k in validated.keys())
    values = list(validated.values()) + [now_iso(), project_id, user_id]
    
    try:
        cursor = db.execute(
            f"UPDATE projects SET {set_clause}, updated_at = ? WHERE id = ? AND user_id = ?",
            values
        )
        
        if cursor.rowcount == 0:
            # Project doesn't exist or doesn't belong to user
            raise ValueError(f"Project {project_id} not found")
        
        db.commit()
        return True
    
    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to update project {project_id}")
        raise
```

**Update the route to use it**

```python
# app/api/projects_routes.py - COMPLETE THE ENDPOINT

import logging
from flask import jsonify
from app.repositories.projects_repo import ProjectRepository
from app.utils import get_current_user_id

logger = logging.getLogger(__name__)

@projects_bp.route("/<int:project_id>", methods=["PUT"])
def update_project(project_id):
    """Update a project"""
    uid = get_current_user_id()
    
    # Check project exists and belongs to user
    project = ProjectRepository.get_by_id(project_id, uid)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    
    data = request.get_json() or {}
    
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    try:
        # Update the project
        result = ProjectRepository.update(project_id, uid, **data)
        
        if not result:
            return jsonify({"error": "No fields to update"}), 400
        
        # Get updated project
        updated_project = ProjectRepository.get_by_id(project_id, uid)
        
        return jsonify({
            "success": True,
            "project": updated_project
        }), 200
    
    except ValueError as e:
        # Validation error
        logger.warning(f"Validation failed for project {project_id}: {str(e)}")
        return jsonify({"error": str(e)}), 400
    
    except Exception as e:
        # Unexpected error
        logger.exception(f"Failed to update project {project_id}")
        return jsonify({"error": "Failed to update project"}), 500
```

### Tests

```python
# tests/test_projects_repo.py

def test_update_project_name():
    """Test updating project name"""
    user_id = create_test_user()
    project = ProjectRepository.create(user_id, "Old Name")
    project_id = project["id"]
    
    # Update name
    result = ProjectRepository.update(project_id, user_id, name="New Name")
    assert result is True
    
    # Verify change
    updated = ProjectRepository.get_by_id(project_id, user_id)
    assert updated["name"] == "New Name"

def test_update_project_multiple_fields():
    """Test updating multiple fields at once"""
    user_id = create_test_user()
    project = ProjectRepository.create(user_id, "Project")
    
    result = ProjectRepository.update(
        project["id"],
        user_id,
        name="Updated",
        description="New description",
        color="blue"
    )
    assert result is True
    
    updated = ProjectRepository.get_by_id(project["id"], user_id)
    assert updated["name"] == "Updated"
    assert updated["description"] == "New description"
    assert updated["color"] == "blue"

def test_update_project_ignores_forbidden_fields():
    """Test that system fields can't be updated"""
    user_id = create_test_user()
    project = ProjectRepository.create(user_id, "Project")
    
    # Try to update forbidden fields
    result = ProjectRepository.update(
        project["id"],
        user_id,
        id=99999,
        user_id=99999,
        created_at="2000-01-01",
        name="Test"
    )
    
    # Should still update name, but not other fields
    assert result is True
    updated = ProjectRepository.get_by_id(project["id"], user_id)
    assert updated["id"] == project["id"]
    assert updated["user_id"] == user_id
    assert updated["name"] == "Test"

def test_update_project_validation():
    """Test field validation"""
    user_id = create_test_user()
    project = ProjectRepository.create(user_id, "Project")
    
    # Name too long
    with pytest.raises(ValueError):
        ProjectRepository.update(project["id"], user_id, name="a" * 101)
    
    # Invalid color
    with pytest.raises(ValueError):
        ProjectRepository.update(project["id"], user_id, color="invalidcolor")

def test_update_project_wrong_owner():
    """Test that users can't update other user's projects"""
    user1_id = create_test_user()
    user2_id = create_test_user()
    
    project = ProjectRepository.create(user1_id, "Project")
    
    # User2 tries to update user1's project
    with pytest.raises(ValueError):
        ProjectRepository.update(project["id"], user2_id, name="Hacked")

def test_update_project_nonexistent():
    """Test updating non-existent project"""
    user_id = create_test_user()
    
    with pytest.raises(ValueError):
        ProjectRepository.update(99999, user_id, name="Test")

def test_update_project_endpoint():
    """Test PUT /api/projects/<id> endpoint"""
    client = app.test_client()
    user_id = create_test_user()
    project = ProjectRepository.create(user_id, "Original")
    
    response = client.put(
        f"/api/projects/{project['id']}",
        json={"name": "Updated"},
        headers={"x-user-id": str(user_id)}
    )
    
    assert response.status_code == 200
    assert response.json["project"]["name"] == "Updated"
```

### Verification Checklist

- [ ] ProjectRepository.update() method implemented
- [ ] Field validation working
- [ ] Ownership verification working
- [ ] Routes endpoint complete and returns correct data
- [ ] No forbidden fields can be updated
- [ ] All tests passing
- [ ] Error messages clear
- [ ] Logging in place

---

## CRITICAL-04: Focus Session Task/Project Linking

**Files:** [app/repositories/focus_repo.py](app/repositories/focus_repo.py), [app/api/focus_routes.py](app/api/focus_routes.py)  
**Severity:** 🔴 CRITICAL  
**Feature Impact:** Task/project context lost for focus sessions  
**Effort:** 2-3 hours  
**Owner:** [Assign: 1 Backend Developer]

### The Problem

Routes accept `task_id` and `project_id` for focus sessions but don't persist them.

### Current Code (Incomplete)

```python
# app/api/focus_routes.py - Problem: data not used

@focus_bp.route("/", methods=["POST"])
def create_focus():
    uid = default_user_id()
    data = request.get_json() or {}
    
    task_id = data.get("task_id")  # ❌ Accepted but not used!
    project_id = data.get("project_id")  # ❌ Accepted but not used!
    duration = data.get("duration", 25)
    mode = data.get("mode", "pomodoro")
    
    # ❌ Repository doesn't accept task_id/project_id
    session_id = FocusRepository.create(
        user_id=uid,
        duration=duration,
        mode=mode
        # Missing: task_id=task_id, project_id=project_id
    )
    
    # ...
```

### Solution

**Step 1: Update FocusRepository.create()**

```python
# app/repositories/focus_repo.py - UPDATE create() METHOD

from app.repositories.task_repo import TaskRepository
from app.repositories.projects_repo import ProjectRepository

@staticmethod
def create(user_id, duration=25, mode="pomodoro", task_id=None, project_id=None):
    """
    Create a focus session
    
    Args:
        user_id: User ID
        duration: Duration in minutes (default: 25 for Pomodoro)
        mode: Focus mode: 'pomodoro', 'custom', 'stopwatch'
        task_id: Optional associated task ID
        project_id: Optional associated project ID
    
    Returns:
        Focus session ID
    
    Raises:
        ValueError: If task/project not found or don't belong to user
    """
    db = get_db()
    
    # Validate mode
    valid_modes = ['pomodoro', 'custom', 'stopwatch']
    if mode not in valid_modes:
        raise ValueError(f"Invalid mode: {mode}. Must be one of {valid_modes}")
    
    # Validate duration
    if not isinstance(duration, (int, float)) or duration <= 0 or duration > 480:
        raise ValueError(f"Duration must be 1-480 minutes, got {duration}")
    
    # Validate and check ownership of task if provided
    if task_id is not None:
        task = TaskRepository.get_by_id(task_id, user_id)
        if not task:
            raise ValueError(f"Task {task_id} not found or doesn't belong to you")
    
    # Validate and check ownership of project if provided
    if project_id is not None:
        project = ProjectRepository.get_by_id(project_id, user_id)
        if not project:
            raise ValueError(f"Project {project_id} not found or doesn't belong to you")
    
    try:
        cursor = db.execute("""
            INSERT INTO focus_sessions
            (user_id, duration, mode, task_id, project_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, duration, mode, task_id, project_id, now_iso(), now_iso()))
        
        db.commit()
        session_id = cursor.lastrowid
        
        logger.info(f"Created focus session {session_id} for user {user_id}")
        return session_id
    
    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to create focus session for user {user_id}")
        raise
```

**Step 2: Update FocusRepository.update()**

```python
# app/repositories/focus_repo.py - ADD/UPDATE update() METHOD

@staticmethod
def update(session_id, user_id, **updates):
    """
    Update a focus session
    
    Args:
        session_id: Session ID
        user_id: User ID (ownership check)
        **updates: Fields to update (duration, mode, task_id, project_id)
    
    Returns:
        True if updated, False if no changes
    
    Raises:
        ValueError: If session not found or invalid data
    """
    ALLOWED_FIELDS = {'duration', 'mode', 'task_id', 'project_id'}
    
    validated = {}
    
    for field, value in updates.items():
        if field not in ALLOWED_FIELDS:
            continue
        
        if field == 'duration':
            if not isinstance(value, (int, float)) or value <= 0 or value > 480:
                raise ValueError(f"Invalid duration: {value}")
            validated['duration'] = value
        
        elif field == 'mode':
            valid_modes = ['pomodoro', 'custom', 'stopwatch']
            if value not in valid_modes:
                raise ValueError(f"Invalid mode: {value}")
            validated['mode'] = value
        
        elif field == 'task_id':
            if value is not None:
                task = TaskRepository.get_by_id(value, user_id)
                if not task:
                    raise ValueError(f"Task {value} not found")
            validated['task_id'] = value
        
        elif field == 'project_id':
            if value is not None:
                project = ProjectRepository.get_by_id(value, user_id)
                if not project:
                    raise ValueError(f"Project {value} not found")
            validated['project_id'] = value
    
    if not validated:
        return False
    
    db = get_db()
    
    try:
        set_clause = ", ".join(f"{k} = ?" for k in validated.keys())
        values = list(validated.values()) + [now_iso(), session_id, user_id]
        
        cursor = db.execute(
            f"UPDATE focus_sessions SET {set_clause}, updated_at = ? WHERE id = ? AND user_id = ?",
            values
        )
        
        if cursor.rowcount == 0:
            raise ValueError(f"Focus session {session_id} not found")
        
        db.commit()
        return True
    
    except Exception as e:
        db.rollback()
        logger.exception(f"Failed to update focus session {session_id}")
        raise
```

**Step 3: Update routes to pass parameters**

```python
# app/api/focus_routes.py - UPDATE ENDPOINTS

from app.repositories.focus_repo import FocusRepository
from app.utils import get_current_user_id
import logging

logger = logging.getLogger(__name__)

@focus_bp.route("/", methods=["POST"])
def create_focus():
    """Create a focus session"""
    uid = get_current_user_id()
    data = request.get_json() or {}
    
    # Get parameters
    duration = float(data.get("duration", 25))
    mode = data.get("mode", "pomodoro").lower()
    task_id = data.get("task_id")
    project_id = data.get("project_id")
    
    try:
        # Create session with all parameters
        session_id = FocusRepository.create(
            user_id=uid,
            duration=duration,
            mode=mode,
            task_id=task_id,
            project_id=project_id
        )
        
        # Fetch created session
        session = FocusRepository.get_by_id(session_id, uid)
        
        return jsonify({
            "success": True,
            "session": session
        }), 201
    
    except ValueError as e:
        logger.warning(f"Validation failed for focus session: {str(e)}")
        return jsonify({"error": str(e)}), 400
    
    except Exception:
        logger.exception("Failed to create focus session")
        return jsonify({"error": "Failed to create session"}), 500

@focus_bp.route("/<int:session_id>", methods=["PUT"])
def update_focus(session_id):
    """Update a focus session"""
    uid = get_current_user_id()
    data = request.get_json() or {}
    
    try:
        result = FocusRepository.update(session_id, uid, **data)
        
        if not result:
            return jsonify({"error": "No fields to update"}), 400
        
        session = FocusRepository.get_by_id(session_id, uid)
        return jsonify({
            "success": True,
            "session": session
        }), 200
    
    except ValueError as e:
        logger.warning(f"Validation failed: {str(e)}")
        return jsonify({"error": str(e)}), 400
    
    except Exception:
        logger.exception("Failed to update focus session")
        return jsonify({"error": "Failed to update session"}), 500
```

### Tests

```python
# tests/test_focus_repo.py

def test_create_focus_with_task():
    """Test creating focus session with task"""
    user_id = create_test_user()
    task = TaskRepository.create(user_id, "Focus Task")
    
    session_id = FocusRepository.create(
        user_id=user_id,
        duration=25,
        mode="pomodoro",
        task_id=task["id"]
    )
    
    session = FocusRepository.get_by_id(session_id, user_id)
    assert session["task_id"] == task["id"]
    assert session["duration"] == 25
    assert session["mode"] == "pomodoro"

def test_create_focus_with_project():
    """Test creating focus session with project"""
    user_id = create_test_user()
    project = ProjectRepository.create(user_id, "Focus Project")
    
    session_id = FocusRepository.create(
        user_id=user_id,
        duration=45,
        mode="custom",
        project_id=project["id"]
    )
    
    session = FocusRepository.get_by_id(session_id, user_id)
    assert session["project_id"] == project["id"]

def test_create_focus_with_both_task_and_project():
    """Test creating with both task and project"""
    user_id = create_test_user()
    project = ProjectRepository.create(user_id, "Project")
    task = TaskRepository.create(user_id, "Task", project_id=project["id"])
    
    session_id = FocusRepository.create(
        user_id=user_id,
        task_id=task["id"],
        project_id=project["id"]
    )
    
    session = FocusRepository.get_by_id(session_id, user_id)
    assert session["task_id"] == task["id"]
    assert session["project_id"] == project["id"]

def test_create_focus_invalid_task():
    """Test that invalid task raises error"""
    user_id = create_test_user()
    
    with pytest.raises(ValueError):
        FocusRepository.create(user_id, task_id=99999)

def test_create_focus_task_wrong_owner():
    """Test that can't use another user's task"""
    user1_id = create_test_user()
    user2_id = create_test_user()
    
    task = TaskRepository.create(user1_id, "Task")
    
    with pytest.raises(ValueError):
        FocusRepository.create(user2_id, task_id=task["id"])

def test_update_focus_task():
    """Test linking to different task"""
    user_id = create_test_user()
    session_id = FocusRepository.create(user_id)
    task = TaskRepository.create(user_id, "New Task")
    
    result = FocusRepository.update(session_id, user_id, task_id=task["id"])
    assert result is True
    
    updated = FocusRepository.get_by_id(session_id, user_id)
    assert updated["task_id"] == task["id"]
```

### Verification Checklist

- [ ] FocusRepository.create() accepts task_id and project_id
- [ ] FocusRepository.update() accepts task_id and project_id
- [ ] Task/project validation working (can't use non-existent or others' items)
- [ ] Routes pass parameters correctly
- [ ] Sessions retrieve with linked task/project
- [ ] All tests passing
- [ ] Error messages clear
- [ ] No logic errors

---

## 📋 IMPLEMENTATION ORDER

Complete in this order:

1. **SQL Injection (CRITICAL-01)** - 2-3 hrs
2. **Direct DB Access (CRITICAL-02)** - 4-6 hrs  
3. **ProjectRepository.update() (CRITICAL-03)** - 1-2 hrs
4. **Focus Task/Project Linking (CRITICAL-04)** - 2-3 hrs

**Week 1 Total: 10-14 hours**

Then proceed to MAJOR issues (Week 2) and MINOR issues (Week 3+).

---

## ✅ DEVELOPER CHECKLIST FOR EACH ISSUE

When implementing a fix:

- [ ] Read the entire issue description
- [ ] Review current code (what's broken)
- [ ] Implement the solution
- [ ] Write tests (at least 3 test cases per issue)
- [ ] Run all tests locally
- [ ] Run linter/formatter
- [ ] Create code review checklist
- [ ] Submit for review
- [ ] Update [API_ROUTES_AUDIT_PROGRESS.md](API_ROUTES_AUDIT_PROGRESS.md) with completion status
- [ ] Move to next issue

---

**Document Version:** 1.0  
**Last Updated:** March 18, 2026  
**Status:** Ready for Developer Implementation
