import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from config import Config
from models import db, User

jwt = JWTManager()


def create_app(config_class: type = Config) -> Flask:
    app = Flask(__name__)
    app.config.from_object(config_class)

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    db.init_app(app)
    jwt.init_app(app)
    CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})

    from routes.auth import auth_bp
    from routes.bitstream import bitstream_bp
    from routes.debug import debug_bp
    from routes.webusb import webusb_bp
    from routes.cluster import cluster_bp

    app.register_blueprint(auth_bp, url_prefix="/api")
    app.register_blueprint(bitstream_bp, url_prefix="/api")
    app.register_blueprint(debug_bp, url_prefix="/api")
    app.register_blueprint(webusb_bp, url_prefix="/api")
    app.register_blueprint(cluster_bp)

    logging.basicConfig(
        level=getattr(logging, app.config.get("LOGGING_LEVEL", "INFO")),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    with app.app_context():
        db.create_all()
        _create_default_admin()

    @app.route("/api/health")
    def health_check():
        return jsonify({"status": "ok", "service": "fpga-remote-platform"}), 200

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found", "message": str(e)}), 404

    @app.errorhandler(500)
    def internal_error(e):
        db.session.rollback()
        app.logger.error(f"Internal server error: {e}")
        return jsonify({"error": "Internal server error", "message": str(e)}), 500

    return app


def _create_default_admin() -> None:
    if User.query.filter_by(role="admin").first() is None:
        admin = User(
            username="admin",
            role="admin",
            is_active=True,
        )
        admin.set_password("admin")
        db.session.add(admin)
        db.session.commit()
        app = Flask(__name__)
        app.logger.info("Default admin user created: username=admin, password=admin")


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
