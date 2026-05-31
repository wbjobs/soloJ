from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.routes import router
from app.db.postgres_client import init_db
from app.db.influx_client import influx_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    influx_manager.close()


app = FastAPI(
    title="Vibration Signal Analysis & Diagnosis System",
    description="Industrial equipment vibration signal analysis and fault diagnosis API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1", tags=["vibration"])
