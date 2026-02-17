import json
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request, send_from_directory

from ..db import get_db
from ..mappers import map_meal, map_task, map_workout
from ..utils import now_iso, safe_float, safe_int, today_str

web_bp = Blueprint("web", __name__)
api_bp = Blueprint("api", __name__)


def _default_user_id():
    return current_app.config["DEFAULT_USER_ID"]


def _normalize_tags(value):
    if not isinstance(value, list):
        return []
    out = []
    seen = set()
    for raw in value:
        tag = str(raw or "").strip().lower()
        if not tag or tag in seen:
            continue
        seen.add(tag)
        out.append(tag)
    return out


@web_bp.route("/")
def index():
    return send_from_directory(str(current_app.config["STATIC_DIR"]), "index.html")


@api_bp.route("/api/data", methods=["GET"])
def get_data_summary():
    db = get_db()
    date_filter = today_str()

    task_rows = db.execute(
        "SELECT * FROM tasks WHERE user_id = ? AND date = ? ORDER BY id DESC",
        (_default_user_id(), date_filter),
    ).fetchall()
    meal_rows = db.execute(
        "SELECT * FROM nutrition_entries WHERE user_id = ? AND date = ? ORDER BY id DESC",
        (_default_user_id(), date_filter),
    ).fetchall()
    workout_rows = db.execute(
        "SELECT * FROM workouts WHERE user_id = ? AND date = ? ORDER BY id DESC",
        (_default_user_id(), date_filter),
    ).fetchall()

    tasks = [map_task(r) for r in task_rows]
    meals = [map_meal(r) for r in meal_rows]
    workouts = [map_workout(r) for r in workout_rows]

    return jsonify(
        {
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
        }
    )


@api_bp.route("/api/tasks", methods=["GET"])
def get_tasks():
    db = get_db()
    date_filter = request.args.get("date")

    if date_filter:
        rows = db.execute(
            "SELECT * FROM tasks WHERE user_id = ? AND date = ? ORDER BY id DESC",
            (_default_user_id(), date_filter),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM tasks WHERE user_id = ? ORDER BY id DESC",
            (_default_user_id(),),
        ).fetchall()

    return jsonify([map_task(r) for r in rows])


