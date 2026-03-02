"""
FILE: app/api/ai_routes.py

Responsibility:
  AI Avatar chat endpoint, mentor context endpoint,
  AI analytics endpoint, and action execution endpoint.

MUST NOT:
  - Handle CRUD for domain resources directly
  - Bypass the confirmation flow for actions

Depends on:
  - ai_avatar (process_avatar_message, get_gemini_analytics)
  - points_engine (_get_or_create_progress, level_progress)
  - db.get_db(), mappers.*, utils.*
  - helpers.default_user_id()
"""


import json
from datetime import datetime

from flask import Blueprint, jsonify, request

from ..ai_avatar import get_gemini_analytics, process_avatar_message
from ..db import get_db
from ..mappers import map_task
from ..points_engine import _get_or_create_progress, level_progress
from ..utils import now_iso, safe_float, safe_int, today_str
from .helpers import default_user_id

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/api/mentor/context", methods=["GET"])
def mentor_context():
    db = get_db()
    user_id = default_user_id()
    date = today_str()

    task_rows = db.execute(
        "SELECT * FROM tasks WHERE user_id = ? AND date = ? ORDER BY id DESC",
        (user_id, date),
    ).fetchall()
    tasks_total = len(task_rows)
    tasks_completed = sum(1 for t in task_rows if t["completed"])
    tasks_pending = tasks_total - tasks_completed

    overdue_rows = db.execute(
        "SELECT title, date, priority FROM tasks WHERE user_id = ? AND date < ? AND completed = 0 ORDER BY date ASC LIMIT 10",
        (user_id, date),
    ).fetchall()
    overdue_tasks = [{"title": r["title"], "date": r["date"], "priority": r["priority"]} for r in overdue_rows]

    upcoming_tasks = [
        {"title": r["title"], "priority": r["priority"]}
        for r in task_rows if not r["completed"]
    ]

    nutrition = db.execute(
        """
        SELECT
          COALESCE(SUM(calories), 0) AS total_calories,
          COALESCE(SUM(protein), 0)  AS total_protein,
          COALESCE(SUM(carbs), 0)    AS total_carbs,
          COALESCE(SUM(fats), 0)     AS total_fats,
          COUNT(*)                    AS total_meals
        FROM nutrition_entries
        WHERE user_id = ? AND date = ?
        """,
        (user_id, date),
    ).fetchone()

    workout_rows = db.execute(
        "SELECT name, duration, calories_burned, completed FROM workouts WHERE user_id = ? AND date = ? ORDER BY id",
        (user_id, date),
    ).fetchall()
    workouts_total = len(workout_rows)
    workouts_completed = sum(1 for w in workout_rows if w["completed"])
    workout_names = [w["name"] for w in workout_rows if not w["completed"]]

    progress = _get_or_create_progress(db, user_id)
    lp = level_progress(progress["total_points"])

    context = {
        "date": date,
        "tasks": {
            "total": tasks_total,
            "completed": tasks_completed,
            "pending": tasks_pending,
            "overdue": overdue_tasks,
            "upcoming": upcoming_tasks,
        },
        "nutrition": {
            "meals_logged": nutrition["total_meals"] or 0,
            "calories_consumed": round(nutrition["total_calories"] or 0),
            "protein_consumed": round(nutrition["total_protein"] or 0, 1),
            "carbs_consumed": round(nutrition["total_carbs"] or 0, 1),
            "fats_consumed": round(nutrition["total_fats"] or 0, 1),
        },
        "workouts": {
            "total": workouts_total,
            "completed": workouts_completed,
            "pending_names": workout_names,
        },
        "progress": {
            "current_streak": progress["current_streak"],
            "longest_streak": progress["longest_streak"],
            "total_points": progress["total_points"],
            "level": lp[0],
            "level_pct": round(lp[3]),
        },
    }

    return jsonify(context), 200


@ai_bp.route("/api/ai/chat", methods=["POST"])
def ai_avatar_chat():
    default_user_id()  # Require auth
    req_data = request.get_json(silent=True) or {}
    message = (req_data.get("message") or "").strip()
    if not message:
        return jsonify({"status": "clarification_needed", "message": "Please type a message."}), 400

    context = req_data.get("context", {})
    context["today"] = today_str()
    mode = (req_data.get("mode") or "general").strip().lower()

    result = process_avatar_message(message, context, mode=mode)
    if isinstance(result, dict) and result.get("error"):
        return jsonify(result), 502
    return jsonify(result), 200


@ai_bp.route("/api/ai/analytics", methods=["GET"])
def ai_avatar_analytics():
    default_user_id()  # Require auth
    return jsonify(get_gemini_analytics()), 200


