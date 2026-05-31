from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    registry_url: str = "http://localhost:5000"
    registry_username: str = ""
    registry_password: str = ""
    trivy_binary: str = "trivy"
    database_url: str = "sqlite+aiosqlite:///./scan.db"
    database_path: str = "./scan.db"
    webhook_secret: str = ""
    server_host: str = "0.0.0.0"
    server_port: int = 8080
    scan_timeout_seconds: int = 1800
    max_scan_output_size_mb: int = 500
    scan_concurrency: int = 2
    scan_batch_size: int = 500
    queue_max_size: int = 100
    max_task_history: int = 500
    auto_sign_enabled: bool = True
    max_allowed_severity: str = "HIGH"
    cosign_binary: str = "cosign"
    cosign_key_path: str = ""
    cosign_password: str = ""
    cosign_fulcio_url: str = ""
    cosign_rekor_url: str = ""

    model_config = {"env_prefix": "DOCKSCAN_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
