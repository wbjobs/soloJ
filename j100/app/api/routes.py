from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.store.database import ScanStore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["scans"])


def get_store() -> ScanStore:
    from app.main import app_state

    return app_state.store


@router.get("/scans", summary="List all scans")
async def list_scans(
    repository: str | None = Query(None, description="Filter by repository"),
    status: str | None = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    store: ScanStore = Depends(get_store),
) -> dict[str, Any]:
    scans = await store.list_scans(repository=repository, status=status, limit=limit, offset=offset)
    return {"scans": scans, "count": len(scans)}


@router.get("/scans/{scan_id}", summary="Get scan details")
async def get_scan(
    scan_id: int,
    store: ScanStore = Depends(get_store),
) -> dict[str, Any]:
    scan = await store.get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


@router.get("/scans/{scan_id}/vulnerabilities", summary="Get vulnerabilities for a scan")
async def get_scan_vulnerabilities(
    scan_id: int,
    severity: str | None = Query(None, description="Filter by severity (CRITICAL/HIGH/MEDIUM/LOW)"),
    store: ScanStore = Depends(get_store),
) -> dict[str, Any]:
    scan = await store.get_scan(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    vulns = await store.get_vulnerabilities(scan_id, severity=severity)
    return {"scan_id": scan_id, "vulnerabilities": vulns, "count": len(vulns)}


@router.get(
    "/images/{repository:path}/{tag}/vulnerabilities",
    summary="Get CVE vulnerabilities for a specific image",
)
async def get_image_vulnerabilities(
    repository: str,
    tag: str,
    severity: str | None = Query(None, description="Filter by severity (CRITICAL/HIGH/MEDIUM/LOW)"),
    store: ScanStore = Depends(get_store),
) -> dict[str, Any]:
    result = await store.get_image_vulnerabilities(repository, tag, severity=severity)
    if not result:
        raise HTTPException(
            status_code=404,
            detail=f"No scan results found for {repository}:{tag}",
        )
    return result


@router.get(
    "/images/{repository:path}/{tag}",
    summary="Get scan summary for a specific image",
)
async def get_image_scan(
    repository: str,
    tag: str,
    store: ScanStore = Depends(get_store),
) -> dict[str, Any]:
    scan = await store.get_latest_scan_for_image(repository, tag)
    if not scan:
        raise HTTPException(
            status_code=404,
            detail=f"No scan found for {repository}:{tag}",
        )
    import json
    scan["severity_summary"] = json.loads(scan.get("severity_summary", "{}"))
    return scan


@router.post("/scans/trigger", summary="Manually trigger a scan for an image")
async def trigger_scan(
    repository: str = Query(..., description="Image repository"),
    tag: str = Query("latest", description="Image tag"),
) -> dict[str, Any]:
    from app.main import app_state
    from app.registry.client import RegistryClient

    registry = RegistryClient()
    try:
        manifest = await registry.get_manifest(repository, tag)
        image_ref = registry.image_ref(repository, tag)

        scan_id = await app_state.store.create_scan(
            image=image_ref,
            repository=repository,
            tag=tag,
            digest=manifest.config_digest,
        )

        task_id = await app_state.scan_queue.enqueue(scan_id, image_ref, manifest.config_digest)

        return {
            "scan_id": scan_id,
            "task_id": task_id,
            "image": image_ref,
            "status": "queued",
        }
    except Exception as e:
        logger.error("Failed to trigger scan: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/policy/verify",
    summary="Verify image against security policy (for deployment admission)",
)
async def verify_policy(
    repository: str = Query(..., description="Image repository"),
    tag: str = Query(..., description="Image tag"),
    digest: str = Query("", description="Image digest (optional)"),
    require_signature: bool = Query(None, description="Require Cosign signature"),
) -> dict[str, Any]:
    """
    Verify if an image meets the security policy.
    This endpoint is designed for Kubernetes Admission Controllers,
    CI/CD pipelines, or any deployment system to call before allowing deployment.

    Returns decision:
    - allow: Image is signed and has no high/critical vulnerabilities
    - deny: Image fails security checks
    - unknown: Scan results not available yet
    """
    from app.main import app_state

    result = await app_state.policy.evaluate_image(
        repository, tag, digest, require_signature)

    response = {
        "image": f"{repository}:{tag}",
        "decision": result.decision,
        "signed": result.signed,
        "scan_available": result.scan_available,
        "scan_passed": result.scan_passed,
        "violations": result.violations,
        "scan_summary": result.scan_summary,
    }

    if result.decision == "deny":
        response["message"] = "Deployment denied by security policy"

    return response
