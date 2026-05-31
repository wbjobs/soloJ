import logging
import sys
from logging.handlers import RotatingFileHandler


def setup_logging(level="INFO", log_file=None):
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))

    formatter = logging.Formatter(
        "[%(asctime)s] %(levelname)s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    if log_file:
        file_handler = RotatingFileHandler(
            log_file, maxBytes=10 * 1024 * 1024, backupCount=5
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

    return root_logger


class ErrorHandler:
    def __init__(self, app=None):
        self.app = app

    def init_app(self, app):
        self.app = app
        app.register_error_handler(404, self.not_found)
        app.register_error_handler(500, self.internal_error)

    @staticmethod
    def not_found(e):
        return {"error": "Resource not found", "status": 404}, 404

    @staticmethod
    def internal_error(e):
        logging.error(f"Internal error: {e}")
        return {"error": "Internal server error", "status": 500}, 500
