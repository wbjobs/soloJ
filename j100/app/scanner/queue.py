from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from typing import Any

from app.config import settings
from app.scanner.cosign_client import CosignSigner
from app.scanner.policy import SecurityPolicy
from app.scanner.trivy import TrivyScanner, Vulnerability
from app.store.database import ScanStore

logger = logging.getLogger(__name__)


@dataclass
class ScanTask:
    task_id: str
    scan_id: int
    image_ref: str
    digest: str
    status: str = "queued"
    total_vulns: int = 0
    batches_saved: int = 0


class ScanQueue:
    def __init__(
        self,
        store: ScanStore,
        scanner: TrivyScanner | None = None,
        signer: CosignSigner | None = None,
        policy: SecurityPolicy | None = None,
    ):
        self.store = store
        self.scanner = scanner or TrivyScanner()
        self.signer = signer or CosignSigner()
        self.policy = policy or SecurityPolicy(store, self.signer)
        self._queue: asyncio.Queue[ScanTask] = asyncio.Queue(
            maxsize=settings.queue_max_size
        )
        self._tasks: dict[str, ScanTask] = {}
        self._running = False
        self._max_task_history: int = settings.max_task_history

    async def start(self, concurrency: int | None = None) -> None:
        self._running = True
        workers = concurrency or settings.scan_concurrency
        for _ in range(workers):
            asyncio.create_task(self._worker_loop())
        asyncio.create_task(self._cleanup_old_tasks())
        logger.info("Scan queue started with %d workers", workers)

    async def stop(self) -> None:
        self._running = False

    async def enqueue(self, scan_id: int, image_ref: str, digest: str) -> str:
        task_id = uuid.uuid4().hex[:12]
        task = ScanTask(
            task_id=task_id,
            scan_id=scan_id,
            image_ref=image_ref,
            digest=digest,
        )

        try:
            await asyncio.wait_for(self._queue.put(task), timeout=10)
        except asyncio.TimeoutError:
            logger.error("Queue is full, rejecting scan for %s", image_ref)
            raise RuntimeError("Scan queue is full, try again later")

        self._tasks[task_id] = task
        logger.info("Enqueued scan task %s for %s", task_id, image_ref)
        return task_id

    async def get_task_status(self, task_id: str) -> dict[str, Any] | None:
        task = self._tasks.get(task_id)
        if not task:
            return None
        return {
            "task_id": task.task_id,
            "scan_id": task.scan_id,
            "image_ref": task.image_ref,
            "status": task.status,
            "total_vulns": task.total_vulns,
            "batches_saved": task.batches_saved,
        }

    async def _worker_loop(self) -> None:
        while self._running:
            try:
                task = await asyncio.wait_for(self._queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue

            task.status = "running"
            await self.store.update_scan_status(task.scan_id, "scanning")

            try:
                await self._run_scan(task)

                task.status = "completed"
                logger.info(
                    "Scan completed for %s: %d vulnerabilities in %d batches",
                    task.image_ref,
                    task.total_vulns,
                    task.batches_saved,
                )

            except Exception as e:
                logger.error("Scan failed for %s: %s", task.image_ref, e)
                task.status = "failed"
                await self.store.update_scan_status(task.scan_id, "failed")

            finally:
                self._queue.task_done()

    async def _run_scan(self, task: ScanTask) -> None:
        first_batch = True

        async def save_batch(vulns: list[Vulnerability]) -> None:
            nonlocal first_batch

            task.total_vulns += len(vulns)
            task.batches_saved += 1

            if first_batch:
                await self.store.clear_vulnerabilities(task.scan_id)
                first_batch = False

            vuln_dicts = [
                {
                    "cve_id": v.cve_id,
                    "pkg_name": v.pkg_name,
                    "installed_version": v.installed_version,
                    "fixed_version": v.fixed_version,
                    "severity": v.severity,
                    "title": v.title,
                    "description": v.description,
                    "primary_url": v.primary_url,
                    "references": v.references,
                }
                for v in vulns
            ]

            await self.store.save_vulnerabilities_batch(task.scan_id, vuln_dicts)
            vuln_dicts.clear()

            if task.batches_saved % 5 == 0:
                logger.debug(
                    "Scan progress for %s: %d vulns, %d batches",
                    task.image_ref,
                    task.total_vulns,
                    task.batches_saved,
                )

        summary = await self.scanner.scan_image(
            task.image_ref,
            task.digest,
            on_batch=save_batch,
        )

        await self.store.update_scan_status(
            task.scan_id, "completed", summary.severity_summary
        )

        if self.policy.should_sign_image(summary.severity_summary):
            logger.info("Vulnerability policy passed, attempting to sign %s", task.image_ref)
            sign_result = await self.signer.sign_image(
                task.image_ref,
                task.digest,
                annotations={
                    "scan_id": str(task.scan_id),
                    "vulnerability_count": str(summary.vulnerability_count),
                    "severity_summary": json.dumps(summary.severity_summary),
                },
            )
            if sign_result.success and sign_result.signed:
                logger.info("Successfully signed %s", task.image_ref)
            elif not sign_result.success:
                logger.warning("Failed to sign %s: %s", task.image_ref, sign_result.error)

    async def _cleanup_old_tasks(self) -> None:
        while self._running:
            await asyncio.sleep(300)
            try:
                completed = [
                    tid
                    for tid, t in self._tasks.items()
                    if t.status in ("completed", "failed")
                ]
                to_remove = max(0, len(completed) - self._max_task_history)
                if to_remove > 0:
                    for tid in completed[:to_remove]:
                        del self._tasks[tid]
                    logger.info("Cleaned up %d old task entries", to_remove)
            except Exception as e:
                logger.error("Task cleanup error: %s", e)
