"""
FILE: app/api/focus_routes.py

Responsibility:
  Focus/Study session CRUD: GET/POST/PUT /api/focus/sessions,
  DELETE /api/focus/sessions/<id>, GET /api/focus/summary.

MUST NOT:
  - Handle tasks, nutrition, or workout logic
  - Access AI or points modules
  - Contain raw SQL (use FocusRepository)

Depends on:
  - FocusRepository (data access layer)
  - utils.today_str()
  - helpers.default_user_id()
"""


from flask import Blueprint, jsonify, request

from ..repositories.focus_repo import FocusRepository
from ..utils import today_str
from .helpers import default_user_id

focus_bp = Blueprint("focus", __name__)


@focus_bp.route("/api/focus/sessions", methods=["GET"])
def get_focus_sessions():
    user_id = default_user_id()
    date_filter = request.args.get("date", today_str())
    rows = FocusRepository.get_all(user_id, date_filter=date_filter)
    sessions = []
    for r in rows:
        sessions.append({
            "id": r["id"],
            "mode": r["mode"],
            "durationPlanned": r["duration_planned"],
            "durationActual": r["duration_actual"],
            "completed": bool(r["completed"]),
            "label": r["label"],
            "date": r["date"],
            "startedAt": r["started_at"],
            "endedAt": r["ended_at"],
            "taskId": dict(r).get("task_id"),
            "projectId": dict(r).get("project_id"),
            "taskTitle": dict(r).get("task_title"),
            "projectName": dict(r).get("project_name"),
        })
    return jsonify(sessions)


@focus_bp.route("/api/focus/sessions", methods=["POST"])
def create_focus_session():
    user_id = default_user_id()
    data = request.get_json(silent=True) or {}
    mode = data.get("mode", "pomodoro")
    if mode not in ("pomodoro", "custom", "stopwatch"):
        mode = "pomodoro"

    row = FocusRepository.create(
        user_id,
        mode=mode,
        duration_planned=data.get("durationPlanned", 0),
        duration_actual=data.get("durationActual", 0),
        completed=bool(data.get("completed")),
        label=data.get("label", ""),
        date=data.get("date"),
        started_at=data.get("startedAt"),
        ended_at=data.get("endedAt") if data.get("completed") else None,
        task_id=data.get("taskId"),
        project_id=data.get("projectId"),
    )
    return jsonify({"id": row["id"], "status": "created"}), 201


@focus_bp.route("/api/focus/sessions/<int:session_id>", methods=["DELETE"])
def delete_focus_session(session_id):
    user_id = default_user_id()
    FocusRepository.delete(session_id, user_id)
    return jsonify({"status": "deleted"})


@focus_bp.route("/api/focus/sessions/<int:session_id>", methods=["PUT"])
def update_focus_session(session_id):
    user_id = default_user_id()
    existing = FocusRepository.get_by_id(session_id, user_id)
    if not existing:
        return jsonify({"error": "Session not found"}), 404

    data = request.get_json(silent=True) or {}
    mode = data.get("mode", existing["mode"])
    if mode not in ("pomodoro", "custom", "stopwatch"):
        mode = existing["mode"]

    update_kwargs = {
        "mode": mode,
        "duration_planned": data.get("durationPlanned", existing["duration_planned"]),
        "duration_actual": data.get("durationActual", existing["duration_actual"]),
        "completed": bool(data.get("completed", existing["completed"])),
        "label": data.get("label", existing["label"]),
        "date": data.get("date", existing["date"]),
        "started_at": data.get("startedAt", existing["started_at"]),
        "ended_at": data.get("endedAt", existing["ended_at"]),
    }
    if "taskId" in data:
        update_kwargs["task_id"] = data.get("taskId")
    if "projectId" in data:
        update_kwargs["project_id"] = data.get("projectId")

    row = FocusRepository.update(session_id, user_id, **update_kwargs)
    if not row:
        return jsonify({"error": "Session not found"}), 404
    return jsonify({"status": "updated", "id": row["id"]}), 200


@focus_bp.route("/api/focus/summary", methods=["GET"])
def focus_summary():
    user_id = default_user_id()
    date_filter = request.args.get("date", today_str())
    summary = FocusRepository.get_summary(user_id, date=date_filter)
    return jsonify({
        "totalSessions": summary["total_sessions"],
        "completedSessions": summary["completed_sessions"],
        "totalMinutes": summary["total_minutes"],
    })
