"""
FILE: app/api/dashboard_routes.py

Responsibility:
  Serves the static index.html (web_bp) and provides
  the /api/data summary endpoint (dashboard_bp).

MUST NOT:
  - Contain CRUD logic for individual resources
  - Import from AI or points modules

Depends on:
  - db.get_db(), mappers.*, utils.today_str
  - helpers.default_user_id()
"""

from flask import Blueprint, current_app, jsonify, send_from_directory

from ..db import get_db
from ..mappers import map_meal, map_task, map_workout
from ..repositories.nutrition_repo import NutritionRepository
from ..repositories.task_repo import TaskRepository
from ..repositories.workout_repo import WorkoutRepository
from ..utils import today_str
from .helpers import default_user_id

web_bp = Blueprint("web", __name__)
dashboard_bp = Blueprint("dashboard", __name__)


@web_bp.route("/")
def index():
    return send_from_directory(str(current_app.config["STATIC_DIR"]), "index.html")


@web_bp.route("/shared/goal/<share_token>")
def shared_goal(share_token):
    """Serve shared goal page"""
    return send_from_directory(str(current_app.config["STATIC_DIR"]), "index.html")


@web_bp.route("/music/<path:filename>")
def serve_music(filename):
    root_dir = current_app.config["ROOT_DIR"]
    music_dir = root_dir / "Music"
    if not music_dir.exists():
        music_dir = root_dir / "music"
    return send_from_directory(str(music_dir), filename)


@dashboard_bp.route("/api/data", methods=["GET"])
def get_data_summary():
    db = get_db()
    date_filter = today_str()
    uid = default_user_id()
    TaskRepository.materialize_recurring_for_date(uid, date_filter)

    task_rows = TaskRepository.get_all(uid, date_filter)
    meal_rows = NutritionRepository.get_all(uid, date_filter)
    workout_rows = WorkoutRepository.get_all(uid, date_filter)

    tasks = [map_task(r) for r in task_rows]
    meals = [map_meal(r) for r in meal_rows]
    workouts = [map_workout(r) for r in workout_rows]
    total_calories = sum(m.get("calories", 0) for m in meals)

    user_row = db.execute(
        "SELECT calorie_goal, daily_calorie_delta FROM users WHERE id = ?",
        (uid,),
    ).fetchone()
    base_goal = int(user_row["calorie_goal"]) if user_row and user_row["calorie_goal"] is not None else 2200
    daily_delta = float(user_row["daily_calorie_delta"] or 0.0) if user_row else 0.0
    adjusted_goal = int(round(base_goal + daily_delta))
    if adjusted_goal < 500:
        adjusted_goal = 500
    remaining = adjusted_goal - total_calories
    budget_pct = round((total_calories / adjusted_goal) * 100, 1) if adjusted_goal > 0 else 0.0

    return jsonify({
        "tasks": tasks,
        "meals": meals,
        "workouts": workouts,
        "summary": {
            "completed_tasks": len([t for t in tasks if t["completed"]]),
            "total_tasks": len(tasks),
            "total_calories": total_calories,
            "workout_time": sum(w.get("duration", 0) for w in workouts),
            "calories_burned": sum(w.get("calories_burned", 0) for w in workouts),
            "nutrition_budget": {
                "consumed": total_calories,
                "goal": adjusted_goal,
                "base_goal": base_goal,
                "daily_delta": daily_delta,
                "remaining": remaining,
                "over_goal": remaining < 0,
                "pct_of_goal": budget_pct,
            },
        },
    })
