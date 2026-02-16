import json


def map_task(row):
    date_value = row["date"]
    due_at = f"{date_value}T23:59:00" if date_value else None
    completed = bool(row["completed"])
    completed_at = row["updated_at"] if completed else None
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "category": row["category"],
        "priority": row["priority"],
        "completed": completed,
        "date": date_value,
        "due_at": due_at,
        "dueAt": due_at,
        "completed_at": completed_at,
        "completedAt": completed_at,
        "time_spent": row["time_spent"],
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

    return {
        "id": row["id"],
        "name": row["name"],
        "type": row["type"],
        "duration": row["duration"],
        "calories_burned": row["calories_burned"],
        "exercises": exercises,
        "notes": row["notes"],
        "intensity": row["intensity"],
        "date": row["date"],
        "time": row["time"],
        "created_at": row["created_at"],
    }
