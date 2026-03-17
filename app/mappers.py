"""
FILE: app/mappers.py

Responsibility:
  SQLite row → dict mappers for tasks, meals, and workouts.
  Handles JSON column parsing, missing fields, and type coercion.

MUST NOT:
  - Import from Flask or db module
  - Modify database state

Depends on:
  - json (standard library)
  - DB schema column names (implicit coupling)

Note:
  Frontend (script.js) expects the exact shape these return.
  Any field changes require frontend updates too.
"""

import json


def map_task(row):
    date_value = row["date"]
    completed = bool(row["completed"])
    completed_at = row["updated_at"] if completed else None
    tags = []
    try:
        tags = json.loads(row["tags_json"] or "[]")
    except (TypeError, ValueError, KeyError):
        tags = []
    if not isinstance(tags, list):
        tags = []
    tags = [str(t).strip().lower() for t in tags if str(t).strip()]
    # note fields (may not exist in older DBs)
    try:
        note_content = row["note_content"] or ""
    except (IndexError, KeyError):
        note_content = ""
    try:
        note_saved = bool(row["note_saved_to_notes"])
    except (IndexError, KeyError):
        note_saved = False
    try:
        recurrence = row["recurrence"] or "none"
    except (IndexError, KeyError):
        recurrence = "none"
    try:
        recurrence_parent_id = row["recurrence_parent_id"]
    except (IndexError, KeyError):
        recurrence_parent_id = None

    try:
        project_id = row["project_id"]
    except (IndexError, KeyError):
        project_id = None

    try:
        focus_time = dict(row).get("focus_time_spent", 0)
    except (IndexError, KeyError, TypeError):
        focus_time = 0

    return {
        "id": row["id"],
        "project_id": project_id,
        "focus_time_spent": focus_time,
        "title": row["title"],
        "description": row["description"],
        "tags": tags,
        "category": row["category"],
        "priority": row["priority"],
        "completed": completed,
        "date": date_value,
        "completed_at": completed_at,
        "completedAt": completed_at,
        "time_spent": row["time_spent"],
        "note_content": note_content,
        "note_saved_to_notes": note_saved,
        "recurrence": recurrence,
        "recurrence_parent_id": recurrence_parent_id,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def map_meal(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "meal_type": row["meal_type"],
        "calories": row["calories"],
        "protein": row["protein"],
        "carbs": row["carbs"],
        "fats": row["fats"],
        "notes": row["notes"],
        "date": row["date"],
        "time": row["time"],
        "created_at": row["created_at"],
    }


def map_workout(row):
    exercises = []
    try:
        exercises = json.loads(row["exercises_json"] or "[]")
    except (TypeError, ValueError):
        exercises = []

    # Handle completed column (may not exist in older DBs)
    try:
        completed = bool(row["completed"])
    except (IndexError, KeyError):
        completed = False

    return {
        "id": row["id"],
        "name": row["name"],
        "type": row["type"],
        "duration": row["duration"],
        "calories_burned": row["calories_burned"],
        "exercises": exercises,
        "notes": row["notes"],
        "intensity": row["intensity"],
        "completed": completed,
        "date": row["date"],
        "time": row["time"],
        "created_at": row["created_at"],
    }


def map_workout_template(row):
    exercises = []
    try:
        exercises = json.loads(row["exercises_json"] or "[]")
    except (TypeError, ValueError):
        exercises = []

    return {
        "id": row["id"],
        "name": row["name"],
        "type": row["type"],
        "duration": row["duration"],
        "calories_burned": row["calories_burned"],
        "exercises": exercises,
        "notes": row["notes"],
        "intensity": row["intensity"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
