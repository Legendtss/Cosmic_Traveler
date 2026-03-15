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
    def _parse_ymd(value):
        try:
            return datetime.strptime(value, "%Y-%m-%d").date()
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _bucket_key(day_obj, granularity):
        if granularity == "monthly":
            return day_obj.replace(day=1).strftime("%Y-%m-%d")
        if granularity == "weekly":
            return (day_obj - timedelta(days=day_obj.weekday())).strftime("%Y-%m-%d")
        return day_obj.strftime("%Y-%m-%d")

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
    def period_summary(user_id, start_date, end_date):
        """Aggregate summary across an arbitrary date range."""
        db = get_db()

        task_totals = db.execute(
            """
            SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed,
              SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END) AS pending,
              COALESCE(SUM(time_spent), 0) AS time_spent
            FROM tasks
            WHERE user_id = ? AND date BETWEEN ? AND ?
            """,
            (user_id, start_date, end_date),
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
            WHERE user_id = ? AND date BETWEEN ? AND ?
            """,
            (user_id, start_date, end_date),
        ).fetchone()

        workout_totals = db.execute(
            """
            SELECT
              COUNT(*) AS total_workouts,
              SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_workouts,
              COALESCE(SUM(duration), 0) AS total_duration,
              COALESCE(SUM(calories_burned), 0) AS total_calories_burned
            FROM workouts
            WHERE user_id = ? AND date BETWEEN ? AND ?
            """,
            (user_id, start_date, end_date),
        ).fetchone()

        return {
            "range": {"start_date": start_date, "end_date": end_date},
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
                "completed_workouts": workout_totals["completed_workouts"] or 0,
                "total_duration": workout_totals["total_duration"] or 0,
                "total_calories_burned": workout_totals["total_calories_burned"] or 0,
            },
        }

    @staticmethod
    def feature_trends(user_id, start_date, end_date, granularity="daily"):
        """Return per-feature trend buckets between start_date and end_date."""
        start_obj = AnalyticsRepository._parse_ymd(start_date)
        end_obj = AnalyticsRepository._parse_ymd(end_date)
        if not start_obj or not end_obj or start_obj > end_obj:
            return []

        mode = (granularity or "daily").strip().lower()
        if mode not in {"daily", "weekly", "monthly"}:
            mode = "daily"

        db = get_db()

        task_rows = db.execute(
            """
            SELECT date, COUNT(*) AS tasks_completed
            FROM tasks
            WHERE user_id = ?
              AND date BETWEEN ? AND ?
              AND completed = 1
            GROUP BY date
            """,
            (user_id, start_date, end_date),
        ).fetchall()

        nutr_rows = db.execute(
            """
            SELECT
              date,
              COALESCE(SUM(calories), 0) AS calories_consumed,
              COALESCE(SUM(protein), 0) AS protein_consumed,
              COALESCE(SUM(carbs), 0) AS carbs_consumed,
              COALESCE(SUM(fats), 0) AS fats_consumed
            FROM nutrition_entries
            WHERE user_id = ?
              AND date BETWEEN ? AND ?
            GROUP BY date
            """,
            (user_id, start_date, end_date),
        ).fetchall()

        work_rows = db.execute(
            """
            SELECT
              date,
              SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS workouts_completed,
              COALESCE(SUM(duration), 0) AS workout_minutes,
              COALESCE(SUM(calories_burned), 0) AS calories_burned
            FROM workouts
            WHERE user_id = ?
              AND date BETWEEN ? AND ?
            GROUP BY date
            """,
            (user_id, start_date, end_date),
        ).fetchall()

        buckets = {}

        day = start_obj
        while day <= end_obj:
            key = AnalyticsRepository._bucket_key(day, mode)
            if key not in buckets:
                buckets[key] = {
                    "date": key,
                    "granularity": mode,
                    "tasks_completed": 0,
                    "calories_consumed": 0,
                    "protein_consumed": 0,
                    "carbs_consumed": 0,
                    "fats_consumed": 0,
                    "workouts_completed": 0,
                    "workout_minutes": 0,
                    "calories_burned": 0,
                }
            day += timedelta(days=1)

        for row in task_rows:
            day_obj = AnalyticsRepository._parse_ymd(row["date"])
            if not day_obj:
                continue
            key = AnalyticsRepository._bucket_key(day_obj, mode)
            buckets[key]["tasks_completed"] += row["tasks_completed"] or 0

        for row in nutr_rows:
            day_obj = AnalyticsRepository._parse_ymd(row["date"])
            if not day_obj:
                continue
            key = AnalyticsRepository._bucket_key(day_obj, mode)
            bucket = buckets[key]
            bucket["calories_consumed"] += row["calories_consumed"] or 0
            bucket["protein_consumed"] += row["protein_consumed"] or 0
            bucket["carbs_consumed"] += row["carbs_consumed"] or 0
            bucket["fats_consumed"] += row["fats_consumed"] or 0

        for row in work_rows:
            day_obj = AnalyticsRepository._parse_ymd(row["date"])
            if not day_obj:
                continue
            key = AnalyticsRepository._bucket_key(day_obj, mode)
            bucket = buckets[key]
            bucket["workouts_completed"] += row["workouts_completed"] or 0
            bucket["workout_minutes"] += row["workout_minutes"] or 0
            bucket["calories_burned"] += row["calories_burned"] or 0

        return [buckets[k] for k in sorted(buckets.keys())]

    @staticmethod
    def weekly_stats(user_id, start_date=None, end_date=None, granularity="daily"):
        """Backward-compatible trend endpoint (default = last 7 days daily)."""
        if not start_date or not end_date:
            today = datetime.now().date()
            week_ago = today - timedelta(days=6)
            start_date = week_ago.strftime("%Y-%m-%d")
            end_date = today.strftime("%Y-%m-%d")
        return AnalyticsRepository.feature_trends(
            user_id,
            start_date,
            end_date,
            granularity=granularity,
        )
