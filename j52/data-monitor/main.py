import logging
import threading
import time
import uvicorn
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.config import settings
from app.main import app
from app.grpc_server import serve_grpc

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def run_grpc_server():
    grpc_server = serve_grpc()
    if grpc_server:
        try:
            while True:
                time.sleep(86400)
        except KeyboardInterrupt:
            grpc_server.stop(0)
            logger.info("gRPC server stopped")


def run_fastapi():
    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        log_level="info",
    )


def main():
    logger.info("=" * 60)
    logger.info("Starting Modbus Data Monitor Service")
    logger.info("=" * 60)
    logger.info(f"gRPC Server: {settings.grpc_host}:{settings.grpc_port}")
    logger.info(f"REST API:   http://{settings.api_host}:{settings.api_port}")
    logger.info(f"API Docs:   http://{settings.api_host}:{settings.api_port}/docs")
    logger.info(f"InfluxDB:   {settings.influxdb_url}")
    logger.info("=" * 60)

    grpc_thread = threading.Thread(target=run_grpc_server, daemon=True)
    grpc_thread.start()

    logger.info("Waiting for gRPC server to initialize...")
    time.sleep(2)

    try:
        run_fastapi()
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    finally:
        logger.info("Shutting down services...")
        from app.influxdb_service import influxdb_service
        influxdb_service.close()
        logger.info("All services stopped")


if __name__ == "__main__":
    main()
