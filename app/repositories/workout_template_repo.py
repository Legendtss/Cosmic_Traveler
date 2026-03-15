"""
FILE: app/repositories/workout_template_repo.py

Responsibility:
  Data-access layer for the workout_templates table and template-to-workout
  materialization.

MUST NOT:
  - Import Flask request/response objects
  - Contain HTTP/validation logic

Depends on:
  - db.get_db()
  - utils (now_iso, safe_int)
"""

import json
from datetime import datetime

from ..db import get_db
from ..utils import now_iso, safe_int


class WorkoutTemplateRepository:
    """Data-access object for workout templates."""

    @staticmethod
    def get_all(user_id):
        db = get_db()
        return db.execute(
            "SELECT * FROM workout_templates WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()

    @staticmethod
    def get_by_id(template_id, user_id):
        db = get_db()
        return db.execute(
            "SELECT * FROM workout_templates WHERE id = ? AND user_id = ?",
            (template_id, user_id),
        ).fetchone()

    @staticmethod
    def create(user_id, *, name, workout_type="other", duration=0,
               calories_burned=0, exercises=None, notes="", intensity="medium"):
        db = get_db()
        if exercises is None:
            exercises = []
        if not isinstance(exercises, list):
            exercises = []

        now = now_iso()
        cursor = db.execute(
            """
            INSERT INTO workout_templates
            (user_id, name, type, duration, calories_burned, exercises_json,
             notes, intensity, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                now,
                now,
            ),
        )
        db.commit()
        return db.execute(
            "SELECT * FROM workout_templates WHERE id = ? AND user_id = ?",
            (cursor.lastrowid, user_id),
        ).fetchone()

    @staticmethod
    def update(template_id, user_id, *, name, workout_type, duration,
               calories_burned, exercises, notes, intensity):
        db = get_db()
        if not isinstance(exercises, list):
            exercises = []

        db.execute(
            """
            UPDATE workout_templates
            SET name = ?, type = ?, duration = ?, calories_burned = ?,
                exercises_json = ?, notes = ?, intensity = ?, updated_at = ?
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
                now_iso(),
                template_id,
                user_id,
            ),
        )
        db.commit()
        return db.execute(
            "SELECT * FROM workout_templates WHERE id = ? AND user_id = ?",
            (template_id, user_id),
        ).fetchone()

    @staticmethod
    def delete(template_id, user_id):
        db = get_db()
        result = db.execute(
            "DELETE FROM workout_templates WHERE id = ? AND user_id = ?",
            (template_id, user_id),
        )
        db.commit()
        return result.rowcount > 0

    @staticmethod
    def use_template(template_id, user_id, *, date=None, time=None):
        """Create a new workout row from a template for a target date/time."""
        db = get_db()
        tpl = WorkoutTemplateRepository.get_by_id(template_id, user_id)
        if not tpl:
            return None

        created_at = now_iso()
        cursor = db.execute(
            """
            INSERT INTO workouts
            (user_id, name, type, duration, calories_burned, exercises_json,
             notes, intensity, completed, date, time, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
            """,
            (
                user_id,
                tpl["name"],
                tpl["type"],
                tpl["duration"],
                tpl["calories_burned"],
                tpl["exercises_json"],
                tpl["notes"],
                tpl["intensity"],
                date or datetime.now().strftime("%Y-%m-%d"),
                time or datetime.now().strftime("%H:%M"),
                created_at,
                created_at,
            ),
        )
        db.commit()
        return db.execute(
            "SELECT * FROM workouts WHERE id = ? AND user_id = ?",
            (cursor.lastrowid, user_id),
        ).fetchone()