@api_bp.route("/api/tasks", methods=["POST"])
def create_task():
    db = get_db()
    req_data = request.get_json(silent=True) or {}

    title = (req_data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    priority = req_data.get("priority", "medium")
    if priority not in ("low", "medium", "high"):
        priority = "medium"
    due_at = req_data.get("due_at") or req_data.get("dueAt")
    due_date = req_data.get("date")
    if not due_date and isinstance(due_at, str) and due_at:
        due_date = due_at.split("T")[0]
    if not due_date:
        due_date = today_str()

    created_at = now_iso()
    tags = _normalize_tags(req_data.get("tags"))
    cursor = db.execute(
        """
        INSERT INTO tasks
        (user_id, project_id, title, description, tags_json, category, priority, completed, date, time_spent, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            _default_user_id(),
            req_data.get("project_id"),
            title,
            req_data.get("description", ""),
            json.dumps(tags),
            req_data.get("category", "general"),
            priority,
            0,
            due_date,
            0,
            created_at,
            created_at,
        ),
    )
    db.commit()

    row = db.execute("SELECT * FROM tasks WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify(map_task(row)), 201


@api_bp.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    db = get_db()
    row = db.execute(
        "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
        (task_id, _default_user_id()),
    ).fetchone()
    if not row:
        return jsonify({"error": "Task not found"}), 404

    req_data = request.get_json(silent=True) or {}

    title = req_data.get("title", row["title"])
    description = req_data.get("description", row["description"])
    category = req_data.get("category", row["category"])
    priority = req_data.get("priority", row["priority"])
    completed = req_data.get("completed", bool(row["completed"]))
    time_spent = req_data.get("time_spent", row["time_spent"])
    tags_json = row["tags_json"] if "tags_json" in row.keys() else "[]"
    if "tags" in req_data:
        tags_json = json.dumps(_normalize_tags(req_data.get("tags")))
    due_at = req_data.get("due_at") or req_data.get("dueAt")
    due_date = req_data.get("date", row["date"])
    if isinstance(due_at, str) and due_at:
        due_date = due_at.split("T")[0]

    if priority not in ("low", "medium", "high"):
        priority = row["priority"]

    db.execute(
        """
        UPDATE tasks
        SET title = ?, description = ?, tags_json = ?, category = ?, priority = ?, completed = ?, date = ?, time_spent = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
        """,
        (
            title,
            description,
            tags_json,
            category,
            priority,
            1 if completed else 0,
            due_date,
            max(0, safe_int(time_spent, row["time_spent"])),
            now_iso(),
            task_id,
            _default_user_id(),
        ),
    )
    db.commit()

    updated = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return jsonify(map_task(updated))


@api_bp.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    db = get_db()
    result = db.execute(
        "DELETE FROM tasks WHERE id = ? AND user_id = ?",
        (task_id, _default_user_id()),
    )
    db.commit()

    if result.rowcount == 0:
        return jsonify({"error": "Task not found"}), 404

    return jsonify({"message": "Task deleted successfully"}), 200


@api_bp.route("/api/tasks/<int:task_id>/toggle", methods=["PATCH"])
def toggle_task(task_id):
    db = get_db()
    row = db.execute(
        "SELECT * FROM tasks WHERE id = ? AND user_id = ?",
        (task_id, _default_user_id()),
    ).fetchone()
    if not row:
        return jsonify({"error": "Task not found"}), 404

    db.execute(
        "UPDATE tasks SET completed = ?, updated_at = ? WHERE id = ? AND user_id = ?",
        (0 if row["completed"] else 1, now_iso(), task_id, _default_user_id()),
    )
    db.commit()

    updated = db.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return jsonify(map_task(updated))


@api_bp.route("/api/meals", methods=["GET"])
def get_meals():
    db = get_db()
    date_filter = request.args.get("date")
    if date_filter:
        rows = db.execute(
            "SELECT * FROM nutrition_entries WHERE user_id = ? AND date = ? ORDER BY id DESC",
            (_default_user_id(), date_filter),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM nutrition_entries WHERE user_id = ? ORDER BY id DESC",
            (_default_user_id(),),
        ).fetchall()
    return jsonify([map_meal(r) for r in rows])


@api_bp.route("/api/meals", methods=["POST"])
def create_meal():
    db = get_db()
    req_data = request.get_json(silent=True) or {}

    name = (req_data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Meal name is required"}), 400

    created_at = now_iso()
    cursor = db.execute(
        """
        INSERT INTO nutrition_entries
        (user_id, name, meal_type, calories, protein, carbs, fats, notes, date, time, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            _default_user_id(),
            name,
            req_data.get("meal_type", "other"),
            max(0, safe_int(req_data.get("calories"), 0)),
            max(0.0, safe_float(req_data.get("protein", 0), 0.0)),
            max(0.0, safe_float(req_data.get("carbs", 0), 0.0)),
            max(0.0, safe_float(req_data.get("fats", 0), 0.0)),
            req_data.get("notes", ""),
            req_data.get("date", today_str()),
            req_data.get("time", datetime.now().strftime("%H:%M")),
            created_at,
            created_at,
        ),
    )
    db.commit()

    row = db.execute("SELECT * FROM nutrition_entries WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify(map_meal(row)), 201


@api_bp.route("/api/meals/<int:meal_id>", methods=["PUT"])
def update_meal(meal_id):
    db = get_db()
    row = db.execute(
        "SELECT * FROM nutrition_entries WHERE id = ? AND user_id = ?",
        (meal_id, _default_user_id()),
    ).fetchone()
    if not row:
        return jsonify({"error": "Meal not found"}), 404

    req_data = request.get_json(silent=True) or {}

    db.execute(
        """
        UPDATE nutrition_entries
        SET name = ?, meal_type = ?, calories = ?, protein = ?, carbs = ?, fats = ?, notes = ?,
            date = ?, time = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
        """,
        (
            req_data.get("name", row["name"]),
            req_data.get("meal_type", row["meal_type"]),
            max(0, safe_int(req_data.get("calories", row["calories"]), row["calories"])),
            max(0.0, safe_float(req_data.get("protein", row["protein"]), row["protein"])),
            max(0.0, safe_float(req_data.get("carbs", row["carbs"]), row["carbs"])),
            max(0.0, safe_float(req_data.get("fats", row["fats"]), row["fats"])),
            req_data.get("notes", row["notes"]),
            req_data.get("date", row["date"]),
            req_data.get("time", row["time"]),
            now_iso(),
            meal_id,
            _default_user_id(),
        ),
    )
    db.commit()

    updated = db.execute("SELECT * FROM nutrition_entries WHERE id = ?", (meal_id,)).fetchone()
    return jsonify(map_meal(updated))


@api_bp.route("/api/meals/<int:meal_id>", methods=["DELETE"])
def delete_meal(meal_id):
    db = get_db()
    result = db.execute(
        "DELETE FROM nutrition_entries WHERE id = ? AND user_id = ?",
        (meal_id, _default_user_id()),
    )
    db.commit()

    if result.rowcount == 0:
        return jsonify({"error": "Meal not found"}), 404

    return jsonify({"message": "Meal deleted successfully"}), 200


@api_bp.route("/api/workouts", methods=["GET"])
def get_workouts():
    db = get_db()
    date_filter = request.args.get("date")
    if date_filter:
        rows = db.execute(
            "SELECT * FROM workouts WHERE user_id = ? AND date = ? ORDER BY id DESC",
            (_default_user_id(), date_filter),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM workouts WHERE user_id = ? ORDER BY id DESC",
            (_default_user_id(),),
        ).fetchall()
    return jsonify([map_workout(r) for r in rows])


@api_bp.route("/api/workouts", methods=["POST"])
def create_workout():
    db = get_db()
    req_data = request.get_json(silent=True) or {}

    name = (req_data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Workout name is required"}), 400

    intensity = req_data.get("intensity", "medium")
    if intensity not in ("low", "medium", "high"):
        intensity = "medium"

    exercises = req_data.get("exercises", [])
    if not isinstance(exercises, list):
        exercises = []

    created_at = now_iso()
    cursor = db.execute(
        """
        INSERT INTO workouts
        (user_id, name, type, duration, calories_burned, exercises_json, notes, intensity, date, time, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            _default_user_id(),
            name,
            req_data.get("type", "other"),
            max(0, safe_int(req_data.get("duration"), 0)),
            max(0, safe_int(req_data.get("calories_burned"), 0)),
            json.dumps(exercises),
            req_data.get("notes", ""),
            intensity,
            req_data.get("date", today_str()),
            req_data.get("time", datetime.now().strftime("%H:%M")),
            created_at,
            created_at,
        ),
    )
    db.commit()

    row = db.execute("SELECT * FROM workouts WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify(map_workout(row)), 201


@api_bp.route("/api/workouts/<int:workout_id>", methods=["PUT"])
def update_workout(workout_id):
    db = get_db()
    row = db.execute(
        "SELECT * FROM workouts WHERE id = ? AND user_id = ?",
        (workout_id, _default_user_id()),
    ).fetchone()
    if not row:
        return jsonify({"error": "Workout not found"}), 404

    req_data = request.get_json(silent=True) or {}

    intensity = req_data.get("intensity", row["intensity"])
    if intensity not in ("low", "medium", "high"):
        intensity = row["intensity"]

    exercises = req_data.get("exercises")
    if exercises is None:
        try:
            exercises = json.loads(row["exercises_json"] or "[]")
        except (TypeError, ValueError):
            exercises = []
    if not isinstance(exercises, list):
        exercises = []

    db.execute(
        """
        UPDATE workouts
        SET name = ?, type = ?, duration = ?, calories_burned = ?, exercises_json = ?, notes = ?, intensity = ?,
            date = ?, time = ?, updated_at = ?
        WHERE id = ? AND user_id = ?
        """,
        (
            req_data.get("name", row["name"]),
            req_data.get("type", row["type"]),
            max(0, safe_int(req_data.get("duration", row["duration"]), row["duration"])),
            max(0, safe_int(req_data.get("calories_burned", row["calories_burned"]), row["calories_burned"])),
            json.dumps(exercises),
            req_data.get("notes", row["notes"]),
            intensity,
            req_data.get("date", row["date"]),
            req_data.get("time", row["time"]),
            now_iso(),
            workout_id,
            _default_user_id(),
        ),
    )
    db.commit()

    updated = db.execute("SELECT * FROM workouts WHERE id = ?", (workout_id,)).fetchone()
    return jsonify(map_workout(updated))


@api_bp.route("/api/workouts/<int:workout_id>", methods=["DELETE"])
def delete_workout(workout_id):
    db = get_db()
    result = db.execute(
        "DELETE FROM workouts WHERE id = ? AND user_id = ?",
        (workout_id, _default_user_id()),
    )
    db.commit()

    if result.rowcount == 0:
        return jsonify({"error": "Workout not found"}), 404

    return jsonify({"message": "Workout deleted successfully"}), 200


@api_bp.route("/api/analytics/summary", methods=["GET"])
def get_summary():
    db = get_db()
    date_filter = request.args.get("date", today_str())

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
        (_default_user_id(), date_filter),
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
        (_default_user_id(), date_filter),
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
        (_default_user_id(), date_filter),
    ).fetchone()

    summary = {
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

    return jsonify(summary)


@api_bp.route("/api/analytics/weekly", methods=["GET"])
def get_weekly_stats():
    db = get_db()
    today = datetime.now()
    week_ago = today - timedelta(days=6)

    weekly_data = []
    for i in range(7):
        date = (week_ago + timedelta(days=i)).strftime("%Y-%m-%d")

        task_completed = db.execute(
            "SELECT COUNT(*) AS c FROM tasks WHERE user_id = ? AND date = ? AND completed = 1",
            (_default_user_id(), date),
        ).fetchone()["c"]

        nutrition = db.execute(
            """
            SELECT
              COALESCE(SUM(calories), 0) AS calories_consumed
            FROM nutrition_entries
            WHERE user_id = ? AND date = ?
            """,
            (_default_user_id(), date),
        ).fetchone()

        workouts = db.execute(
            """
            SELECT
              COALESCE(SUM(duration), 0) AS workout_minutes,
              COALESCE(SUM(calories_burned), 0) AS calories_burned
            FROM workouts
            WHERE user_id = ? AND date = ?
            """,
            (_default_user_id(), date),
        ).fetchone()

        weekly_data.append(
            {
                "date": date,
                "tasks_completed": task_completed or 0,
                "calories_consumed": nutrition["calories_consumed"] or 0,
                "workout_minutes": workouts["workout_minutes"] or 0,
                "calories_burned": workouts["calories_burned"] or 0,
            }
        )

    return jsonify(weekly_data)
