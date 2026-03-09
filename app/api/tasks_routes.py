"""
FILE: app/api/tasks_routes.py

Responsibility:
  Full CRUD for tasks: GET/POST /api/tasks,
  PUT/DELETE /api/tasks/<id>, PATCH /api/tasks/<id>/toggle.
  Also syncs note_content/note_saved_to_notes on create/update.

MUST NOT:
  - Import from AI or points modules directly
  - Handle nutrition, workout, or streak logic

Depends on:
  - db.get_db(), mappers.map_task, utils.*
  - helpers.default_user_id(), helpers.normalize_tags()
"""


import json

from flask import Blueprint, jsonify, request

from ..mappers import map_task
from ..utils import safe_int, today_str
from ..repositories.task_repo import TaskRepository, NoteLinker
from .helpers import default_user_id, normalize_tags

tasks_bp = Blueprint("tasks", __name__)


@tasks_bp.route("/api/tasks", methods=["GET"])
def get_tasks():
    date_filter = request.args.get("date")
    rows = TaskRepository.get_all(default_user_id(), date_filter)
    return jsonify([map_task(r) for r in rows])


@tasks_bp.route("/api/tasks", methods=["POST"])
def create_task():
    req_data = request.get_json(silent=True) or {}

    title = (req_data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    priority = req_data.get("priority", "medium")
    if priority not in ("low", "medium", "high"):
        priority = "medium"
    due_date = req_data.get("date") or today_str()

    tags = normalize_tags(req_data.get("tags"))
    note_content = (req_data.get("note_content") or "").strip()
    save_note = bool(req_data.get("save_to_notes"))

    task_id, created_at = TaskRepository.create(
        default_user_id(),
        title=title,
        description=req_data.get("description", ""),
        tags_json=json.dumps(tags),
        category=req_data.get("category", "general"),
        priority=priority,
        date=due_date,
        project_id=req_data.get("project_id"),
        note_content=note_content,
        note_saved_to_notes=save_note,
    )

    # Auto-create linked note if requested
    if save_note and note_content:
        NoteLinker.create_linked_note(
            default_user_id(), task_id, title, note_content,
            json.dumps(tags), created_at,
        )

    row = TaskRepository.get_by_id(task_id)
    return jsonify(map_task(row)), 201


@tasks_bp.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    uid = default_user_id()
    row = TaskRepository.get_by_id(task_id, uid)
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
        tags_json = json.dumps(normalize_tags(req_data.get("tags")))

    # Note fields
    try:
        old_note_content = row["note_content"] or ""
    except (IndexError, KeyError):
        old_note_content = ""
    try:
        old_note_saved = bool(row["note_saved_to_notes"])
    except (IndexError, KeyError):
        old_note_saved = False
    note_content = req_data.get("note_content", old_note_content)
    save_note = req_data.get("save_to_notes", old_note_saved)
    due_date = req_data.get("date", row["date"])

    if priority not in ("low", "medium", "high"):
        priority = row["priority"]

    note_content_val = (note_content or "").strip()
    note_saved_val = bool(save_note and note_content_val)

    TaskRepository.update(
        task_id, uid,
        title=title,
        description=description,
        tags_json=tags_json,
        category=category,
        priority=priority,
        completed=completed,
        date=due_date,
        time_spent=safe_int(time_spent, row["time_spent"]),
        note_content=note_content_val,
        note_saved_to_notes=note_saved_val,
    )

    # Sync linked note: create if newly checked, update if already exists
    if save_note and note_content_val:
        NoteLinker.upsert_linked_note(uid, task_id, title, note_content_val, json.dumps(json.loads(tags_json)))
    else:
        NoteLinker.delete_linked_note(uid, task_id)

    updated = TaskRepository.get_by_id(task_id)
    return jsonify(map_task(updated))


@tasks_bp.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    deleted = TaskRepository.delete(task_id, default_user_id())
    if not deleted:
        return jsonify({"error": "Task not found"}), 404
    return jsonify({"message": "Task deleted successfully"}), 200


@tasks_bp.route("/api/tasks/<int:task_id>/toggle", methods=["PATCH"])
def toggle_task(task_id):
    updated_row = TaskRepository.toggle_completed(task_id, default_user_id())
    if not updated_row:
        return jsonify({"error": "Task not found"}), 404
    return jsonify(map_task(updated_row))
