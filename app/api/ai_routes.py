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
  - points_engine (get_or_create_progress, level_progress)
  - db.get_db(), mappers.*, utils.*
  - helpers.default_user_id()
"""


import json
from datetime import datetime

from flask import Blueprint, jsonify, request

from ..ai_avatar import get_gemini_analytics, process_avatar_message
from ..db import get_db
from ..mappers import map_task
from ..points_engine import get_or_create_progress, level_progress
from ..repositories.nutrition_repo import NutritionRepository
from ..repositories.project_repo import ProjectRepository
from ..repositories.task_repo import TaskRepository
from ..repositories.workout_repo import WorkoutRepository
from ..utils import safe_float, safe_int, today_str
from .helpers import default_user_id

ai_bp = Blueprint("ai", __name__)


@ai_bp.route("/api/mentor/context", methods=["GET"])
def mentor_context():
    db = get_db()
    user_id = default_user_id()
    date = today_str()

    task_rows = TaskRepository.get_all(user_id, date_filter=date)
    tasks_total = len(task_rows)
    tasks_completed = sum(1 for t in task_rows if t["completed"])
    tasks_pending = tasks_total - tasks_completed

    overdue_rows = TaskRepository.get_overdue(user_id, before_date=date, limit=10)
    overdue_tasks = [{"title": r["title"], "date": r["date"], "priority": r["priority"]} for r in overdue_rows]

    upcoming_tasks = [
        {"title": r["title"], "priority": r["priority"]}
        for r in task_rows if not r["completed"]
    ]

    nutrition_rows = NutritionRepository.get_all(user_id, date_filter=date)
    total_calories = sum(r["calories"] or 0 for r in nutrition_rows)
    total_protein = sum(r["protein"] or 0 for r in nutrition_rows)
    total_carbs = sum(r["carbs"] or 0 for r in nutrition_rows)
    total_fats = sum(r["fats"] or 0 for r in nutrition_rows)
    total_meals = len(nutrition_rows)

    workout_rows = WorkoutRepository.get_all(user_id, date_filter=date)
    workouts_total = len(workout_rows)
    workouts_completed = sum(1 for w in workout_rows if w["completed"])
    workout_names = [w["name"] for w in workout_rows if not w["completed"]]

    progress = get_or_create_progress(db, user_id)
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
            "meals_logged": total_meals,
            "calories_consumed": round(total_calories),
            "protein_consumed": round(total_protein, 1),
            "carbs_consumed": round(total_carbs, 1),
            "fats_consumed": round(total_fats, 1),
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
    user_id = default_user_id()  # Require auth
    req_data = request.get_json(silent=True) or {}
    message = (req_data.get("message") or "").strip()
    if not message:
        return jsonify({"status": "clarification_needed", "message": "Please type a message."}), 400

    context = req_data.get("context", {})
    context["today"] = today_str()
    context["user_id"] = user_id
    mode = (req_data.get("mode") or "general").strip().lower()

    result = process_avatar_message(message, context, mode=mode)
    if isinstance(result, dict) and result.get("error"):
        return jsonify({"status": "manual_fallback", "message": "AI service is temporarily unavailable."}), 502
    return jsonify(result), 200


@ai_bp.route("/api/ai/analytics", methods=["GET"])
def ai_avatar_analytics():
    default_user_id()  # Require auth
    return jsonify(get_gemini_analytics()), 200


@ai_bp.route("/api/ai/execute", methods=["POST"])
def ai_avatar_execute():
    user_id = default_user_id()  # Require auth before payload validation
    req_data = request.get_json(silent=True) or {}
    action_type = (req_data.get("action_type") or "").strip()
    payload = req_data.get("payload", {})
    confirmed = bool(req_data.get("confirmed"))

    if not action_type:
        return jsonify({"error": "action_type is required"}), 400
    if not confirmed:
        return jsonify({"error": "User confirmation is required before execution"}), 400

    if action_type == "log_nutrition":
        items = payload.get("items", [])
        meal_type = (payload.get("meal_type") or "snack").lower()
        date = payload.get("date", today_str())
        time_val = payload.get("time", datetime.now().strftime("%H:%M"))

        entries = []
        for item in items:
            qty = safe_float(item.get("quantity"), 1.0)
            if qty <= 0:
                qty = 1.0
            unit = str(item.get("unit") or "serving").strip() or "serving"
            note_bits = ["AI Avatar"]
            item_note = str(item.get("note") or "").strip()
            if item_note:
                note_bits.append(item_note)
            note_bits.append(f"qty={round(qty, 2)} {unit}")
            entries.append({
                "name": item.get("name", "Unknown"),
                "meal_type": meal_type,
                "calories": max(0, safe_int(item.get("calories"), 0)),
                "protein": max(0.0, safe_float(item.get("protein"), 0.0)),
                "carbs": max(0.0, safe_float(item.get("carbs"), 0.0)),
                "fats": max(0.0, safe_float(item.get("fats"), 0.0)),
                "notes": " | ".join(note_bits),
                "date": date,
                "time": time_val,
            })

        saved_ids = NutritionRepository.bulk_create(user_id, entries)
        return jsonify({"status": "executed", "action_type": "log_nutrition", "saved_ids": saved_ids, "count": len(saved_ids)}), 201

    elif action_type == "add_task":
        title = (payload.get("title") or "").strip()
        if not title:
            return jsonify({"error": "Task title is required"}), 400

        tags = payload.get("tags", [])
        if not isinstance(tags, list):
            tags = []

        priority = payload.get("priority", "medium")
        if priority not in ("low", "medium", "high"):
            priority = "medium"
        recurrence = str(payload.get("recurrence", "none") or "none").strip().lower()
        if recurrence not in ("none", "daily", "weekly", "weekdays"):
            recurrence = "none"

        task_id, _ = TaskRepository.create(
            user_id,
            title=title,
            description=payload.get("description", ""),
            tags_json=json.dumps(tags),
            category=payload.get("category", "general"),
            priority=priority,
            date=payload.get("date", today_str()),
            recurrence=recurrence,
        )
        row = TaskRepository.get_by_id(task_id, user_id)
        return jsonify({"status": "executed", "action_type": "add_task", "task": map_task(row)}), 201

    elif action_type == "add_project":
        name = (payload.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Project name is required"}), 400

        project_row, subtask_rows = ProjectRepository.create(
            user_id,
            name=name,
            description=payload.get("description", ""),
            due_date=payload.get("due_date") or None,
            subtasks=payload.get("subtasks", []),
        )

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
        workout_type = (payload.get("type") or "other").strip().lower()
        if workout_type not in ("cardio", "strength", "flexibility", "sports", "other"):
            workout_type = "other"
        duration = max(0, safe_int(payload.get("duration"), 0))
        calories_burned = max(0, safe_int(payload.get("calories_burned"), 0))
        intensity_val = payload.get("intensity", "medium")
        if intensity_val not in ("low", "medium", "high"):
            intensity_val = "medium"
        exercises = payload.get("exercises", [])
        if not isinstance(exercises, list):
            exercises = []
        notes = (payload.get("notes") or "").strip()

        row = WorkoutRepository.create(
            user_id,
            name=name,
            workout_type=workout_type,
            duration=duration,
            calories_burned=calories_burned,
            intensity=intensity_val,
            exercises=exercises,
            notes=f"AI Avatar | {notes}" if notes else "AI Avatar",
            date=payload.get("date", today_str()),
            time=payload.get("time", datetime.now().strftime("%H:%M")),
        )
        return jsonify({"status": "executed", "action_type": "log_workout", "workout_id": row["id"]}), 201

    else:
        return jsonify({"error": f"Unknown action_type: {action_type}"}), 400
