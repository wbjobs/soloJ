from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from app.config import settings
from app.scanner.cosign_client import CosignSigner
from app.scanner.trivy import Severity
from app.store.database import ScanStore

logger = logging.getLogger(__name__)


class PolicyDecision(str, Enum):
    ALLOW = "allow"
    DENY = "deny"
    UNKNOWN = "unknown"


@dataclass
class PolicyResult:
    decision: PolicyDecision
    image_ref: str
    signed: bool = False
    scan_available: bool = False
    scan_passed: bool = False
    violations: list[str] = field(default_factory=list)
    scan_summary: dict[str, int] = field(default_factory=dict)


class SecurityPolicy:
    def __init__(
        self,
        store: ScanStore,
        signer: CosignSigner | None = None,
        max_allowed_severity: str | None = None,
        require_signature: bool = True,
    ):
        self.store = store
        self.signer = signer or CosignSigner()
        self.max_allowed_severity = (
            max_allowed_severity or settings.max_allowed_severity
        ).upper()
        self.require_signature = require_signature

    async def evaluate_image(
        self,
        repository: str,
        tag: str,
        digest: str = "",
        verify_signature: bool | None = None,
    ) -> PolicyResult:
        result = PolicyResult(
            decision=PolicyDecision.DENY,
            image_ref=f"{repository}:{tag}",
        )

        check_signature = (
            verify_signature if verify_signature is not None else self.require_signature
        )

        if check_signature:
            full_ref = f"localhost:5000/{repository}" if not digest else f"localhost:5000/{repository}@{digest}"
            result.signed = await self._check_signature(full_ref, digest)
            if not result.signed:
                result.violations.append("Image is not signed with Cosign")

        scan = await self.store.get_latest_scan_for_image(repository, tag)
        if scan:
            result.scan_available = True
            summary_json = scan.get("severity_summary", "{}")
            if isinstance(summary_json, str):
                summary = json.loads(summary_json)
            else:
                summary = summary_json
            result.scan_summary = summary

            scan_passed = self._check_vulnerability_policy(summary, result.violations)
            result.scan_passed = scan_passed
            if scan.get("status") != "completed":
                result.violations.append(f"Scan status is {scan.get('status')}, not completed")
                result.scan_passed = False
        else:
            result.violations.append("No scan results available for this image")

        if check_signature and not result.signed:
            result.decision = PolicyDecision.DENY
        elif result.scan_available and not result.scan_passed:
            result.decision = PolicyDecision.DENY
        elif not result.scan_available:
            result.decision = PolicyDecision.UNKNOWN
            result.violations.append("Scan results pending")
        else:
            result.decision = PolicyDecision.ALLOW

        return result

    async def _check_signature(self, image_ref: str, digest: str = "") -> bool:
        try:
            return await self.signer.verify_image(image_ref, digest)
        except Exception as e:
            logger.warning("Signature verification failed for %s: %s", image_ref, e)
            return False

    def _check_vulnerability_policy(
        self,
        summary: dict[str, int],
        violations: list[str],
    ) -> bool:
        if not summary:
            return True

        threshold_weight = Severity.weight(self.max_allowed_severity)

        for severity, count in summary.items():
            if count <= 0:
                continue
            sev_weight = Severity.weight(severity)
            if sev_weight > threshold_weight:
                violations.append(
                    f"Found {count} {severity} vulnerabilities, which exceeds the maximum allowed level ({self.max_allowed_severity})"
                )

        return len([v for v in violations if "exceeds the maximum allowed" in v]) == 0

    def should_sign_image(self, summary: dict[str, int]) -> bool:
        if not settings.auto_sign_enabled:
            return False

        threshold_weight = Severity.weight(self.max_allowed_severity)

        for severity, count in summary.items():
            if count <= 0:
                continue
            sev_weight = Severity.weight(severity)
            if sev_weight > threshold_weight:
                logger.info(
                    "Not signing image: %d %s vulnerabilities exceed threshold",
                    count,
                    severity,
                )
                return False

        return True
