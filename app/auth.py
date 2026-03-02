"""
FILE: app/auth.py

Responsibility:
  Core authentication helpers: password hashing, session cookie
  management, and the get_current_user_id() function that replaces
  the old hardcoded default_user_id().

MUST NOT:
  - Contain route logic (delegates to api/auth_routes.py)
  - Import from AI or feature modules

Depends on:
  - werkzeug.security (ships with Flask)
  - db.get_db()
  - utils.now_iso()
"""

import uuid
from datetime import datetime, timedelta
from functools import wraps

from flask import abort, g, request
from werkzeug.security import check_password_hash, generate_password_hash

from .db import get_db
from .utils import now_iso

# ── Session config ────────────────────────────────────────────
SESSION_COOKIE_NAME = "ft_session"
SESSION_LIFETIME_DAYS = 30


# ── Password helpers ──────────────────────────────────────────

def hash_password(plain: str) -> str:
    """Hash a plaintext password using werkzeug/scrypt."""
    return generate_password_hash(plain)


def verify_password(stored_hash: str, plain: str) -> bool:
    """Check a plaintext password against a stored hash."""
    if not stored_hash:
        return False
    return check_password_hash(stored_hash, plain)


# ── Session helpers ───────────────────────────────────────────

def create_session(user_id: int) -> str:
    """Insert a new session row and return the session token."""
    db = get_db()
    token = uuid.uuid4().hex
    expires = (datetime.utcnow() + timedelta(days=SESSION_LIFETIME_DAYS)).isoformat()
    db.execute(
        "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (token, user_id, now_iso(), expires),
    )
    db.commit()
    return token


def delete_session(token: str) -> None:
    """Remove a session row (logout)."""
    db = get_db()
    db.execute("DELETE FROM sessions WHERE id = ?", (token,))
    db.commit()


def validate_session(token: str):
    """Return the session row if valid and not expired, else None."""
    if not token:
        return None
    db = get_db()
    row = db.execute(
        "SELECT * FROM sessions WHERE id = ?", (token,)
    ).fetchone()
    if not row:
        return None
    if row["expires_at"] < datetime.utcnow().isoformat():
        # Expired — clean up
        db.execute("DELETE FROM sessions WHERE id = ?", (token,))
        db.commit()
        return None
    return row


# ── Request-scoped user resolution ────────────────────────────

def get_current_user_id():
    """
    Read the session cookie, validate it, and return user_id.
    Aborts with 401 if no valid session is found.
    Caches result in flask.g for the duration of the request.
    """
    if "current_user_id" in g:
        return g.current_user_id

    token = request.cookies.get(SESSION_COOKIE_NAME)
    session_row = validate_session(token)
    if not session_row:
        abort(401, description="Authentication required")

    g.current_user_id = session_row["user_id"]
    return g.current_user_id


def login_required(fn):
    """Decorator that ensures a valid session before calling the view."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        get_current_user_id()  # will abort(401) if invalid
        return fn(*args, **kwargs)
    return wrapper
