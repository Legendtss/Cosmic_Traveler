"""
FILE: app/repositories/project_repo.py

Responsibility:
  Data-access layer for the projects and project_subtasks tables.
  Encapsulates ALL raw SQL for project CRUD.

MUST NOT:
  - Import Flask request/response objects
  - Contain HTTP/validation logic
  - Contain business rules

Depends on:
  - db.get_db()
  - utils (now_iso)
"""

from ..db import get_db
from ..utils import now_iso


class ProjectRepository:
    """Data-access object for the projects / project_subtasks tables."""

    @staticmethod
    def get_all(user_id):
        db = get_db()
        return db.execute(
            "SELECT * FROM projects WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()

    @staticmethod
    def get_by_id(project_id, user_id):
        db = get_db()
        return db.execute(
            "SELECT * FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id),
        ).fetchone()

    @staticmethod
    def create(user_id, *, name, description="", due_date=None, subtasks=None):
        """Create a project with optional subtasks.

        Args:
            subtasks: list of subtitle strings.

        Returns:
            (project_row, subtask_rows) as dicts.
        """
        db = get_db()
        created_at = now_iso()

        cursor = db.execute(
            """
            INSERT INTO projects (user_id, name, description, due_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, name, description, due_date, created_at, created_at),
        )
        project_id = cursor.lastrowid

        if subtasks:
            for idx, st in enumerate(subtasks):
                if isinstance(st, str) and st.strip():
                    db.execute(
                        "INSERT INTO project_subtasks (project_id, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                        (project_id, st.strip(), idx, created_at, created_at),
                    )

        db.commit()

        project_row = db.execute(
            "SELECT * FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id)
        ).fetchone()
        subtask_rows = ProjectRepository.get_subtasks(project_id, user_id)
        return project_row, subtask_rows

    @staticmethod
    def update(project_id, user_id, *, name, description="", due_date=None, status=None):
        """Update mutable project fields for an owned project."""
        db = get_db()
        row = db.execute(
            "SELECT id, status FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id),
        ).fetchone()
        if not row:
            return None

        status_val = (status or row["status"] or "active").strip().lower()
        if status_val not in ("active", "completed", "archived"):
            status_val = row["status"]

        db.execute(
            """
            UPDATE projects
            SET name = ?, description = ?, due_date = ?, status = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (name, description, due_date, status_val, now_iso(), project_id, user_id),
        )
        db.commit()
        return db.execute(
            "SELECT * FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id),
        ).fetchone()

    @staticmethod
    def get_subtasks(project_id, user_id):
        db = get_db()
        return db.execute(
            """
            SELECT ps.*
            FROM project_subtasks ps
            JOIN projects p ON p.id = ps.project_id
            WHERE ps.project_id = ? AND p.user_id = ?
            ORDER BY ps.sort_order
            """,
            (project_id, user_id),
        ).fetchall()

    @staticmethod
    def delete(project_id, user_id):
        db = get_db()
        result = db.execute(
            "DELETE FROM projects WHERE id = ? AND user_id = ?",
            (project_id, user_id),
        )
        db.commit()
        return result.rowcount > 0
