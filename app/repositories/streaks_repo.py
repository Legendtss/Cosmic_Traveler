"""
FILE: app/repositories/streaks_repo.py

Responsibility:
  Data-access layer for streak evaluation and cross-domain analytics.
  Encapsulates the raw SQL for analytics/summary and weekly aggregation.
  Points-engine calls are delegated through, not replaced.

MUST NOT:
  - Import Flask request/response objects
  - Contain HTTP/validation logic

Depends on:
  - db.get_db()
  - points_engine (evaluate_and_save, get_recent_activities,
    check_achievements, level_progress, get_or_create_progress)
"""

from datetime import datetime, timedelta

from ..db import get_db
from ..points_engine import (
    get_or_create_progress,
    check_achievements,
    evaluate_and_save,
    get_recent_activities,
    level_progress,
)


class StreaksRepository:
    """Wraps points-engine calls for route handlers."""

    @staticmethod
    def evaluate(user_id, date, protein_goal):
        db = get_db()
        return evaluate_and_save(db, user_id, date, protein_goal)

    @staticmethod
    def full_progress(user_id, date, protein_goal):
        db = get_db()
        result = evaluate_and_save(db, user_id, date, protein_goal)
        activities = get_recent_activities(db, user_id, limit=10, protein_goal=protein_goal)
        achievements = check_achievements(db, user_id, result["progress"])
        result["activities"] = activities
        result["achievements"] = achievements
        return result


class AnalyticsRepository:
    """Cross-domain aggregate queries for analytics endpoints."""

    @staticmethod
    def daily_summary(user_id, date):
        db = get_db()

        task_totals = db.execute(
            """
            SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS pending,
              COALESCE(SUM(time_spent), 0) AS time_spent
            FROM tasks
            WHERE user_id = ? AND date = ?
            """,
            (user_id, date),
        ).fetchone()

        nutrition_totals = db.execute(
            """
            SELECT
              COUNT(*) AS total_meals,
              COALESCE(SUM(calories), 0) AS total_calories,
              COALESCE(SUM(protein), 0) AS total_protein,
              COALESCE(SUM(carbs), 0) AS total_carbs,
              COALESCE(SUM(fats), 0) AS total_fats
            FROM nutrition_entries
            WHERE user_id = ? AND date = ?
            """,
            (user_id, date),
        ).fetchone()

        workout_totals = db.execute(
            """
            SELECT
              COUNT(*) AS total_workouts,
              COALESCE(SUM(duration), 0) AS total_duration,
              COALESCE(SUM(calories_burned), 0) AS total_calories_burned
            FROM workouts
            WHERE user_id = ? AND date = ?
            """,
            (user_id, date),
        ).fetchone()

        return {
            "tasks": {
                "total": task_totals["total"] or 0,
                "completed": task_totals["completed"] or 0,
                "pending": task_totals["pending"] or 0,
                "time_spent": task_totals["time_spent"] or 0,
            },
            "nutrition": {
                "total_meals": nutrition_totals["total_meals"] or 0,
                "total_calories": nutrition_totals["total_calories"] or 0,
                "total_protein": nutrition_totals["total_protein"] or 0,
                "total_carbs": nutrition_totals["total_carbs"] or 0,
                "total_fats": nutrition_totals["total_fats"] or 0,
            },
            "workouts": {
                "total_workouts": workout_totals["total_workouts"] or 0,
                "total_duration": workout_totals["total_duration"] or 0,
                "total_calories_burned": workout_totals["total_calories_burned"] or 0,
            },
        }

    @staticmethod
    def weekly_stats(user_id):
        db = get_db()
        today = datetime.now()
        week_ago = today - timedelta(days=6)

        start_date = week_ago.strftime("%Y-%m-%d")
        end_date = today.strftime("%Y-%m-%d")

        # 3 queries instead of 21 (was 3 × 7 days)
        task_rows = db.execute(
            """SELECT date, COUNT(*) AS c FROM tasks
               WHERE user_id = ? AND date BETWEEN ? AND ? AND completed = 1
               GROUP BY date""",
            (user_id, start_date, end_date),
        ).fetchall()
        task_map = {r["date"]: r["c"] for r in task_rows}

        nutr_rows = db.execute(
            """SELECT date, COALESCE(SUM(calories), 0) AS calories_consumed
               FROM nutrition_entries
               WHERE user_id = ? AND date BETWEEN ? AND ?
               GROUP BY date""",
            (user_id, start_date, end_date),
        ).fetchall()
        nutr_map = {r["date"]: r["calories_consumed"] for r in nutr_rows}

        work_rows = db.execute(
            """SELECT date,
                      COALESCE(SUM(duration), 0)        AS workout_minutes,
                      COALESCE(SUM(calories_burned), 0)  AS calories_burned
               FROM workouts
               WHERE user_id = ? AND date BETWEEN ? AND ?
               GROUP BY date""",
            (user_id, start_date, end_date),
        ).fetchall()
        work_map = {r["date"]: r for r in work_rows}

        weekly_data = []
        for i in range(7):
            date = (week_ago + timedelta(days=i)).strftime("%Y-%m-%d")
            w = work_map.get(date, {})
            weekly_data.append({
                "date": date,
                "tasks_completed": task_map.get(date, 0),
                "calories_consumed": nutr_map.get(date, 0),
                "workout_minutes": w.get("workout_minutes", 0) or 0,
                "calories_burned": w.get("calories_burned", 0) or 0,
            })

        return weekly_data
