"""
FILE: app/repositories/workout_repo.py

Responsibility:
  Data-access layer for the workouts table.
  Encapsulates ALL raw SQL for workout CRUD.
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


class WorkoutRepository:
    """Data-access object for the workouts table."""

    @staticmethod
    def get_all(user_id, date_filter=None):
        db = get_db()
        if date_filter:
            return db.execute(
                "SELECT * FROM workouts WHERE user_id = ? AND date = ? ORDER BY id DESC",
                (user_id, date_filter),
            ).fetchall()
        return db.execute(
            "SELECT * FROM workouts WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()

    @staticmethod
    def get_by_id(workout_id, user_id):
        db = get_db()
        return db.execute(
            "SELECT * FROM workouts WHERE id = ? AND user_id = ?",
            (workout_id, user_id),
        ).fetchone()

    @staticmethod
    def create(user_id, *, name, workout_type="other", duration=0,
               calories_burned=0, exercises=None, notes="",
               intensity="medium", date=None, time=None):
        db = get_db()
        if exercises is None:
            exercises = []
        if not isinstance(exercises, list):
            exercises = []
        created_at = now_iso()
        cursor = db.execute(
            """
            INSERT INTO workouts
            (user_id, name, type, duration, calories_burned, exercises_json,
             notes, intensity, date, time, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                name,
                workout_type,
                max(0, safe_int(duration, 0)),
                max(0, safe_int(calories_burned, 0)),
                json.dumps(exercises),
                notes,
                intensity,
                date or datetime.now().strftime("%Y-%m-%d"),
                time or datetime.now().strftime("%H:%M"),
                created_at,
                created_at,
            ),
        )
        db.commit()
        return db.execute(
            "SELECT * FROM workouts WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()

    @staticmethod
    def update(workout_id, user_id, *, name, workout_type, duration,
               calories_burned, exercises, notes, intensity, date, time):
        db = get_db()
        if not isinstance(exercises, list):
            exercises = []
        db.execute(
            """
            UPDATE workouts
            SET name = ?, type = ?, duration = ?, calories_burned = ?,
                exercises_json = ?, notes = ?, intensity = ?,
                date = ?, time = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (
                name,
                workout_type,
                max(0, safe_int(duration, 0)),
                max(0, safe_int(calories_burned, 0)),
                json.dumps(exercises),
                notes,
                intensity,
                date,
                time,
                now_iso(),
                workout_id,
                user_id,
            ),
        )
        db.commit()
        return db.execute(
            "SELECT * FROM workouts WHERE id = ?", (workout_id,)
        ).fetchone()

    @staticmethod
    def delete(workout_id, user_id):
        db = get_db()
        result = db.execute(
            "DELETE FROM workouts WHERE id = ? AND user_id = ?",
            (workout_id, user_id),
        )
        db.commit()
        return result.rowcount > 0

    @staticmethod
    def toggle_completed(workout_id, user_id):
        db = get_db()
        row = db.execute(
            "SELECT * FROM workouts WHERE id = ? AND user_id = ?",
            (workout_id, user_id),
        ).fetchone()
        if not row:
            return None
        new_val = 0 if row["completed"] else 1
        db.execute(
            "UPDATE workouts SET completed = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            (new_val, now_iso(), workout_id, user_id),
        )
        db.commit()
        return db.execute(
            "SELECT * FROM workouts WHERE id = ?", (workout_id,)
        ).fetchone()
