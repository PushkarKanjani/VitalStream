"""WebSocket connection manager + MongoDB change-stream listener."""

from __future__ import annotations
import json
import logging
from datetime import datetime
from fastapi import WebSocket
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("vitalstream.ws")


class ConnectionManager:
    """Tracks all active WebSocket connections and broadcasts to all."""

    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        logger.info(f"WS connected. Total: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        self.active.remove(ws)
        logger.info(f"WS disconnected. Total: {len(self.active)}")

    async def broadcast(self, message: dict):
        payload = json.dumps(message, default=str)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


async def change_stream_listener(db: AsyncIOMotorDatabase, manager: ConnectionManager):
    """
    Watches 3 MongoDB collections for changes and broadcasts to all WS clients.
    Attempts MongoDB change-streams first; if not on a replica set, falls back to periodic heartbeat.
    """
    import asyncio
    pipeline = [{"$match": {"operationType": {"$in": ["insert", "update", "replace"]}}}]

    logger.info("Starting MongoDB change-stream watchers…")

    async def watch_collection(collection_name: str, event_type: str):
        collection = db[collection_name]
        async with collection.watch(pipeline, full_document="updateLookup") as stream:
            async for change in stream:
                doc = change.get("fullDocument") or {}
                doc.pop("_id", None)
                await manager.broadcast({
                    "event": event_type,
                    "collection": collection_name,
                    "operation": change["operationType"],
                    "data": doc,
                    "ts": datetime.utcnow().isoformat(),
                })

    try:
        await asyncio.gather(
            watch_collection("alerts", "alert_change"),
            watch_collection("cases",  "case_change"),
            watch_collection("beds",   "bed_change"),
        )
    except Exception as e:
        logger.warning(f"Change streams unavailable on standalone MongoDB ({e}). Falling back to heartbeat loop.")
        while True:
            await asyncio.sleep(3)
            if manager.active:
                try:
                    unacked_count = await db.alerts.count_documents({"acknowledged": False})
                    await manager.broadcast({
                        "event": "heartbeat",
                        "unacked_alerts": unacked_count,
                        "ts": datetime.utcnow().isoformat(),
                    })
                except Exception:
                    pass