@ai_bp.route("/api/ai/execute", methods=["POST"])
def ai_avatar_execute():
    req_data = request.get_json(silent=True) or {}
    action_type = (req_data.get("action_type") or "").strip()
    payload = req_data.get("payload", {})
    confirmed = bool(req_data.get("confirmed"))

    if not action_type:
        return jsonify({"error": "action_type is required"}), 400
    if not confirmed:
        return jsonify({"error": "User confirmation is required before execution"}), 400

    db = get_db()
    created_at = now_iso()
    user_id = default_user_id()

    if action_type == "log_nutrition":
        items = payload.get("items", [])
        meal_type = (payload.get("meal_type") or "snack").lower()
        saved_ids = []

        for item in items:
            cursor = db.execute(
                """
                INSERT INTO nutrition_entries
                (user_id, name, meal_type, calories, protein, carbs, fats, notes, date, time, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    item.get("name", "Unknown"),
                    meal_type,
                    max(0, safe_int(item.get("calories"), 0)),
                    max(0.0, safe_float(item.get("protein"), 0.0)),
                    max(0.0, safe_float(item.get("carbs"), 0.0)),
                    max(0.0, safe_float(item.get("fats"), 0.0)),
                    f"AI Avatar | {item.get('note', '')}",
                    payload.get("date", today_str()),
                    payload.get("time", datetime.now().strftime("%H:%M")),
                    created_at,
                    created_at,
                ),
            )
            saved_ids.append(cursor.lastrowid)

        db.commit()
        return jsonify({"status": "executed", "action_type": "log_nutrition", "saved_ids": saved_ids, "count": len(saved_ids)}), 201

    elif action_type == "add_task":
        title = (payload.get("title") or "").strip()
        if not title:
            return jsonify({"error": "Task title is required"}), 400

        tags = payload.get("tags", [])
        if not isinstance(tags, list):
            tags = []

        cursor = db.execute(
            """
            INSERT INTO tasks
            (user_id, title, description, tags_json, category, priority, date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                title,
                payload.get("description", ""),
                json.dumps(tags),
                payload.get("category", "general"),
                payload.get("priority", "medium") if payload.get("priority") in ("low", "medium", "high") else "medium",
                payload.get("date", today_str()),
                created_at,
                created_at,
            ),
        )
        db.commit()
        row = db.execute("SELECT * FROM tasks WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return jsonify({"status": "executed", "action_type": "add_task", "task": map_task(row)}), 201

    elif action_type == "add_project":
        name = (payload.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Project name is required"}), 400

        cursor = db.execute(
            """
            INSERT INTO projects (user_id, name, description, due_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                name,
                payload.get("description", ""),
                payload.get("due_date") or None,
                created_at,
                created_at,
            ),
        )
        project_id = cursor.lastrowid

        subtasks = payload.get("subtasks", [])
        for idx, st in enumerate(subtasks):
            if isinstance(st, str) and st.strip():
                db.execute(
                    "INSERT INTO project_subtasks (project_id, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                    (project_id, st.strip(), idx, created_at, created_at),
                )

        db.commit()

        project_row = db.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        subtask_rows = db.execute(
            "SELECT * FROM project_subtasks WHERE project_id = ? ORDER BY sort_order", (project_id,)
        ).fetchall()

        return jsonify({
            "status": "executed",
            "action_type": "add_project",
            "project": {
                "id": project_row["id"],
                "name": project_row["name"],
                "description": project_row["description"],
                "status": project_row["status"],
                "due_date": project_row["due_date"],
                "subtasks": [{"id": s["id"], "title": s["title"], "completed": bool(s["completed"])} for s in subtask_rows],
            }
        }), 201

    elif action_type == "log_workout":
        name = (payload.get("name") or "Workout").strip()
        workout_type = (payload.get("type") or "other").strip()
        duration = max(0, safe_int(payload.get("duration"), 0))
        calories_burned = max(0, safe_int(payload.get("calories_burned"), 0))
        intensity_val = payload.get("intensity", "medium")
        if intensity_val not in ("low", "medium", "high"):
            intensity_val = "medium"
        exercises = payload.get("exercises", [])
        if not isinstance(exercises, list):
            exercises = []
        notes = (payload.get("notes") or "").strip()

        cursor = db.execute(
            """
            INSERT INTO workouts
            (user_id, name, type, duration, calories_burned, intensity, exercises_json, notes, date, time, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                name,
                workout_type,
                duration,
                calories_burned,
                intensity_val,
                json.dumps(exercises),
                f"AI Avatar | {notes}" if notes else "AI Avatar",
                payload.get("date", today_str()),
                payload.get("time", datetime.now().strftime("%H:%M")),
                created_at,
                created_at,
            ),
        )
        db.commit()
        return jsonify({"status": "executed", "action_type": "log_workout", "workout_id": cursor.lastrowid}), 201

    else:
        return jsonify({"error": f"Unknown action_type: {action_type}"}), 400
