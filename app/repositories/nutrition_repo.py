"""
FILE: app/repositories/nutrition_repo.py

Responsibility:
  Data-access layer for the nutrition_entries table.
  Encapsulates ALL raw SQL for meal CRUD.

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


def _sanitize_float(value, default=0.0):
    try:
        val = float(value)
    except (TypeError, ValueError):
        val = float(default)
    return max(0.0, val)


def _sanitize_int(value, default=0):
    try:
        val = int(value)
    except (TypeError, ValueError):
        val = int(default)
    return max(0, val)


class NutritionRepository:
    """Data-access object for the nutrition_entries table."""

    @staticmethod
    def get_all(user_id, date_filter=None):
        db = get_db()
        if date_filter:
            return db.execute(
                "SELECT * FROM nutrition_entries WHERE user_id = ? AND date = ? ORDER BY id DESC",
                (user_id, date_filter),
            ).fetchall()
        return db.execute(
            "SELECT * FROM nutrition_entries WHERE user_id = ? ORDER BY id DESC",
            (user_id,),
        ).fetchall()

    @staticmethod
    def get_by_id(meal_id, user_id):
        db = get_db()
        return db.execute(
            "SELECT * FROM nutrition_entries WHERE id = ? AND user_id = ?",
            (meal_id, user_id),
        ).fetchone()

    @staticmethod
    def create(user_id, *, name, meal_type="other", calories=0, protein=0.0,
               carbs=0.0, fats=0.0, notes="", date=None, time=None):
        db = get_db()
        created_at = now_iso()
        clean_name = (name or "").strip()
        if not clean_name:
            raise ValueError("Meal name is required")
        cursor = db.execute(
            """
            INSERT INTO nutrition_entries
            (user_id, name, meal_type, calories, protein, carbs, fats,
             notes, date, time, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                clean_name,
                meal_type,
                _sanitize_int(calories),
                _sanitize_float(protein),
                _sanitize_float(carbs),
                _sanitize_float(fats),
                notes or "",
                date,
                time,
                created_at,
                created_at,
            ),
        )
        db.commit()
        return cursor.lastrowid

    @staticmethod
    def update(meal_id, user_id, *, name, meal_type, calories, protein,
               carbs, fats, notes, date, time):
        db = get_db()
        clean_name = (name or "").strip()
        if not clean_name:
            raise ValueError("Meal name is required")
        db.execute(
            """
            UPDATE nutrition_entries
            SET name = ?, meal_type = ?, calories = ?, protein = ?, carbs = ?,
                fats = ?, notes = ?, date = ?, time = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (
                clean_name,
                meal_type,
                _sanitize_int(calories),
                _sanitize_float(protein),
                _sanitize_float(carbs),
                _sanitize_float(fats),
                notes or "",
                date,
                time,
                now_iso(),
                meal_id,
                user_id,
            ),
        )
        db.commit()

    @staticmethod
    def delete(meal_id, user_id):
        db = get_db()
        result = db.execute(
            "DELETE FROM nutrition_entries WHERE id = ? AND user_id = ?",
            (meal_id, user_id),
        )
        db.commit()
        return result.rowcount > 0

    @staticmethod
    def bulk_create(user_id, entries):
        """Insert multiple meal entries at once (used by AI-log).

        Args:
            user_id: Owner user ID.
            entries: List of dicts with keys: name, meal_type, calories,
                     protein, carbs, fats, notes, date, time.

        Returns:
            List of inserted row IDs.
        """
        db = get_db()
        if not isinstance(entries, list):
            raise ValueError("entries must be a list")
        created_at = now_iso()
        ids = []
        try:
            for e in entries:
                meal_name = str(e.get("name", "")).strip() if isinstance(e, dict) else ""
                if not meal_name:
                    raise ValueError("Each bulk meal entry must include a non-empty name")
                cursor = db.execute(
                    """
                    INSERT INTO nutrition_entries
                    (user_id, name, meal_type, calories, protein, carbs, fats,
                     notes, date, time, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user_id,
                        meal_name,
                        e.get("meal_type", "other"),
                        _sanitize_int(e.get("calories", 0)),
                        _sanitize_float(e.get("protein", 0.0)),
                        _sanitize_float(e.get("carbs", 0.0)),
                        _sanitize_float(e.get("fats", 0.0)),
                        e.get("notes", ""),
                        e.get("date"),
                        e.get("time"),
                        created_at,
                        created_at,
                    ),
                )
                ids.append(cursor.lastrowid)
            db.commit()
            return ids
        except Exception:
            db.rollback()
            raise
