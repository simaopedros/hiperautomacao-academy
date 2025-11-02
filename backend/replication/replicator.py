import asyncio
import traceback
from typing import Any, Dict, Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from .config_store import load_config
from .audit_logger import get_audit_logger


class ReplicationStats:
    def __init__(self) -> None:
        self.total_enqueued = 0
        self.total_processed = 0
        self.total_errors = 0
        self.last_error: Optional[str] = None
        self.last_success_ts: Optional[float] = None


class ReplicationManager:
    """Background replication manager that processes queued write operations.
    Primary writes complete immediately; replication happens asynchronously to secondary.
    """

    def __init__(self) -> None:
        self.queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()
        self.enabled: bool = False
        self.secondary_client: Optional[AsyncIOMotorClient] = None
        self.secondary_db: Optional[AsyncIOMotorDatabase] = None
        self.worker_task: Optional[asyncio.Task] = None
        self.stats = ReplicationStats()
        self.audit = get_audit_logger()

    async def start(self) -> None:
        # Load initial config
        cfg = load_config()
        await self.configure(cfg)
        # Start worker
        if self.worker_task is None:
            self.worker_task = asyncio.create_task(self._worker())

    async def stop(self) -> None:
        if self.worker_task:
            self.worker_task.cancel()
            try:
                await self.worker_task
            except Exception:
                pass
            self.worker_task = None

    async def configure(self, cfg: Dict[str, Any]) -> None:
        # Recreate secondary client if config changes
        try:
            if self.secondary_client:
                self.secondary_client.close()
            self.enabled = bool(cfg.get("replication_enabled", False))
            mongo_url = cfg.get("mongo_url") or ""
            db_name = cfg.get("db_name") or ""
            if self.enabled and mongo_url and db_name:
                # Using URL that may already include credentials
                self.secondary_client = AsyncIOMotorClient(mongo_url)
                self.secondary_db = self.secondary_client[db_name]
            else:
                self.secondary_client = None
                self.secondary_db = None
        except Exception as e:
            # Disable on misconfiguration
            self.enabled = False
            self.secondary_client = None
            self.secondary_db = None
            self.stats.total_errors += 1
            self.stats.last_error = f"configure_error: {e}"

    def enqueue(self, item: Dict[str, Any]) -> None:
        self.stats.total_enqueued += 1
        self.queue.put_nowait(item)

    async def _worker(self) -> None:
        backoff = 0.5
        while True:
            item = await self.queue.get()
            try:
                if not self.enabled or self.secondary_db is None:
                    # Skip silently if disabled; do not block primary
                    self.queue.task_done()
                    continue

                coll = self.secondary_db[item["collection"]]
                op = item["op"]

                if op == "insert_one":
                    await coll.insert_one(item["document"])
                elif op == "insert_many":
                    await coll.insert_many(item["documents"])
                elif op == "update_one":
                    await coll.update_one(item["filter"], item["update"], **item.get("kwargs", {}))
                elif op == "update_many":
                    await coll.update_many(item["filter"], item["update"], **item.get("kwargs", {}))
                elif op == "replace_one":
                    await coll.replace_one(item["filter"], item["replacement"], **item.get("kwargs", {}))
                elif op == "delete_one":
                    await coll.delete_one(item["filter"])
                elif op == "delete_many":
                    await coll.delete_many(item["filter"])
                elif op == "bulk_write":
                    await coll.bulk_write(item["requests"], **item.get("kwargs", {}))
                else:
                    # Unknown op; ignore but log
                    self.audit.info(f"unknown_op {op} collection={item.get('collection')}")

                self.stats.total_processed += 1
                self.queue.task_done()
                self.audit.info(
                    f"replicated op={op} collection={item.get('collection')} status=success"
                )
            except Exception as e:
                self.stats.total_errors += 1
                self.stats.last_error = f"{type(e).__name__}: {e}"
                import traceback
                tb = traceback.format_exc()
                self.audit.error(
                    f"replication_error op={item.get('op')} collection={item.get('collection')} error={e}\n{tb}"
                )
                # Simple backoff before retrying
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 5)
                # Re-enqueue for retry
                self.queue.put_nowait(item)


