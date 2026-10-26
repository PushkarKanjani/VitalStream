"""
VitalStream — FastAPI Main Application
Handles: REST endpoints, WebSocket hub, MongoDB change-stream listener
"""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.db import connect_mongo, disconnect_mongo, get_db
from app.api import cases, beds, orders, alerts, patients, metrics, drugs
from app.websocket_manager import ConnectionManager, change_stream_listener, vitals_stream_worker

logger = logging.getLogger("vitalstream")

# ── WebSocket connection pool ──────────────────────────────────────────────────
manager = ConnectionManager()


# ── Lifespan (replaces @app.on_event) ─────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_mongo()
    logger.info("✓ MongoDB connected")

    # Kick off change-stream background task
    db = get_db()
    asyncio.create_task(change_stream_listener(db, manager))
    logger.info("✓ MongoDB change-stream listener started")

    # Kick off live telemetry worker (Kafka vitals.raw + natural sinus rhythm)
    asyncio.create_task(vitals_stream_worker(manager))
    logger.info("✓ WebSocket vitals telemetry worker started")

    yield

    # Shutdown
    await disconnect_mongo()
    logger.info("MongoDB disconnected")


import os
from app.security import SecurityHeadersMiddleware, RateLimiterMiddleware, secure_exception_handler

# ── App factory ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="VitalStream Clinical API",
    description="Perioperative Surgical Command Center — Real-Time Telemetry & Anomaly Analytics",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# ── 1. Security Headers Middleware (OWASP / HIPAA) ─────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)

# ── 2. Sliding Window Rate Limiter (Anti-DoS / Brute Force) ───────────────────
app.add_middleware(RateLimiterMiddleware, read_limit=240, write_limit=60)

# ── 3. Production CORS Configuration ──────────────────────────────────────────
raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:80,http://localhost,http://127.0.0.1")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "Retry-After"]
)

# ── 4. Sanitized Global Exception Handler (No Data / Credential Leaks) ────────
app.add_exception_handler(Exception, secure_exception_handler)

# ── Route mounts ───────────────────────────────────────────────────────────────
app.include_router(patients.router, prefix="/api/patients", tags=["patients"])
app.include_router(cases.router,    prefix="/api/cases",    tags=["cases"])
app.include_router(beds.router,     prefix="/api/beds",     tags=["beds"])
app.include_router(orders.router,   prefix="/api/orders",   tags=["orders"])
app.include_router(alerts.router,   prefix="/api/alerts",   tags=["alerts"])
app.include_router(metrics.router,  prefix="/api/metrics",  tags=["metrics"])
app.include_router(drugs.router,    prefix="/api/drugs",    tags=["drugs"])


# ── WebSocket endpoint ─────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; server pushes data proactively
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
async def health():
    return {"status": "ok", "service": "vitalstream-api"}
