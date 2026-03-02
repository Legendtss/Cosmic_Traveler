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

import os

from flask import Flask
from flask_cors import CORS

from .api.dashboard_routes import dashboard_bp, web_bp
from .api.tasks_routes import tasks_bp
from .api.nutrition_routes import nutrition_bp
from .api.workouts_routes import workouts_bp
from .api.streaks_routes import streaks_bp
from .api.ai_routes import ai_bp
from .api.focus_routes import focus_bp
from .api.notes_routes import notes_bp
from .api.auth_routes import auth_bp
from .config import Config
from .db import init_app_data, register_db


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
        # In production with no custom config: same-origin only (no CORS needed)
        # CORS headers only apply to cross-origin requests
        origins = []  # Empty = no cross-origin allowed
    else:
        # Development: allow localhost variants
        origins = [
            "http://localhost:5000",
            "http://127.0.0.1:5000",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    
    return {
        "origins": origins if origins else False,  # False = no CORS headers
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
    app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

    # Restricted CORS configuration
    cors_config = _get_cors_config()
    if cors_config["origins"] is not False:
        CORS(app, **cors_config)
    # If origins is False, skip CORS entirely (same-origin only)
    register_db(app)
    init_app_data(app)

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
    return app


# WSGI convenience: supports "from app import app".
app = create_app()
