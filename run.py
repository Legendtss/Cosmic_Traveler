"""
FILE: run.py

Responsibility:
  Entry point for the Flask development server.
  Imports the app instance from app/__init__.py and runs it.

MUST NOT:
  - Contain application logic or routes
  - Be used in production (use a WSGI server instead)

Depends on:
  - app (the Flask app instance from app/__init__.py)
"""

import os

from app import app


if __name__ == "__main__":
    debug_mode = os.environ.get("FLASK_DEBUG", "").strip().lower() in ("1", "true", "yes", "on")
    app.run(debug=debug_mode, host="0.0.0.0", port=5000)
