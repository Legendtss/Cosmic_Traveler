from flask import Flask
from flask_cors import CORS

from .api.routes import api_bp, web_bp
from .config import Config
from .db import init_app_data, register_db


def create_app(config_class=Config):
    app = Flask(
        __name__,
        static_folder=str(config_class.STATIC_DIR),
    )
    app.config.from_object(config_class)

    CORS(app)
    register_db(app)
    init_app_data(app)

    app.register_blueprint(web_bp)
    app.register_blueprint(api_bp)
    return app


# WSGI convenience: supports "from app import app".
app = create_app()
