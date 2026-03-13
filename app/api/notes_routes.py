"""
FILE: app/api/notes_routes.py

Responsibility:
  Notes CRUD: GET/POST /api/notes, GET/PUT/DELETE /api/notes/<id>,
  GET /api/notes/from-task/<taskId>. Supports filter/search.

MUST NOT:
  - Modify task data directly (tasks_routes owns that)
  - Access AI or points modules

Depends on:
  - repositories.notes_repo.NoteRepository
  - helpers.default_user_id(), helpers.normalize_tags
"""


import json

from flask import Blueprint, jsonify, request

from ..db import get_db
from ..repositories.notes_repo import NoteRepository
from .helpers import default_user_id, normalize_tags

notes_bp = Blueprint("notes", __name__)


@notes_bp.route("/api/notes", methods=["GET"])
def get_notes():
    uid = default_user_id()
    source_type = request.args.get("source_type")
    search = request.args.get("search", "").strip()
    tag = request.args.get("tag", "").strip().lower()

    notes = NoteRepository.get_all(
        uid,
        source_type=source_type if source_type in ("manual", "task") else None,
        search=search or None,
        tag=tag or None,
    )
    return jsonify(notes)


@notes_bp.route("/api/notes", methods=["POST"])
def create_note():
    data = request.get_json(silent=True) or {}
    uid = default_user_id()

    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    content = (data.get("content") or "").strip()
    source_type = data.get("source_type", "manual")
    if source_type not in ("manual", "task"):
        source_type = "manual"
    source_id = data.get("source_id")
    if source_type == "manual":
        source_id = None
    else:
        # Require valid ownership when linking note -> task.
        try:
            source_id = int(source_id)
        except (TypeError, ValueError):
            return jsonify({"error": "Valid source_id is required for task-linked notes"}), 400
        db = get_db()
        linked_task = db.execute(
            "SELECT id FROM tasks WHERE id = ? AND user_id = ?",
            (source_id, uid),
        ).fetchone()
        if not linked_task:
            return jsonify({"error": "Linked task not found"}), 400
    tags = normalize_tags(data.get("tags"))

    try:
        row = NoteRepository.create(
            uid,
            title=title,
            content=content,
            source_type=source_type,
            source_id=source_id,
            tags=tags,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    created = NoteRepository.get_by_id(row["id"], uid)
    if not created:
        return jsonify({"error": "Failed to load created note"}), 500
    return jsonify(created), 201


@notes_bp.route("/api/notes/<int:note_id>", methods=["GET"])
def get_note(note_id):
    note = NoteRepository.get_by_id(note_id, default_user_id())
    if not note:
        return jsonify({"error": "Note not found"}), 404
    return jsonify(note)


@notes_bp.route("/api/notes/<int:note_id>", methods=["PUT"])
def update_note(note_id):
    uid = default_user_id()
    existing = NoteRepository.get_by_id(note_id, uid)
    if not existing:
        return jsonify({"error": "Note not found"}), 404

    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip() or existing["title"]
    content = data.get("content", existing["content"])
    tags = normalize_tags(data.get("tags")) if "tags" in data else existing["tags"]

    updated_row = NoteRepository.update(
        note_id, uid, title=title, content=content, tags=tags
    )
    updated = NoteRepository.get_by_id(updated_row["id"], uid)
    if not updated:
        return jsonify({"error": "Failed to load updated note"}), 500
    return jsonify(updated)


@notes_bp.route("/api/notes/<int:note_id>", methods=["DELETE"])
def delete_note(note_id):
    deleted = NoteRepository.delete(note_id, default_user_id())
    if not deleted:
        return jsonify({"error": "Note not found"}), 404
    return jsonify({"status": "deleted"})


@notes_bp.route("/api/notes/from-task/<int:task_id>", methods=["GET"])
def get_note_for_task(task_id):
    """Return the note linked to a specific task, if any."""
    note = NoteRepository.get_by_task(task_id, default_user_id())
    if not note:
        return jsonify(None)
    return jsonify(note)
