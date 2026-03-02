"""
FILE: app/api/auth_routes.py

Responsibility:
  Authentication API endpoints:
    POST   /api/auth/signup   — register a new user
    POST   /api/auth/login    — authenticate and set session cookie
    POST   /api/auth/logout   — destroy session
    GET    /api/auth/me        — return current user profile
    PUT    /api/auth/profile   — update profile preferences

MUST NOT:
  - Contain business logic beyond auth (no tasks, nutrition, etc.)
  - Access localStorage or frontend state

Depends on:
  - auth.py (hash_password, verify_password, create_session, etc.)
  - db.get_db()
  - utils.now_iso()
"""

import re

from flask import Blueprint, jsonify, make_response, request

from ..auth import (
    SESSION_COOKIE_NAME,
    SESSION_LIFETIME_DAYS,
    create_session,
    delete_session,
    get_current_user_id,
    hash_password,
    verify_password,
)
from ..db import get_db
from ..utils import now_iso

auth_bp = Blueprint("auth", __name__)

# Simple email regex — not exhaustive but catches obvious mistakes
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@auth_bp.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    display_name = (data.get("displayName") or "").strip()

    # ── Validation ─────────────────────────────────────────
    errors = []
    if not email or not _EMAIL_RE.match(email):
        errors.append("Valid email is required.")
    if len(password) < 6:
        errors.append("Password must be at least 6 characters.")
    if not display_name:
        errors.append("Display name is required.")
    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    db = get_db()

    # Check uniqueness
    existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        return jsonify({"ok": False, "errors": ["Email already registered."]}), 409

    # Insert user
    now = now_iso()
    cur = db.execute(
        """
        INSERT INTO users (email, password_hash, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (email, hash_password(password), display_name, now, now),
    )
    db.commit()
    user_id = cur.lastrowid

    # Ensure user_progress row exists
    db.execute(
        """
        INSERT OR IGNORE INTO user_progress (user_id, total_points, current_streak, longest_streak, level, updated_at)
        VALUES (?, 0, 0, 0, 1, ?)
        """,
        (user_id, now),
    )
    db.commit()

    # Create session
    token = create_session(user_id)

    resp = make_response(jsonify({
        "ok": True,
        "user": _user_dict(db, user_id),
    }))
    _set_session_cookie(resp, token)
    return resp, 201


@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"ok": False, "errors": ["Email and password are required."]}), 400

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user or not verify_password(user["password_hash"], password):
        return jsonify({"ok": False, "errors": ["Invalid email or password."]}), 401

    token = create_session(user["id"])

    resp = make_response(jsonify({
        "ok": True,
        "user": _user_dict(db, user["id"]),
    }))
    _set_session_cookie(resp, token)
    return resp


@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if token:
        delete_session(token)
    resp = make_response(jsonify({"ok": True}))
    resp.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return resp


@auth_bp.route("/api/auth/me", methods=["GET"])
def me():
    """Return current user or 401. Used by frontend to check session on load."""
    try:
        uid = get_current_user_id()
    except Exception:
        return jsonify({"ok": False}), 401

    db = get_db()
    return jsonify({"ok": True, "user": _user_dict(db, uid)})


@auth_bp.route("/api/auth/profile", methods=["PUT"])
def update_profile():
    """Update display_name, level, goal, weekly_workout_target, calorie_goal."""
    uid = get_current_user_id()
    data = request.get_json(silent=True) or {}
    db = get_db()

    allowed = {
        "display_name": data.get("displayName"),
        "level": data.get("level"),
        "goal": data.get("goal"),
        "weekly_workout_target": data.get("weeklyWorkoutTarget"),
        "calorie_goal": data.get("calorieGoal"),
    }
    sets = []
    vals = []
    for col, val in allowed.items():
        if val is not None:
            sets.append(f"{col} = ?")
            vals.append(val)
    if sets:
        sets.append("updated_at = ?")
        vals.append(now_iso())
        vals.append(uid)
        db.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = ?", vals)
        db.commit()

    return jsonify({"ok": True, "user": _user_dict(db, uid)})


# ── Internal helpers ──────────────────────────────────────────

def _user_dict(db, user_id):
    """Build a JSON-safe user dict from the DB row."""
    row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "email": row["email"],
        "displayName": row["display_name"],
        "level": row["level"] if "level" in row.keys() else "Beginner",
        "goal": row["goal"] if "goal" in row.keys() else "General Fitness",
        "weeklyWorkoutTarget": row["weekly_workout_target"] if "weekly_workout_target" in row.keys() else 3,
        "calorieGoal": row["calorie_goal"] if "calorie_goal" in row.keys() else 2200,
        "createdAt": row["created_at"],
    }


def _set_session_cookie(resp, token):
    """Set the session cookie on the response with proper attributes."""
    import os
    is_production = os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("RENDER")
    resp.set_cookie(
        SESSION_COOKIE_NAME,
        token,
        max_age=SESSION_LIFETIME_DAYS * 86400,
        httponly=True,
        samesite="Lax",
        secure=bool(is_production),
        path="/",
    )
