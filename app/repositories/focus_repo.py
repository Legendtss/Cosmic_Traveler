"""
FILE: app/repositories/focus_repo.py

Responsibility:
  Data-access layer for the focus_sessions table.
  Encapsulates ALL raw SQL for focus session CRUD.

MUST NOT:
  - Import Flask request/response objects
  - Contain HTTP/validation logic
  - Contain business rules

Depends on:
  - db.get_db()
  - utils (now_iso, safe_int, today_str)
"""

from ..db import get_db
from ..utils import now_iso, safe_int, today_str


class FocusRepository:
    """Data-access object for the focus_sessions table."""

    @staticmethod
    def get_all(user_id, date_filter=None):
        """Get all focus sessions, optionally filtered by date. Includes linked task/project info."""
        db = get_db()
        query = """
            SELECT f.*, 
                   t.title as task_title, 
                   p.name as project_name
            FROM focus_sessions f
            LEFT JOIN tasks t ON f.task_id = t.id
            LEFT JOIN projects p ON f.project_id = p.id
            WHERE f.user_id = ?
        """
        params = [user_id]
        
        if date_filter:
            query += " AND f.date = ?"
            params.append(date_filter)
            
        query += " ORDER BY f.id DESC"
        
        return db.execute(query, params).fetchall()

    @staticmethod
    def get_by_id(session_id, user_id):
        """Get a focus session by ID."""
        db = get_db()
        return db.execute(
            "SELECT * FROM focus_sessions WHERE id = ? AND user_id = ?",
            (session_id, user_id),
        ).fetchone()

    @staticmethod
    def create(user_id, *, mode="pomodoro", duration_planned=0, duration_actual=0,
               completed=False, label="", date=None, started_at=None, ended_at=None, task_id=None, project_id=None):
        """Create a focus session."""
        db = get_db()
        now = now_iso()
        cursor = db.execute(
            """
            INSERT INTO focus_sessions
            (user_id, mode, duration_planned, duration_actual, completed, label, date, started_at, ended_at, task_id, project_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                mode,
                max(0, safe_int(duration_planned, 0)),
                max(0, safe_int(duration_actual, 0)),
                1 if completed else 0,
                label,
                date or today_str(),
                started_at or now,
                ended_at if completed else None,
                task_id if task_id else None,
                project_id if project_id else None,
                now,
                now,
            ),
        )
        db.commit()
        return db.execute(
            "SELECT * FROM focus_sessions WHERE id = ? AND user_id = ?", (cursor.lastrowid, user_id)
        ).fetchone()

    @staticmethod
    def update(session_id, user_id, *, mode, duration_planned, duration_actual,
               completed, label, date, started_at, ended_at):
        """Update a focus session."""
        db = get_db()
        db.execute(
            """
            UPDATE focus_sessions
            SET mode = ?, duration_planned = ?, duration_actual = ?, completed = ?,
                label = ?, date = ?, started_at = ?, ended_at = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (
                mode,
                max(0, safe_int(duration_planned, 0)),
                max(0, safe_int(duration_actual, 0)),
                1 if completed else 0,
                label,
                date,
                started_at,
                ended_at if completed else None,
                now_iso(),
                session_id,
                user_id,
            ),
        )
        db.commit()
        return db.execute(
            "SELECT * FROM focus_sessions WHERE id = ? AND user_id = ?", (session_id, user_id)
        ).fetchone()

    @staticmethod
    def delete(session_id, user_id):
        """Delete a focus session."""
        db = get_db()
        result = db.execute(
            "DELETE FROM focus_sessions WHERE id = ? AND user_id = ?",
            (session_id, user_id),
        )
        db.commit()
        return result.rowcount > 0

    @staticmethod
    def get_summary(user_id, date=None):
        """Get focus summary for a date (total sessions, completed, minutes)."""
        db = get_db()
        if not date:
            date = today_str()
        row = db.execute(
            """
            SELECT COUNT(*) as total_sessions,
                   SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) as completed_sessions,
                   SUM(duration_actual) as total_minutes
            FROM focus_sessions
            WHERE user_id = ? AND date = ?
            """,
            (user_id, date),
        ).fetchone()
        return {
            "total_sessions": row["total_sessions"] or 0,
            "completed_sessions": row["completed_sessions"] or 0,
            "total_minutes": row["total_minutes"] or 0,
        }
