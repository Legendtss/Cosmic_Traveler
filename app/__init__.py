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
from .api.auth_routes import auth_bp
from .config import Config
from .db import init_app_data, register_db
from .middleware import setup_middleware


def _is_truthy_env(value):
    return str(value or "").strip().lower() in ("1", "true", "yes", "on")


def _validate_ai_key_policy(config_class, *, is_production, logger):
    """Validate AI-related key policy and fail fast in production when unsafe."""
    allow_gemini_fallback = _is_truthy_env(os.environ.get("ALLOW_GEMINI_FALLBACK_IN_PRODUCTION"))
    allow_demo_usda = _is_truthy_env(os.environ.get("ALLOW_DEMO_USDA_IN_PRODUCTION"))

    errors = []

    if not config_class.GEMINI_API_KEY:
        if is_production and not allow_gemini_fallback:
            errors.append(
                "GEMINI_API_KEY is required in production. "
                "Set GEMINI_API_KEY or explicitly set ALLOW_GEMINI_FALLBACK_IN_PRODUCTION=1."
            )
        logger.warning("GEMINI_API_KEY not set — AI chat will use local fallback only.")

    if config_class.USDA_API_KEY == "DEMO_KEY":
        if is_production and not allow_demo_usda:
            errors.append(
                "USDA_API_KEY must not be DEMO_KEY in production. "
                "Set USDA_API_KEY or explicitly set ALLOW_DEMO_USDA_IN_PRODUCTION=1."
            )
        logger.warning("USDA_API_KEY is DEMO_KEY — nutrition search may be rate-limited.")

    if errors:
        raise RuntimeError("Production configuration invalid:\n- " + "\n- ".join(errors))


def _get_cors_config():
    """Build CORS configuration based on environment."""
    # Check if running in production (Render, Railway, etc.)
    is_production = bool(
        os.environ.get("RENDER") or
        os.environ.get("RAILWAY_ENVIRONMENT") or
        os.environ.get("PRODUCTION")
    )
    
    # Allow custom origins via env var (comma-separated)
    custom_origins = os.environ.get("CORS_ORIGINS", "").strip()
    
    if custom_origins:
        origins = [o.strip() for o in custom_origins.split(",") if o.strip()]
    elif is_production:
        # In production: same-origin requests don't need CORS
        # But we need to allow the app origin explicitly for credentials to work
        # Get the origin from request (will be cosmic-traveler.onrender.com)
        # For now, allow any HTTPS origin - credentials only work for actual origin anyway
        origins = ["https://cosmic-traveler.onrender.com"]
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
    app = Flask(
        __name__,
        static_folder=str(config_class.STATIC_DIR),
        static_url_path="",
    )
    app.config.from_object(config_class)

    is_production = bool(
        os.environ.get("RENDER") or
        os.environ.get("RAILWAY_ENVIRONMENT") or
        os.environ.get("PRODUCTION")
    )

    # Zero cache in dev for instant reload; 1 hour in production
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 3600 if is_production else 0

    if is_production and app.config.get("SECRET_KEY") == "dev-secret-change-in-production":
        raise RuntimeError("SECRET_KEY must be set in production.")

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

    return app


# WSGI convenience: supports "from app import app".
app = create_app()
