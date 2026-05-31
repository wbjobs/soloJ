import os
from datetime import timedelta


class Config:
    SECRET_KEY: str = os.environ.get("SECRET_KEY", os.urandom(32).hex())
    SQLALCHEMY_DATABASE_URI: str = os.environ.get(
        "DATABASE_URL",
        "sqlite:///" + os.path.join(os.path.dirname(os.path.abspath(__file__)), "fpga_platform.db"),
    )
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False

    JWT_SECRET_KEY: str = os.environ.get("JWT_SECRET_KEY", os.urandom(32).hex())
    JWT_ACCESS_TOKEN_EXPIRES: timedelta = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES: timedelta = timedelta(days=30)
    JWT_TOKEN_LOCATION: list = ["headers", "cookies"]
    JWT_COOKIE_SECURE: bool = os.environ.get("FLASK_ENV", "production") == "production"
    JWT_COOKIE_CSRF_PROTECT: bool = True
    JWT_CSRF_IN_COOKIES: bool = True

    UPLOAD_FOLDER: str = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bitstreams")
    MAX_CONTENT_LENGTH: int = 64 * 1024 * 1024  # 64 MB

    USB_VENDOR_IDS: dict = {
        "xilinx": 0x0403,
        "altera": 0x09FB,
        "lattice": 0x1204,
        "gowin": 0x20A0,
    }

    LOGGING_LEVEL: str = os.environ.get("LOGGING_LEVEL", "INFO")
