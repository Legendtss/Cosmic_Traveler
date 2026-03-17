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
from datetime import datetime

from ..db import get_db
from ..utils import now_iso, safe_int

VALID_RECURRENCE = frozenset({"none", "daily", "weekly", "weekdays"})


def _parse_ymd(value):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


def _should_materialize(recurrence, anchor_date, target_date):
    if target_date <= anchor_date:
        return False
    if recurrence == "daily":
        return True
    if recurrence == "weekdays":
        return target_date.weekday() < 5
    if recurrence == "weekly":
        return target_date.weekday() == anchor_date.weekday()
    return False


class TaskRepository:
    """Data-access object for the tasks table."""

    @staticmethod
    def materialize_recurring_for_date(user_id, target_date):
        """Create missing recurring task instances for a target date."""
        parsed_target = _parse_ymd(target_date)
        if not parsed_target:
            return 0

        db = get_db()
        templates = db.execute(
            """
            SELECT * FROM tasks
            WHERE user_id = ?
              AND recurrence IN ('daily', 'weekly', 'weekdays')
              AND recurrence_parent_id IS NULL
              AND date <= ?
            ORDER BY id ASC
            """,
            (user_id, target_date),
        ).fetchall()

        created = 0
        now = now_iso()
        for template in templates:
            anchor = _parse_ymd(template["date"])
            if not anchor:
                continue
            if not _should_materialize(template["recurrence"], anchor, parsed_target):
                continue

            exists = db.execute(
                """
                SELECT 1 FROM tasks
                WHERE user_id = ?
                  AND date = ?
                  AND (id = ? OR recurrence_parent_id = ?)
                LIMIT 1
                """,
                (user_id, target_date, template["id"], template["id"]),
            ).fetchone()
            if exists:
                continue

            db.execute(
                """
                INSERT INTO tasks
                (user_id, project_id, title, description, tags_json, category,
                 priority, completed, date, time_spent,
                 note_content, note_saved_to_notes, recurrence, recurrence_parent_id,
                 created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    template["project_id"],
                    template["title"],
                    template["description"],
                    template["tags_json"],
                    template["category"],
                    template["priority"],
                    0,
                    target_date,
                    0,
                    template["note_content"] or "",
                    0,
                    "none",
                    template["id"],
                    now,
                    now,
                ),
            )
            created += 1

        if created:
            db.commit()
        return created

    @staticmethod
    def get_all(user_id, date_filter=None):
        db = get_db()
        q_base = """
            SELECT t.*, 
                   COALESCE(SUM(f.duration_actual), 0) as focus_time_spent
            FROM tasks t
            LEFT JOIN focus_sessions f ON t.id = f.task_id AND f.completed = 1
            WHERE t.user_id = ? {date_cond}
            GROUP BY t.id
            ORDER BY t.id DESC
        """
        if date_filter:
            return db.execute(
                q_base.format(date_cond="AND t.date = ?"),
                (user_id, date_filter),
            ).fetchall()
        return db.execute(
            q_base.format(date_cond=""),
            (user_id,),
        ).fetchall()

    @staticmethod
    def get_overdue(user_id, before_date, limit=10):
        db = get_db()
        return db.execute(
            "SELECT * FROM tasks WHERE user_id = ? AND date < ? AND completed = 0 ORDER BY date ASC LIMIT ?",
            (user_id, before_date, limit),
        ).fetchall()

    @staticmethod
    def get_by_id(task_id, user_id):
        db = get_db()
        return db.execute(
            """
            SELECT t.*, 
                   COALESCE(SUM(f.duration_actual), 0) as focus_time_spent
            FROM tasks t
            LEFT JOIN focus_sessions f ON t.id = f.task_id AND f.completed = 1
            WHERE t.id = ? AND t.user_id = ?
            GROUP BY t.id
            """,
            (task_id, user_id),
        ).fetchone()

    @staticmethod
    def create(user_id, *, title, description="", tags_json="[]", category="general",
               priority="medium", date=None, project_id=None,
               note_content="", note_saved_to_notes=False,
               recurrence="none", recurrence_parent_id=None):
        db = get_db()
        created_at = now_iso()
        recurrence_value = recurrence if recurrence in VALID_RECURRENCE else "none"
        cursor = db.execute(
            """
            INSERT INTO tasks
            (user_id, project_id, title, description, tags_json, category,
             priority, completed, date, time_spent,
             note_content, note_saved_to_notes, recurrence, recurrence_parent_id,
             created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id, project_id, title, description, tags_json,
                category, priority, 0, date, 0,
                note_content, 1 if note_saved_to_notes and note_content else 0,
                recurrence_value,
                recurrence_parent_id,
                created_at, created_at,
            ),
        )
        db.commit()
        return cursor.lastrowid, created_at

    @staticmethod
    def update(task_id, user_id, *, title, description, tags_json, category,
               priority, completed, date, time_spent,
               note_content, note_saved_to_notes, recurrence,
               recurrence_parent_id):
        db = get_db()
        now = now_iso()
        recurrence_value = recurrence if recurrence in VALID_RECURRENCE else "none"
        db.execute(
            """
            UPDATE tasks
            SET title = ?, description = ?, tags_json = ?, category = ?,
                priority = ?, completed = ?, date = ?, time_spent = ?,
                note_content = ?, note_saved_to_notes = ?, recurrence = ?, recurrence_parent_id = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (
                title, description, tags_json, category,
                priority, 1 if completed else 0, date,
                max(0, safe_int(time_spent, 0)),
                note_content, 1 if note_saved_to_notes else 0,
                recurrence_value, recurrence_parent_id, now,
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
        return db.execute("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id)).fetchone()


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

    @staticmethod
    def delete_linked_note(user_id, task_id):
        db = get_db()
        db.execute(
            "DELETE FROM notes WHERE source_type = 'task' AND source_id = ? AND user_id = ?",
            (task_id, user_id),
        )
        db.commit()
