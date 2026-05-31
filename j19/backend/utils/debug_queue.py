import logging
import threading
import time
import heapq
from typing import Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class CommandStatus(Enum):
    QUEUED = "queued"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMED_OUT = "timed_out"
    CANCELLED = "cancelled"


@dataclass(order=True)
class _QueueItem:
    priority: int
    enqueue_time: float
    command_id: int = field(compare=False)
    command: str = field(compare=False)
    timeout: float = field(compare=False)
    status: CommandStatus = field(default=CommandStatus.QUEUED, compare=False)
    result: Any = field(default=None, compare=False)
    error: Optional[str] = field(default=None, compare=False)
    started_at: Optional[float] = field(default=None, compare=False)
    completed_at: Optional[float] = field(default=None, compare=False)


class DebugCommandQueue:
    def __init__(self):
        self._heap: list = []
        self._counter: int = 0
        self._lock = threading.Lock()
        self._condition = threading.Condition(self._lock)
        self._items: dict[int, _QueueItem] = {}
        self._callbacks: dict[int, list] = {}
        self._default_timeout: float = 30.0
        self._running: bool = True
        self._worker_thread: Optional[threading.Thread] = None

    def enqueue(self, command_id: int, command: str, priority: int = 0, timeout: float = 30.0) -> _QueueItem:
        with self._condition:
            if command_id in self._items:
                raise ValueError(f"Command ID {command_id} already queued")

            item = _QueueItem(
                priority=-priority,
                enqueue_time=time.monotonic(),
                command_id=command_id,
                command=command,
                timeout=timeout or self._default_timeout,
            )

            self._items[command_id] = item
            heapq.heappush(self._heap, item)
            self._counter += 1

            self._condition.notify_all()
            logger.debug(f"Command queued: id={command_id}, priority={priority}, cmd={command[:50]}")
            return item

    def dequeue(self, timeout: float = 1.0) -> Optional[_QueueItem]:
        with self._condition:
            end_time = time.monotonic() + timeout
            while self._running:
                if self._heap:
                    item = heapq.heappop(self._heap)
                    if item.status == CommandStatus.CANCELLED:
                        continue
                    item.status = CommandStatus.EXECUTING
                    item.started_at = time.monotonic()
                    self._items[item.command_id] = item
                    return item

                remaining = end_time - time.monotonic()
                if remaining <= 0:
                    return None
                self._condition.wait(timeout=remaining)
            return None

    def complete(self, command_id: int, result: Any = None) -> None:
        with self._condition:
            item = self._items.get(command_id)
            if not item:
                logger.warning(f"Cannot complete unknown command ID: {command_id}")
                return

            item.status = CommandStatus.COMPLETED
            item.result = result
            item.completed_at = time.monotonic()
            self._items[command_id] = item
            self._condition.notify_all()

            self._fire_callbacks(command_id, item)
            logger.debug(f"Command completed: id={command_id}, result={str(result)[:100]}")

    def fail(self, command_id: int, error: str) -> None:
        with self._condition:
            item = self._items.get(command_id)
            if not item:
                logger.warning(f"Cannot fail unknown command ID: {command_id}")
                return

            item.status = CommandStatus.FAILED
            item.error = error
            item.completed_at = time.monotonic()
            self._items[command_id] = item
            self._condition.notify_all()

            self._fire_callbacks(command_id, item)
            logger.debug(f"Command failed: id={command_id}, error={error}")

    def cancel(self, command_id: int) -> bool:
        with self._condition:
            item = self._items.get(command_id)
            if not item:
                return False

            if item.status in (CommandStatus.COMPLETED, CommandStatus.FAILED, CommandStatus.CANCELLED):
                return False

            item.status = CommandStatus.CANCELLED
            item.error = "Cancelled by user"
            item.completed_at = time.monotonic()
            self._items[command_id] = item
            self._condition.notify_all()

            self._fire_callbacks(command_id, item)
            logger.debug(f"Command cancelled: id={command_id}")
            return True

    def get_status(self, command_id: int) -> Optional[dict]:
        with self._lock:
            item = self._items.get(command_id)
            if not item:
                return None

            return {
                "command_id": item.command_id,
                "command": item.command,
                "status": item.status.value,
                "result": item.result,
                "error": item.error,
                "priority": -item.priority,
                "enqueued_at": item.enqueue_time,
                "started_at": item.started_at,
                "completed_at": item.completed_at,
            }

    def wait_for_result(self, command_id: int, timeout: Optional[float] = None) -> dict:
        with self._condition:
            item = self._items.get(command_id)
            if not item:
                raise ValueError(f"Command ID {command_id} not found")

            effective_timeout = timeout if timeout is not None else item.timeout

            if item.status in (CommandStatus.COMPLETED, CommandStatus.FAILED, CommandStatus.CANCELLED):
                return self._item_to_dict(item)

            if item.status == CommandStatus.QUEUED:
                item.status = CommandStatus.EXECUTING
                item.started_at = time.monotonic()

            deadline = time.monotonic() + effective_timeout
            while item.status not in (CommandStatus.COMPLETED, CommandStatus.FAILED, CommandStatus.CANCELLED):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    item.status = CommandStatus.TIMED_OUT
                    item.error = f"Command timed out after {effective_timeout}s"
                    item.completed_at = time.monotonic()
                    self._items[command_id] = item
                    return self._item_to_dict(item)

                self._condition.wait(timeout=min(remaining, 1.0))
                item = self._items[command_id]

            return self._item_to_dict(item)

    def _item_to_dict(self, item: _QueueItem) -> dict:
        return {
            "command_id": item.command_id,
            "command": item.command,
            "status": item.status.value,
            "result": item.result,
            "error": item.error,
            "priority": -item.priority,
            "enqueued_at": item.enqueue_time,
            "started_at": item.started_at,
            "completed_at": item.completed_at,
        }

    def on_command_complete(self, command_id: int, callback: Callable) -> None:
        with self._lock:
            if command_id not in self._callbacks:
                self._callbacks[command_id] = []
            self._callbacks[command_id].append(callback)

    def _fire_callbacks(self, command_id: int, item: _QueueItem) -> None:
        callbacks = self._callbacks.pop(command_id, [])
        for cb in callbacks:
            try:
                cb(self._item_to_dict(item))
            except Exception as e:
                logger.error(f"Callback error for command {command_id}: {e}")

    def clear(self) -> None:
        with self._condition:
            for item in self._items.values():
                if item.status in (CommandStatus.QUEUED, CommandStatus.EXECUTING):
                    item.status = CommandStatus.CANCELLED
                    item.error = "Queue cleared"
                    item.completed_at = time.monotonic()

            self._heap.clear()
            self._counter = 0
            self._callbacks.clear()
            self._condition.notify_all()
            logger.info("Debug command queue cleared")

    def size(self) -> int:
        with self._lock:
            return sum(1 for item in self._items.values() if item.status == CommandStatus.QUEUED)

    def active_count(self) -> int:
        with self._lock:
            return sum(1 for item in self._items.values() if item.status == CommandStatus.EXECUTING)

    def stop(self) -> None:
        with self._condition:
            self._running = False
            self._condition.notify_all()

    def start_worker(self, handler: Callable) -> None:
        if self._worker_thread and self._worker_thread.is_alive():
            return

        self._running = True

        def worker():
            logger.info("Debug command queue worker started")
            while self._running:
                try:
                    item = self.dequeue(timeout=1.0)
                    if item is None:
                        continue

                    try:
                        result = handler(item.command, item.command_id)
                        self.complete(item.command_id, result)
                    except Exception as e:
                        self.fail(item.command_id, str(e))
                except Exception as e:
                    logger.error(f"Worker error: {e}")

            logger.info("Debug command queue worker stopped")

        self._worker_thread = threading.Thread(target=worker, daemon=True)
        self._worker_thread.start()

    def get_all_status(self) -> list:
        with self._lock:
            return [self._item_to_dict(item) for item in self._items.values()]
