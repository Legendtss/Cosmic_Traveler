"""
FILE: app/middleware.py

Responsibility:
  Request/response middleware for validation, rate limiting, security, and auth context.

MUST NOT:
  - Contain business logic or route handlers
  - Import api/ modules

Depends on:
  - flask (request, jsonify, g)
  - functools (wraps)
  - auth (optional session validation)
"""

import functools
import time

from flask import g, jsonify, request


class RateLimiter:
    """Simple in-memory rate limiter (per IP, non-persistent)."""
    
    def __init__(self, max_requests=100, window_seconds=60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict = {}
    
    def is_allowed(self, client_id):
        """Check if request is allowed for client. Returns True if within limit."""
        now = time.time()
        # Prune timestamps outside the window
        calls = [t for t in self.requests.get(client_id, []) if now - t < self.window_seconds]
        if len(calls) < self.max_requests:
            calls.append(now)
            self.requests[client_id] = calls
            return True
        # Keep pruned list (may be empty if all expired but we're still over limit)
        if calls:
            self.requests[client_id] = calls
        elif client_id in self.requests:
            del self.requests[client_id]
        return False


def rate_limit(max_requests=100, window_seconds=60):
    """Decorator to rate limit a route by client IP.

    Each decorated endpoint gets its own RateLimiter instance so that the
    configured max_requests/window_seconds values are actually respected.
    """
    limiter = RateLimiter(max_requests=max_requests, window_seconds=window_seconds)

    def decorator(f):
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            client_ip = request.remote_addr or "unknown"
            if not limiter.is_allowed(client_ip):
                return jsonify({"error": "Rate limit exceeded. Try again later."}), 429
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def validate_json(*required_fields):
    """Decorator to validate required JSON fields in request.
    
    Usage:
        @validate_json('title', 'priority')
        def create_task():
            ...
    """
    def decorator(f):
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            data = request.get_json(silent=True)
            if data is None:
                return jsonify({"error": "Request body must be JSON"}), 400
            
            missing = [field for field in required_fields if field not in data]
            if missing:
                return jsonify({
                    "error": f"Missing required fields: {', '.join(missing)}"
                }), 400
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def validate_json_optional(*allowed_fields):
    """Decorator to validate optional JSON fields and reject unknown fields.
    
    Usage:
        @validate_json_optional('title', 'priority', 'label')
        def update_task():
            ...
    """
    def decorator(f):
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            data = request.get_json(silent=True) or {}
            unknown = [k for k in data.keys() if k not in allowed_fields]
            
            if unknown:
                return jsonify({
                    "error": f"Unknown fields: {', '.join(unknown)}"
                }), 400
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def inject_client_info():
    """Inject client info (IP, user-agent) into request context."""
    g.client_ip = request.remote_addr or "unknown"
    g.user_agent = request.headers.get("User-Agent", "unknown")
    g.user_id = None  # Will be set by auth middleware if logged in


def inject_user_context():
    """Middleware to inject user_id into request context (optional auth)."""
    inject_client_info()
    
    # Optional: attempt to get user_id from auth if session exists
    # This won't fail if no session — just leaves g.user_id as None
    try:
        from .auth import validate_session, SESSION_COOKIE_NAME
        from .db import get_db
        
        token = request.cookies.get(SESSION_COOKIE_NAME)
        if token:
            session_row = validate_session(token)
            if session_row:
                g.user_id = session_row["user_id"]
    except Exception:
        # If auth check fails, continue without user_id
        pass


def setup_middleware(app):
    """Register all middleware with Flask app."""
    
    @app.before_request
    def before_request():
        """Run before each request."""
        inject_user_context()
    
    @app.after_request
    def after_request(response):
        """Add security headers to all responses."""
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        # CSP can be strict if needed
        # response.headers['Content-Security-Policy'] = "default-src 'self'"
        return response

