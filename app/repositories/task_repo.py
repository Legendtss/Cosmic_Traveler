"""
FILE: app/repositories/task_repo.py

Responsibility:
  Data-access layer for the tasks table.
  Encapsulates ALL raw SQL for task CRUD.
  Route handlers call these instead of get_db().execute() directly.

MUST NOT:
  - Import Flask request/response objects
  - Contain HTTP/validation logic
  - Contain business rules

Depends on:
  - db.get_db()
  - utils (now_iso, safe_int)
"""

import json

from ..db import get_db
from ..utils import now_iso, safe_int


class TaskRepository:
    """Data-access object for the tasks table."""

    @staticmethod
    def get_all(user_id, date_filter=None):
        db = get_db()
        if date_filter:
            return db.execute(
                "SELECT * FROM tasks WHERE user_id = ? AND date = ? ORDER BY id DESC",
                (user_id, date_filter),
            ).fetchall()
        return db.execute(
            "SELECT * FROM tasks WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()

    @staticmethod
    def get_by_id(task_id, user_id=None):
        db = get_db()
        if user_id:
            return db.execute(
                "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
                (task_id, user_id),
            ).fetchone()
        return db.execute(
            "SELECT * FROM tasks WHERE id = ?", (task_id,)
        ).fetchone()

    @staticmethod
    def create(user_id, *, title, description="", tags_json="[]", category="general",
               priority="medium", date=None, project_id=None,
               note_content="", note_saved_to_notes=False):
        db = get_db()
        created_at = now_iso()
        cursor = db.execute(
            """
            INSERT INTO tasks
            (user_id, project_id, title, description, tags_json, category,
             priority, completed, date, time_spent,
             note_content, note_saved_to_notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id, project_id, title, description, tags_json,
                category, priority, 0, date, 0,
                note_content, 1 if note_saved_to_notes and note_content else 0,
                created_at, created_at,
            ),
        )
        db.commit()
        return cursor.lastrowid, created_at

    @staticmethod
    def update(task_id, user_id, *, title, description, tags_json, category,
               priority, completed, date, time_spent,
               note_content, note_saved_to_notes):
        db = get_db()
        now = now_iso()
        db.execute(
            """
            UPDATE tasks
            SET title = ?, description = ?, tags_json = ?, category = ?,
                priority = ?, completed = ?, date = ?, time_spent = ?,
                note_content = ?, note_saved_to_notes = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (
                title, description, tags_json, category,
                priority, 1 if completed else 0, date,
                max(0, safe_int(time_spent, 0)),
                note_content, 1 if note_saved_to_notes else 0, now,
                task_id, user_id,
            ),
        )
        db.commit()
        return now

    @staticmethod
    def delete(task_id, user_id):
        db = get_db()
        result = db.execute(
            "DELETE FROM tasks WHERE id = ? AND user_id = ?",
            (task_id, user_id),
        )
        db.commit()
        return result.rowcount > 0

    @staticmethod
    def toggle_completed(task_id, user_id):
        db = get_db()
        row = db.execute(
            "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
            (task_id, user_id),
        ).fetchone()
        if not row:
            return None
        new_val = 0 if row["completed"] else 1
        db.execute(
            "UPDATE tasks SET completed = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            (new_val, now_iso(), task_id, user_id),
        )
        db.commit()
        return db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()


class NoteLinker:
    """Handles task ↔ note linkage (shared by task create/update)."""

    @staticmethod
    def create_linked_note(user_id, task_id, title, content, tags_json, created_at):
        db = get_db()
        db.execute(
            """INSERT INTO notes
               (user_id, title, content, source_type, source_id, tags_json, created_at, updated_at)
               VALUES (?, ?, ?, 'task', ?, ?, ?, ?)""",
            (user_id, title, content, task_id, tags_json, created_at, created_at),
        )
        db.commit()

    @staticmethod
    def upsert_linked_note(user_id, task_id, title, content, tags_json):
        db = get_db()
        now = now_iso()
        existing = db.execute(
            "SELECT id FROM notes WHERE source_type = 'task' AND source_id = ? AND user_id = ?",
            (task_id, user_id),
        ).fetchone()
        if existing:
            db.execute(
                "UPDATE notes SET title = ?, content = ?, tags_json = ?, updated_at = ? WHERE id = ?",
                (title, content, tags_json, now, existing["id"]),
            )
        else:
            db.execute(
                """INSERT INTO notes
                   (user_id, title, content, source_type, source_id, tags_json, created_at, updated_at)
                   VALUES (?, ?, ?, 'task', ?, ?, ?, ?)""",
                (user_id, title, content, task_id, tags_json, now, now),
            )
        db.commit()
