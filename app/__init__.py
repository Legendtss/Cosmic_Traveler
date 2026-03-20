"""
FILE: app/__init__.py

Responsibility:
  Flask application factory. Creates and configures the app,
  registers all blueprints, sets up CORS, DB, and data init.

MUST NOT:
  - Contain route logic (delegates to api/ route modules)
  - Import from script.js or static files

Depends on:
  - All api/*_routes.py modules (blueprint registration)
  - config.py (Config class)
  - db.py (init_app_data, register_db)
"""

import logging
import os
from urllib.parse import urlparse

from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from .api.dashboard_routes import dashboard_bp, web_bp
from .api.tasks_routes import tasks_bp
from .api.nutrition_routes import nutrition_bp
from .api.workouts_routes import workouts_bp
from .api.streaks_routes import streaks_bp
from .api.ai_routes import ai_bp
from .api.focus_routes import focus_bp
from .api.notes_routes import notes_bp
from .api.projects_routes import projects_bp
from .api.goals_routes import goals_bp
from .api.auth_routes import auth_bp
from .config import Config, is_production_env, validate_startup_config
from .db import init_app_data, register_db
from .middleware import setup_middleware


def _is_truthy_env(value):
    return str(value or "").strip().lower() in ("1", "true", "yes", "on")


def _normalize_origin(value):
    raw = str(value or "").strip()
    if not raw:
        return ""

    # Render commonly exposes hostname-only values; normalize to HTTPS origin.
    if "://" not in raw:
        raw = f"https://{raw.lstrip('/')}"

    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return ""

    return f"{parsed.scheme}://{parsed.netloc}"


def _validate_ai_key_policy(config_class, *, is_production, logger):
    """Validate AI-related key policy and fail fast in production when unsafe."""
    allow_gemini_fallback = _is_truthy_env(os.environ.get("ALLOW_GEMINI_FALLBACK_IN_PRODUCTION"))

    errors = []

    if not config_class.GEMINI_API_KEY:
        if is_production and not allow_gemini_fallback:
            errors.append(
                "GEMINI_API_KEY is required in production. "
                "Set GEMINI_API_KEY or explicitly set ALLOW_GEMINI_FALLBACK_IN_PRODUCTION=1."
            )
        logger.warning("GEMINI_API_KEY not set — AI chat will use local fallback only.")

    if errors:
        raise RuntimeError("Production configuration invalid:\n- " + "\n- ".join(errors))


def _validate_bootstrap_config(config_class):
    """Validate critical startup configuration before Flask app is instantiated."""
    errors = validate_startup_config(config_class, environ=os.environ)
    if errors:
        raise RuntimeError("Invalid startup configuration:\n- " + "\n- ".join(errors))


def _seed_showcase_users_if_enabled(app, logger):
    """Best-effort startup seeding for showcase accounts.

    Controlled by environment variables:
    - SEED_SHOWCASE_USERS_ON_STARTUP=1 (enable)
    - SEED_SHOWCASE_USERS_FORCE_RESET=1 (rebuild demo users each boot)
    """
    seed_env_value = os.environ.get("SEED_SHOWCASE_USERS_ON_STARTUP")
    if seed_env_value is None:
        # Default ON so demo/QA credentials are always available unless explicitly disabled.
        enabled = True
    else:
        enabled = _is_truthy_env(seed_env_value)

    if not enabled:
        return

    force_reset = _is_truthy_env(os.environ.get("SEED_SHOWCASE_USERS_FORCE_RESET"))
    try:
        with app.app_context():
            from scripts.seed_showcase_users import seed_showcase_users_in_context

            reports = seed_showcase_users_in_context(force_reset=force_reset)
        seeded = [
            f"{email}:{'skipped' if report.get('skipped') else 'seeded'}"
            for email, report in reports
        ]
        logger.info("[Seed] Showcase users processed (%s)", ", ".join(seeded))
    except Exception as exc:
        logger.exception("[Seed] Showcase user seeding failed: %s", exc)


def _get_cors_config():
    """Build CORS configuration based on environment."""
    # Check if running in production (Render, Railway, etc.)
    is_production = is_production_env()
    
    # Allow custom origins via env var (comma-separated)
    custom_origins = os.environ.get("CORS_ORIGINS", "").strip()
    
    if custom_origins:
        origins = []
        for raw_origin in custom_origins.split(","):
            normalized = _normalize_origin(raw_origin)
            if normalized and normalized not in origins:
                origins.append(normalized)
        if not origins:
            origins = False
    elif is_production:
        # In production, default to same-origin only. If an explicit origin is available
        # from platform vars, allow it; otherwise skip CORS middleware entirely.
        origins = []
        for candidate in (
            os.environ.get("APP_ORIGIN"),
            os.environ.get("RENDER_EXTERNAL_URL"),
        ):
            normalized = _normalize_origin(candidate)
            if normalized and normalized not in origins:
                origins.append(normalized)

        if not origins:
            origins = False
    else:
        # Development: allow localhost variants
        origins = [
            "http://localhost:5000",
            "http://127.0.0.1:5000",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    
    return {
        "origins": origins,
        "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 600,  # Cache preflight for 10 minutes
    }


def create_app(config_class=Config):
    is_production = is_production_env()
    _validate_bootstrap_config(config_class)

    app = Flask(
        __name__,
        static_folder=str(config_class.STATIC_DIR),
        static_url_path="",
    )
    app.config.from_object(config_class)

    # Zero cache in dev for instant reload; 1 hour in production
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 3600 if is_production else 0

    _log = logging.getLogger(__name__)
    _validate_ai_key_policy(config_class, is_production=is_production, logger=_log)

    # Restricted CORS configuration
    cors_config = _get_cors_config()
    if cors_config["origins"] is not False:
        CORS(app, **cors_config)
    # If origins is False, skip CORS entirely (same-origin only)

    @app.errorhandler(HTTPException)
    def _handle_http_exception_json(err):
        if request.path.startswith("/api/"):
            return jsonify({
                "ok": False,
                "error": err.description or err.name,
                "status": err.code,
            }), err.code
        return err

    register_db(app)
    init_app_data(app)
    _seed_showcase_users_if_enabled(app, _log)
    setup_middleware(app)

    app.register_blueprint(web_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(nutrition_bp)
    app.register_blueprint(workouts_bp)
    app.register_blueprint(streaks_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(focus_bp)
    app.register_blueprint(notes_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(goals_bp)

    return app


# WSGI convenience: supports "from app import app".
app = create_app()
