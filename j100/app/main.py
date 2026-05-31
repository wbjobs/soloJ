from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import router as api_router
from app.config import settings
from app.registry.client import RegistryClient
from app.scanner.cosign_client import CosignSigner
from app.scanner.policy import SecurityPolicy
from app.scanner.queue import ScanQueue
from app.scanner.trivy import TrivyScanner
from app.store.database import ScanStore
from app.webhook.handler import router as webhook_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


class AppState:
    def __init__(self) -> None:
        self.store: ScanStore = ScanStore()
        self.scanner: TrivyScanner = TrivyScanner()
        self.signer: CosignSigner = CosignSigner()
        self.registry: RegistryClient = RegistryClient()
        self.policy: SecurityPolicy = SecurityPolicy(self.store, self.signer)
        self.scan_queue: ScanQueue = ScanQueue(self.store, self.scanner, self.signer, self.policy)


app_state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await app_state.store.connect()
    await app_state.scan_queue.start(concurrency=2)
    logger.info(
        "DockScan server started — registry=%s, db=%s",
        settings.registry_url,
        settings.database_path,
    )
    yield
    await app_state.scan_queue.stop()
    await app_state.store.close()
    await app_state.registry.close()
    logger.info("DockScan server stopped")


app = FastAPI(
    title="DockScan",
    description="Private Docker Image Security Scanning Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(api_router)
app.include_router(webhook_router)


@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "registry": settings.registry_url}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.server_host,
        port=settings.server_port,
        reload=True,
    )
