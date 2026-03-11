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
from collections import defaultdict

from flask import g, jsonify, request


class RateLimiter:
    """Simple in-memory rate limiter (per IP, non-persistent)."""
    
    def __init__(self, max_requests=100, window_seconds=60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(list)
    
    def is_allowed(self, client_id):
        """Check if request is allowed for client. Returns True if within limit."""
        now = time.time()
        # Clean old requests outside window
        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id]
            if now - req_time < self.window_seconds
        ]
        
        if len(self.requests[client_id]) < self.max_requests:
            self.requests[client_id].append(now)
            return True
        return False


# Global rate limiter instance
_rate_limiter = RateLimiter(max_requests=100, window_seconds=60)


def rate_limit(max_requests=100, window_seconds=60):
    """Decorator to rate limit a route by client IP."""
    def decorator(f):
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            client_ip = request.remote_addr or "unknown"
            
            if not _rate_limiter.is_allowed(client_ip):
                return jsonify({"error": "Rate limit exceeded. Max 100 requests per minute."}), 429
            
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

