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

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import abort, g, request
from werkzeug.security import check_password_hash, generate_password_hash

from .db import get_db
from .utils import now_iso

# ── Session config ────────────────────────────────────────────
SESSION_COOKIE_NAME = "ft_session"
SESSION_LIFETIME_HOURS = max(1, int(os.environ.get("SESSION_LIFETIME_HOURS", "8")))
SESSION_LIFETIME_SECONDS = SESSION_LIFETIME_HOURS * 3600
_CLEANUP_INTERVAL_SECONDS = max(60, int(os.environ.get("SESSION_CLEANUP_INTERVAL_SECONDS", "300")))
_last_cleanup_ts = 0.0
_log = logging.getLogger(__name__)


# ── Token hashing (DB stores hash, not plaintext) ─────────────

def _hash_token(token: str) -> str:
    """Hash session token using SHA-256 for secure DB storage."""
    return hashlib.sha256(token.encode()).hexdigest()


def _generate_token() -> str:
    """Generate a cryptographically secure random token."""
    return secrets.token_hex(32)  # 64 chars, 256 bits of entropy


def _cleanup_expired_sessions() -> None:
    """Best-effort periodic cleanup of expired sessions with time-based gating."""
    global _last_cleanup_ts
    now_ts = datetime.now(timezone.utc).timestamp()
    if (now_ts - _last_cleanup_ts) < _CLEANUP_INTERVAL_SECONDS:
        return
    _last_cleanup_ts = now_ts
    db = get_db()
    db.execute(
        "DELETE FROM sessions WHERE expires_at < ?",
        (datetime.now(timezone.utc).isoformat(),),
    )
    db.commit()


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
    """Create a new session and return the plaintext token (for cookie).
    
    The token is hashed before storing in DB. Only the hash is stored,
    so a DB leak doesn't directly expose usable session tokens.
    """
    db = get_db()
    _cleanup_expired_sessions()
    token = _generate_token()  # Plaintext token for client
    token_hash = _hash_token(token)  # Hash for DB storage
    expires = (datetime.now(timezone.utc) + timedelta(seconds=SESSION_LIFETIME_SECONDS)).isoformat()
    db.execute(
        "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
        (token_hash, user_id, now_iso(), expires),
    )
    db.commit()
    return token  # Return plaintext token to be set in cookie


def delete_session(token: str) -> None:
    """Remove a session row (logout). Token is hashed before lookup."""
    if not token:
        return
    db = get_db()
    token_hash = _hash_token(token)
    db.execute("DELETE FROM sessions WHERE id = ?", (token_hash,))
    db.commit()


def revoke_all_sessions(user_id: int) -> int:
    """Revoke all sessions for a user (e.g., password change, security concern).
    
    Returns the number of sessions revoked.
    """
    db = get_db()
    cursor = db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    db.commit()
    return cursor.rowcount


def validate_session(token: str):
    """Return the session row if valid and not expired, else None.
    
    Token is hashed before DB lookup.
    """
    if not token:
        return None
    db = get_db()
    _cleanup_expired_sessions()
    token_hash = _hash_token(token)
    row = db.execute(
        "SELECT * FROM sessions WHERE id = ?", (token_hash,)
    ).fetchone()
    if not row:
        _log.debug("Session not found for token hash prefix=%s", token_hash[:16])
        return None
    expires_at = row["expires_at"]
    now = datetime.now(timezone.utc).isoformat()
    if expires_at < now:
        _log.debug("Session expired for token hash prefix=%s", token_hash[:16])
        # Expired — clean up
        db.execute("DELETE FROM sessions WHERE id = ?", (token_hash,))
        db.commit()
        return None
    _log.debug("Session valid for user_id=%s", row["user_id"])
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
    if not token:
        abort(401, description="Authentication required: no session cookie")
    
    session_row = validate_session(token)
    if not session_row:
        abort(401, description="Authentication required: invalid session")

    g.current_user_id = session_row["user_id"]
    return g.current_user_id


def login_required(fn):
    """Decorator that ensures a valid session before calling the view."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        get_current_user_id()  # will abort(401) if invalid
        return fn(*args, **kwargs)
    return wrapper
