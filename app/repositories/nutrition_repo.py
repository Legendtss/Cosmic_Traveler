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
        cursor = db.execute(
            """
            INSERT INTO nutrition_entries
            (user_id, name, meal_type, calories, protein, carbs, fats,
             notes, date, time, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, name, meal_type, calories, protein, carbs, fats,
             notes, date, time, created_at, created_at),
        )
        db.commit()
        return cursor.lastrowid

    @staticmethod
    def update(meal_id, user_id, *, name, meal_type, calories, protein,
               carbs, fats, notes, date, time):
        db = get_db()
        db.execute(
            """
            UPDATE nutrition_entries
            SET name = ?, meal_type = ?, calories = ?, protein = ?, carbs = ?,
                fats = ?, notes = ?, date = ?, time = ?, updated_at = ?
            WHERE id = ? AND user_id = ?
            """,
            (name, meal_type, calories, protein, carbs, fats, notes,
             date, time, now_iso(), meal_id, user_id),
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
        created_at = now_iso()
        ids = []
        for e in entries:
            cursor = db.execute(
                """
                INSERT INTO nutrition_entries
                (user_id, name, meal_type, calories, protein, carbs, fats,
                 notes, date, time, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id, e["name"], e.get("meal_type", "other"),
                    e.get("calories", 0), e.get("protein", 0.0),
                    e.get("carbs", 0.0), e.get("fats", 0.0),
                    e.get("notes", ""), e.get("date"), e.get("time"),
                    created_at, created_at,
                ),
            )
            ids.append(cursor.lastrowid)
        db.commit()
        return ids