class ReplicatingCollection:
    def __init__(self, primary: AsyncIOMotorCollection, manager: ReplicationManager, name: str) -> None:
        self._primary = primary
        self._manager = manager
        self._name = name

    # Write operations: call primary, then enqueue for secondary
    async def insert_one(self, document: Dict[str, Any], **kwargs):
        result = await self._primary.insert_one(document, **kwargs)
        self._manager.enqueue({"op": "insert_one", "collection": self._name, "document": document})
        return result

    async def insert_many(self, documents, **kwargs):
        result = await self._primary.insert_many(documents, **kwargs)
        self._manager.enqueue({"op": "insert_many", "collection": self._name, "documents": documents})
        return result

    async def update_one(self, filter: Dict[str, Any], update: Dict[str, Any], **kwargs):
        result = await self._primary.update_one(filter, update, **kwargs)
        self._manager.enqueue({
            "op": "update_one",
            "collection": self._name,
            "filter": filter,
            "update": update,
            "kwargs": kwargs,
        })
        return result

    async def update_many(self, filter: Dict[str, Any], update: Dict[str, Any], **kwargs):
        result = await self._primary.update_many(filter, update, **kwargs)
        self._manager.enqueue({
            "op": "update_many",
            "collection": self._name,
            "filter": filter,
            "update": update,
            "kwargs": kwargs,
        })
        return result

    async def replace_one(self, filter: Dict[str, Any], replacement: Dict[str, Any], **kwargs):
        result = await self._primary.replace_one(filter, replacement, **kwargs)
        self._manager.enqueue({
            "op": "replace_one",
            "collection": self._name,
            "filter": filter,
            "replacement": replacement,
            "kwargs": kwargs,
        })
        return result

    async def delete_one(self, filter: Dict[str, Any], **kwargs):
        result = await self._primary.delete_one(filter, **kwargs)
        self._manager.enqueue({"op": "delete_one", "collection": self._name, "filter": filter})
        return result

    async def delete_many(self, filter: Dict[str, Any], **kwargs):
        result = await self._primary.delete_many(filter, **kwargs)
        self._manager.enqueue({"op": "delete_many", "collection": self._name, "filter": filter})
        return result

    async def bulk_write(self, requests, **kwargs):
        result = await self._primary.bulk_write(requests, **kwargs)
        self._manager.enqueue({"op": "bulk_write", "collection": self._name, "requests": requests, "kwargs": kwargs})
        return result

    # Read operations: direct passthrough to primary
    def find(self, *args, **kwargs):
        return self._primary.find(*args, **kwargs)

    async def find_one(self, *args, **kwargs):
        return await self._primary.find_one(*args, **kwargs)

    def aggregate(self, *args, **kwargs):
        return self._primary.aggregate(*args, **kwargs)

    def __getattr__(self, item):
        # Fallback passthrough
        return getattr(self._primary, item)


class ReplicatingDatabase:
    def __init__(self, primary: AsyncIOMotorDatabase, manager: ReplicationManager) -> None:
        self._primary = primary
        self._manager = manager

    def __getitem__(self, name: str) -> ReplicatingCollection:
        return ReplicatingCollection(self._primary[name], self._manager, name)

    def __getattr__(self, name: str) -> ReplicatingCollection:
        # Access collections like db.users
        return ReplicatingCollection(getattr(self._primary, name), self._manager, name)

    def __bool__(self) -> bool:
        # Prevent truth value testing error by always returning True for valid database wrapper
        return self._primary is not None

    # Allow commands pass-through
    async def command(self, *args, **kwargs):
        return await self._primary.command(*args, **kwargs)


def wrap_database(primary_db: AsyncIOMotorDatabase, manager: ReplicationManager) -> ReplicatingDatabase:
    """Return a wrapper that preserves existing db API while enabling async replication."""
    return ReplicatingDatabase(primary_db, manager)