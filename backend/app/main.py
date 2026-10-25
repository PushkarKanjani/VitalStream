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
from app.api import cases, beds, orders, alerts, patients, metrics
from app.websocket_manager import ConnectionManager, change_stream_listener

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

    yield

    # Shutdown
    await disconnect_mongo()
    logger.info("MongoDB disconnected")


# ── App factory ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="VitalStream API",
    description="Perioperative command center — real-time OR monitoring",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Route mounts ───────────────────────────────────────────────────────────────
app.include_router(patients.router, prefix="/api/patients", tags=["patients"])
app.include_router(cases.router,    prefix="/api/cases",    tags=["cases"])
app.include_router(beds.router,     prefix="/api/beds",     tags=["beds"])
app.include_router(orders.router,   prefix="/api/orders",   tags=["orders"])
app.include_router(alerts.router,   prefix="/api/alerts",   tags=["alerts"])
app.include_router(metrics.router,  prefix="/api/metrics",  tags=["metrics"])


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
