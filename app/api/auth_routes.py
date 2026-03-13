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

import ipaddress
import re
import time

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

# ── Brute-force protection ────────────────────────────────────
_MAX_ATTEMPTS = 5
_LOCKOUT_SECONDS = 300  # 5 minutes
_ATTEMPT_WINDOW = 900   # 15 minutes


def _get_client_ip():
    """Return the most-likely real client IP for rate-limiting.

    Strategy (works for Render / Railway / Cloudflare single-proxy setups
    AND multi-hop CDN chains):

    1. Only consult X-Forwarded-For when the *direct* connection comes from
       a private / loopback address (i.e. a local reverse proxy).  This
       prevents an external attacker from injecting a fake header.
    2. Walk XFF entries left-to-right (client → proxies).  Return the first
       *public* IP — that is the address the outermost trusted proxy saw.
       If every entry is private (unusual), fall back to the leftmost entry.
    3. If there is no proxy, just use request.remote_addr.
    """
    remote = request.remote_addr or "unknown"

    # Only trust XFF when direct connection comes from a local proxy
    try:
        ip = ipaddress.ip_address(remote)
        is_proxy = ip.is_private or ip.is_loopback
    except ValueError:
        is_proxy = False

    if is_proxy:
        xff = request.headers.get("X-Forwarded-For", "")
        if xff:
            parts = [p.strip() for p in xff.split(",") if p.strip()]
            # First globally-routable IP (leftmost) = real client
            for part in parts:
                try:
                    if ipaddress.ip_address(part).is_global:
                        return part
                except ValueError:
                    continue
            # All entries private — use leftmost as best guess
            if parts:
                return parts[0]

    return remote


def _check_rate_limit(identifier: str) -> tuple[bool, int]:
    """Check if identifier is rate-limited. Returns (is_blocked, seconds_remaining)."""
    now = time.time()
    db = get_db()
    row = db.execute(
        "SELECT count, first_attempt, locked_until FROM login_attempts WHERE identifier = ?",
        (identifier,),
    ).fetchone()
    if not row:
        return False, 0

    locked_until = float(row["locked_until"] or 0)
    if locked_until > now:
        return True, int(locked_until - now)

    first_attempt = float(row["first_attempt"] or 0)
    if first_attempt and (now - first_attempt > _ATTEMPT_WINDOW):
        db.execute("DELETE FROM login_attempts WHERE identifier = ?", (identifier,))
        db.commit()
    return False, 0


def _record_failed_attempt(identifier: str):
    """Record a failed login attempt."""
    now = time.time()
    db = get_db()
    row = db.execute(
        "SELECT count, first_attempt FROM login_attempts WHERE identifier = ?",
        (identifier,),
    ).fetchone()

    if not row:
        db.execute(
            "INSERT INTO login_attempts (identifier, count, first_attempt, locked_until) VALUES (?, ?, ?, ?)",
            (identifier, 1, now, 0),
        )
        db.commit()
        return

    first_attempt = float(row["first_attempt"] or now)
    count = int(row["count"] or 0)
    if now - first_attempt > _ATTEMPT_WINDOW:
        first_attempt = now
        count = 0
    count += 1
    locked_until = 0

    if count >= _MAX_ATTEMPTS:
        locked_until = now + _LOCKOUT_SECONDS
        count = 0
        first_attempt = now

    db.execute(
        """
        UPDATE login_attempts
        SET count = ?, first_attempt = ?, locked_until = ?
        WHERE identifier = ?
        """,
        (count, first_attempt, locked_until, identifier),
    )
    db.commit()


