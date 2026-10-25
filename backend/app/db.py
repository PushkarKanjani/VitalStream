"""VitalStream — MongoDB async client (Motor)."""

import os
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_mongo() -> None:
    global _client, _db
    uri = os.getenv("MONGO_URI", "mongodb://vsadmin:vspass2024@localhost:27017/vitalstream?authSource=admin")
    db_name = os.getenv("MONGO_DB", "vitalstream")
    _client = AsyncIOMotorClient(uri)
    _db = _client[db_name]
    # Ping to verify connection
    await _db.command("ping")


async def disconnect_mongo() -> None:
    if _client:
        _client.close()


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("MongoDB not connected. Call connect_mongo() first.")
    return _db
