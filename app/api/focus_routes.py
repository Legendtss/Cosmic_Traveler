"""
FILE: app/api/focus_routes.py

Responsibility:
  Focus/Study session CRUD: GET/POST /api/focus/sessions,
  DELETE /api/focus/sessions/<id>, GET /api/focus/summary.

MUST NOT:
  - Handle tasks, nutrition, or workout logic
  - Access AI or points modules

Depends on:
  - db.get_db(), utils.*
  - helpers.default_user_id()
"""


from flask import Blueprint, jsonify, request

from ..db import get_db
from ..utils import now_iso, safe_int, today_str
from .helpers import default_user_id

focus_bp = Blueprint("focus", __name__)


@focus_bp.route("/api/focus/sessions", methods=["GET"])
def get_focus_sessions():
    db = get_db()
    date_filter = request.args.get("date", today_str())
    rows = db.execute(
        "SELECT * FROM focus_sessions WHERE user_id = ? AND date = ? ORDER BY id DESC",
        (default_user_id(), date_filter),
    ).fetchall()
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
        })
    return jsonify(sessions)


@focus_bp.route("/api/focus/sessions", methods=["POST"])
def create_focus_session():
    db = get_db()
    data = request.get_json(force=True) if request.is_json else {}
    mode = data.get("mode", "pomodoro")
    if mode not in ("pomodoro", "custom", "stopwatch"):
        mode = "pomodoro"
    duration_planned = max(0, safe_int(data.get("durationPlanned"), 0))
    duration_actual = max(0, safe_int(data.get("durationActual"), 0))
    completed = 1 if data.get("completed") else 0
    label = (data.get("label") or "").strip()
    date = data.get("date", today_str())
    now = now_iso()

    cursor = db.execute(
        """INSERT INTO focus_sessions
           (user_id, mode, duration_planned, duration_actual, completed, label, date, started_at, ended_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (default_user_id(), mode, duration_planned, duration_actual, completed, label, date,
         data.get("startedAt", now), data.get("endedAt", now) if completed else None, now),
    )
    db.commit()
    return jsonify({"id": cursor.lastrowid, "status": "created"}), 201


@focus_bp.route("/api/focus/sessions/<int:session_id>", methods=["DELETE"])
def delete_focus_session(session_id):
    db = get_db()
    db.execute("DELETE FROM focus_sessions WHERE id = ? AND user_id = ?", (session_id, default_user_id()))
    db.commit()
    return jsonify({"status": "deleted"})


@focus_bp.route("/api/focus/summary", methods=["GET"])
def focus_summary():
    db = get_db()
    date_filter = request.args.get("date", today_str())
    row = db.execute(
        """SELECT COUNT(*) as total_sessions,
                  SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) as completed_sessions,
                  SUM(duration_actual) as total_minutes
           FROM focus_sessions WHERE user_id = ? AND date = ?""",
        (default_user_id(), date_filter),
    ).fetchone()
    return jsonify({
        "totalSessions": row["total_sessions"] or 0,
        "completedSessions": row["completed_sessions"] or 0,
        "totalMinutes": row["total_minutes"] or 0,
    })
