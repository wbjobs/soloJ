from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    grpc_host: str = "0.0.0.0"
    grpc_port: int = 50051

    api_host: str = "0.0.0.0"
    api_port: int = 8000

    influxdb_url: str = "http://localhost:8086"
    influxdb_token: str = "influxdb-token-12345"
    influxdb_org: str = "industrial-iot"
    influxdb_bucket: str = "modbus-data"

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = ".env"

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]


settings = Settings()
