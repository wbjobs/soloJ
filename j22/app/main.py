"""Main FastAPI application for Quantum Simulator API."""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as quantum_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app = FastAPI(
    title="Quantum Circuit Simulator API",
    description="RESTful API for quantum circuit simulation with GPU acceleration",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(quantum_router, prefix="/api/v1", tags=["quantum"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Quantum Circuit Simulator API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.on_event("startup")
async def startup_event():
    """Startup event handler."""
    logging.info("Starting Quantum Simulator API...")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event handler."""
    logging.info("Shutting down Quantum Simulator API...")
