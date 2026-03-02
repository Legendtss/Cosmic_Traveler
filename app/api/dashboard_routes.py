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
from ..utils import today_str
from .helpers import default_user_id

web_bp = Blueprint("web", __name__)
dashboard_bp = Blueprint("dashboard", __name__)


@web_bp.route("/")
def index():
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

    task_rows = db.execute(
        "SELECT * FROM tasks WHERE user_id = ? AND date = ? ORDER BY id DESC",
        (default_user_id(), date_filter),
    ).fetchall()
    meal_rows = db.execute(
        "SELECT * FROM nutrition_entries WHERE user_id = ? AND date = ? ORDER BY id DESC",
        (default_user_id(), date_filter),
    ).fetchall()
    workout_rows = db.execute(
        "SELECT * FROM workouts WHERE user_id = ? AND date = ? ORDER BY id DESC",
        (default_user_id(), date_filter),
    ).fetchall()

    tasks = [map_task(r) for r in task_rows]
    meals = [map_meal(r) for r in meal_rows]
    workouts = [map_workout(r) for r in workout_rows]

    return jsonify({
        "tasks": tasks,
        "meals": meals,
        "workouts": workouts,
        "summary": {
            "completed_tasks": len([t for t in tasks if t["completed"]]),
            "total_tasks": len(tasks),
            "total_calories": sum(m.get("calories", 0) for m in meals),
            "workout_time": sum(w.get("duration", 0) for w in workouts),
            "calories_burned": sum(w.get("calories_burned", 0) for w in workouts),
        },
    })
