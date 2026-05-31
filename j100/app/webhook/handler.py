from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.config import settings
from app.store.database import ScanStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhook", tags=["webhook"])


def get_store() -> ScanStore:
    from app.main import app_state

    return app_state.store


def verify_signature(payload: bytes, signature: str | None) -> bool:
    if not settings.webhook_secret:
        return True
    if not signature:
        return False
    expected = hmac.new(
        settings.webhook_secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)


@router.post("/registry", summary="Handle Docker Registry push events")
async def handle_registry_event(
    request: Request,
    x_hub_signature: str | None = Header(None),
    store: ScanStore = Depends(get_store),
) -> dict[str, Any]:
    body = await request.body()

    if not verify_signature(body, x_hub_signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        event = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    events = event.get("events", [])
    if not events and event.get("action"):
        events = [event]

    queued = []
    for ev in events:
        action = ev.get("action", "")
        target = ev.get("target", {})

        if action != "push":
            continue

        repository = target.get("repository", "")
        tag = target.get("tag", "")
        digest = target.get("digest", "")

        if not repository:
            logger.warning("Push event missing repository, skipping")
            continue

        if not tag and digest:
            tag = digest[:12]

        from app.main import app_state
        from app.registry.client import RegistryClient

        registry = RegistryClient()
        image_ref = registry.image_ref(repository, tag or "latest")

        scan_id = await store.create_scan(
            image=image_ref,
            repository=repository,
            tag=tag or "latest",
            digest=digest,
        )

        task_id = await app_state.scan_queue.enqueue(
            scan_id, image_ref, digest
        )

        queued.append(
            {
                "repository": repository,
                "tag": tag,
                "digest": digest,
                "scan_id": scan_id,
                "task_id": task_id,
            }
        )

        logger.info(
            "Queued scan for %s:%s (scan_id=%d, task_id=%s)",
            repository,
            tag,
            scan_id,
            task_id,
        )

    return {"status": "ok", "queued": queued, "count": len(queued)}
