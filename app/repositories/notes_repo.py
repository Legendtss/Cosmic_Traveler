"""
FILE: app/repositories/notes_repo.py

Responsibility:
  Data-access layer for the notes table.
  Encapsulates ALL raw SQL for note CRUD.

MUST NOT:
  - Import Flask request/response objects
  - Contain HTTP/validation logic

Depends on:
  - db.get_db()
  - utils.now_iso
"""

import json

from ..db import get_db
from ..utils import now_iso


def _escape_like(value):
    """Escape SQL LIKE wildcards and backslashes for literal matching."""
    text = str(value or "")
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _map_note(row):
    """Convert a DB row to a JSON-safe note dict."""
    tags = []
    try:
        tags = json.loads(row["tags_json"] or "[]")
    except (TypeError, ValueError):
        tags = []
    if not isinstance(tags, list):
        tags = []
    tags = [str(t).strip().lower() for t in tags if str(t).strip()]

    return {
        "id": row["id"],
        "title": row["title"],
        "content": row["content"],
        "source_type": row["source_type"],
        "source_id": row["source_id"],
        "tags": tags,
        "linked_task_title": row["linked_task_title"] if "linked_task_title" in row.keys() else None,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


class NoteRepository:
    """Data-access object for the notes table."""

    map_note = staticmethod(_map_note)

    @staticmethod
    def get_all(user_id, *, source_type=None, search=None, tag=None):
        db = get_db()
        query = """
            SELECT n.*, t.title AS linked_task_title
            FROM notes n
            LEFT JOIN tasks t
              ON n.source_type = 'task'
             AND n.source_id = t.id
             AND t.user_id = n.user_id
            WHERE n.user_id = ?
        """
        params = [user_id]

        if source_type in ("manual", "task"):
            query += " AND n.source_type = ?"
            params.append(source_type)

        if search:
            query += " AND (n.title LIKE ? ESCAPE '\\' OR n.content LIKE ? ESCAPE '\\')"
            like = f"%{_escape_like(search)}%"
            params.extend([like, like])

        if tag:
            query += " AND n.tags_json LIKE ? ESCAPE '\\'"
            params.append(f'%"{_escape_like(tag)}"%')

        query += " ORDER BY n.updated_at DESC"
        rows = db.execute(query, params).fetchall()
        return [_map_note(r) for r in rows]

    @staticmethod
    def get_by_id(note_id, user_id):
        db = get_db()
        row = db.execute(
            """
            SELECT n.*, t.title AS linked_task_title
            FROM notes n
            LEFT JOIN tasks t
              ON n.source_type = 'task'
             AND n.source_id = t.id
             AND t.user_id = n.user_id
            WHERE n.id = ? AND n.user_id = ?
            """,
            (note_id, user_id),
        ).fetchone()
        if not row:
            return None
        return _map_note(row)

    @staticmethod
    def create(user_id, *, title, content="", source_type="manual",
               source_id=None, tags=None):
        db = get_db()
        if tags is None:
            tags = []
        if source_type != "task":
            source_type = "manual"
            source_id = None
        else:
            try:
                source_id = int(source_id)  # type: ignore[arg-type]  # guarded by try/except
            except (TypeError, ValueError):
                raise ValueError("source_id must be a valid task id when source_type='task'")
            linked_task = db.execute(
                "SELECT id FROM tasks WHERE id = ? AND user_id = ?",
                (source_id, user_id),
            ).fetchone()
            if not linked_task:
                raise ValueError("Linked task not found for this user")
        now = now_iso()
        cursor = db.execute(
            """INSERT INTO notes
               (user_id, title, content, source_type, source_id, tags_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, title, content, source_type, source_id,
             json.dumps(tags), now, now),
        )
        db.commit()
        return db.execute(
            "SELECT * FROM notes WHERE id = ? AND user_id = ?", (cursor.lastrowid, user_id)
        ).fetchone()

    @staticmethod
    def update(note_id, user_id, *, title, content, tags):
        db = get_db()
        db.execute(
            """UPDATE notes SET title = ?, content = ?, tags_json = ?, updated_at = ?
               WHERE id = ? AND user_id = ?""",
            (title, content, json.dumps(tags), now_iso(), note_id, user_id),
        )
        db.commit()
        return db.execute(
            "SELECT * FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id)
        ).fetchone()

    @staticmethod
    def delete(note_id, user_id):
        db = get_db()
        note_row = db.execute(
            "SELECT source_type, source_id FROM notes WHERE id = ? AND user_id = ?",
            (note_id, user_id),
        ).fetchone()
        if not note_row:
            return False

        # Un-flag linked task if source_type == task
        if note_row["source_type"] == "task" and note_row["source_id"]:
            db.execute(
                "UPDATE tasks SET note_saved_to_notes = 0 WHERE id = ? AND user_id = ?",
                (note_row["source_id"], user_id),
            )

        db.execute(
            "DELETE FROM notes WHERE id = ? AND user_id = ?", (note_id, user_id)
        )
        db.commit()
        return True

    @staticmethod
    def get_by_task(task_id, user_id):
        db = get_db()
        row = db.execute(
            "SELECT * FROM notes WHERE source_type = 'task' AND source_id = ? AND user_id = ?",
            (task_id, user_id),
        ).fetchone()
        if not row:
            return None
        return _map_note(row)