def _clear_attempts(identifier: str):
    """Clear attempts after successful login."""
    db = get_db()
    db.execute("DELETE FROM login_attempts WHERE identifier = ?", (identifier,))
    db.commit()


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

    # Check uniqueness — also handle "orphan" records: emails that were committed
    # during a broken deploy where the session was never created (password_hash='').
    existing = db.execute("SELECT id, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        if existing["password_hash"]:
            return jsonify({"ok": False, "errors": ["Email already registered."]}), 409
        # Orphan record: email committed but signup never completed — reclaim it
        db.execute("DELETE FROM users WHERE email = ?", (email,))
        db.commit()

    # Insert user
    now = now_iso()
    cur = db.execute(
        """
        INSERT INTO users (email, password_hash, display_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (email, hash_password(password), display_name, now, now),
    )
    user_id = cur.lastrowid
    if user_id is None:
        db.rollback()
        return jsonify({"ok": False, "errors": ["Account creation failed."]}), 500
    db.commit()

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

    # Rate limiting: check both IP and email
    client_ip = _get_client_ip()
    ip_blocked, ip_wait = _check_rate_limit(f"ip:{client_ip}")
    email_blocked, email_wait = _check_rate_limit(f"email:{email}")
    
    if ip_blocked or email_blocked:
        wait_time = max(ip_wait, email_wait)
        return jsonify({
            "ok": False,
            "errors": [f"Too many login attempts. Please wait {wait_time} seconds."]
        }), 429

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user or not verify_password(user["password_hash"], password):
        # Record failed attempt for both IP and email
        _record_failed_attempt(f"ip:{client_ip}")
        _record_failed_attempt(f"email:{email}")
        return jsonify({"ok": False, "errors": ["Invalid email or password."]}), 401

    # Clear attempts on successful login
    _clear_attempts(f"ip:{client_ip}")
    _clear_attempts(f"email:{email}")

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
    """Update display_name, level, goal, weekly_workout_target, calorie_goal.

    Values are validated to prevent inconsistent states.
    """
    uid = get_current_user_id()
    data = request.get_json(silent=True) or {}
    db = get_db()

    # ── Validation ─────────────────────────────────────────
    errors = []

    display_name = data.get("displayName")
    if display_name is not None:
        display_name = str(display_name).strip()
        if not display_name or len(display_name) > 100:
            errors.append("Display name must be 1-100 characters.")

    level = data.get("level")
    valid_levels = ["Beginner", "Intermediate", "Advanced"]
    if level is not None and level not in valid_levels:
        errors.append(f"Level must be one of: {', '.join(valid_levels)}.")

    goal = data.get("goal")
    valid_goals = ["Weight Loss", "Muscle Gain", "Maintain Fitness", "General Fitness"]
    if goal is not None and goal not in valid_goals:
        errors.append(f"Goal must be one of: {', '.join(valid_goals)}.")

    weekly_workout_target = data.get("weeklyWorkoutTarget")
    if weekly_workout_target is not None:
        try:
            weekly_workout_target = int(weekly_workout_target)
            if weekly_workout_target < 1 or weekly_workout_target > 14:
                raise ValueError
        except (TypeError, ValueError):
            errors.append("Weekly workout target must be an integer between 1 and 14.")

    calorie_goal = data.get("calorieGoal")
    if calorie_goal is not None:
        try:
            calorie_goal = int(calorie_goal)
            if calorie_goal < 500 or calorie_goal > 10000:
                raise ValueError
        except (TypeError, ValueError):
            errors.append("Calorie goal must be an integer between 500 and 10,000.")

    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    # ── Build update ───────────────────────────────────────
    allowed = {
        "display_name": display_name,
        "level": level,
        "goal": goal,
        "weekly_workout_target": weekly_workout_target,
        "calorie_goal": calorie_goal,
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


@auth_bp.route("/api/auth/onboarding", methods=["PUT"])
def update_onboarding():
    """Update onboarding state flags (intro_seen, demo_completed)."""
    uid = get_current_user_id()
    data = request.get_json(silent=True) or {}
    db = get_db()
    now = now_iso()

    sets = ["updated_at = ?"]
    vals = [now]

    # Mark intro as seen
    if data.get("introSeen"):
        sets.append("intro_seen_at = ?")
        vals.append(now)

    # Mark demo as completed (or skipped)
    if data.get("demoCompleted"):
        sets.append("demo_completed_at = ?")
        vals.append(now)

    vals.append(uid)
    db.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = ?", vals)
    db.commit()

    return jsonify({"ok": True, "user": _user_dict(db, uid)})


@auth_bp.route("/api/auth/profile-essentials", methods=["PUT"])
def update_profile_essentials():
    """
    Save the mandatory profile essentials (age, height, weight, goal, activity level).
    This completes the onboarding flow.
    """
    uid = get_current_user_id()
    data = request.get_json(silent=True) or {}
    db = get_db()

    # ── Validation ─────────────────────────────────────────
    errors = []
    
    age = data.get("age")
    if age is None or not isinstance(age, (int, float)) or age < 10 or age > 120:
        errors.append("Age must be between 10 and 120.")
    
    height = data.get("height")
    if height is None or not isinstance(height, (int, float)) or height < 50 or height > 300:
        errors.append("Height must be between 50 and 300 cm.")
    
    current_weight = data.get("currentWeight")
    if current_weight is None or not isinstance(current_weight, (int, float)) or current_weight < 20 or current_weight > 500:
        errors.append("Weight must be between 20 and 500 kg.")
    
    goal = data.get("goal")
    valid_goals = ["Weight Loss", "Muscle Gain", "Maintain Fitness", "General Fitness"]
    if not goal or goal not in valid_goals:
        errors.append(f"Goal must be one of: {', '.join(valid_goals)}.")
    
    activity_level = data.get("activityLevel")
    valid_activity = ["sedentary", "light", "moderate", "active", "very_active"]
    if not activity_level or activity_level not in valid_activity:
        errors.append(f"Activity level must be one of: {', '.join(valid_activity)}.")
    
    if errors:
        return jsonify({"ok": False, "errors": errors}), 400

    # ── Update user with essentials ────────────────────────
    now = now_iso()
    db.execute(
        """
        UPDATE users SET
            age = ?,
            height = ?,
            current_weight = ?,
            goal = ?,
            activity_level = ?,
            profile_essentials_completed_at = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (int(age), int(height), float(current_weight), goal, activity_level, now, now, uid),  # type: ignore[arg-type]  # validated above
    )
    db.commit()

    return jsonify({"ok": True, "user": _user_dict(db, uid)})


# ── Internal helpers ──────────────────────────────────────────

def _user_dict(db, user_id):
    """Build a JSON-safe user dict from the DB row."""
    row = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        return None
    cols = row.keys()
    return {
        "id": row["id"],
        "email": row["email"],
        "displayName": row["display_name"],
        "level": row["level"] if "level" in cols else "Beginner",
        "goal": row["goal"] if "goal" in cols else "General Fitness",
        "weeklyWorkoutTarget": row["weekly_workout_target"] if "weekly_workout_target" in cols else 3,
        "calorieGoal": row["calorie_goal"] if "calorie_goal" in cols else 2200,
        "createdAt": row["created_at"],
        # Profile essentials
        "age": row["age"] if "age" in cols else None,
        "height": row["height"] if "height" in cols else None,
        "currentWeight": row["current_weight"] if "current_weight" in cols else None,
        "activityLevel": row["activity_level"] if "activity_level" in cols else "moderate",
        # Onboarding state
        "onboarding": {
            "introSeenAt": row["intro_seen_at"] if "intro_seen_at" in cols else None,
            "demoCompletedAt": row["demo_completed_at"] if "demo_completed_at" in cols else None,
            "profileEssentialsCompletedAt": row["profile_essentials_completed_at"] if "profile_essentials_completed_at" in cols else None,
        },
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
        samesite="Lax",  # Allow cookies in same-site navigation
        secure=bool(is_production),
        path="/",
        domain=None,  # Explicit: use default domain (current host)
    )
