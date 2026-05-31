from __future__ import annotations

import asyncio
import json
import logging
import os
import tempfile
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable

from app.config import settings

logger = logging.getLogger(__name__)


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    UNKNOWN = "UNKNOWN"

    @classmethod
    def weight(cls, value: str) -> int:
        order = {
            cls.CRITICAL: 5,
            cls.HIGH: 4,
            cls.MEDIUM: 3,
            cls.LOW: 2,
            cls.UNKNOWN: 1,
        }
        return order.get(cls(value), 0) if value in cls._value2member_map_ else 0


@dataclass
class Vulnerability:
    cve_id: str
    pkg_name: str
    installed_version: str
    fixed_version: str
    severity: str
    title: str
    description: str
    primary_url: str
    references: list[str] = field(default_factory=list)


@dataclass
class ScanResultSummary:
    image: str
    digest: str
    vulnerability_count: int = 0
    severity_summary: dict[str, int] = field(default_factory=dict)


class TrivyScanner:
    def __init__(self, binary: str | None = None):
        self.binary = binary or settings.trivy_binary
        self.scan_timeout: int = settings.scan_timeout_seconds
        self.max_output_size: int = settings.max_scan_output_size_mb * 1024 * 1024
        self.batch_size: int = settings.scan_batch_size

    async def scan_image(
        self,
        image_ref: str,
        digest: str = "",
        on_batch: Callable[[list[Vulnerability]], Any] | None = None,
    ) -> ScanResultSummary:
        target = f"{image_ref}@{digest}" if digest else image_ref
        tmp_file: str | None = None

        cmd = [
            self.binary,
            "image",
            "--format",
            "json",
            "--no-progress",
            "--skip-db-update",
            "--scanners",
            "vuln",
            target,
        ]

        logger.info("Starting Trivy scan for %s", target)

        summary = ScanResultSummary(image=image_ref, digest=digest)

        try:
            tmp_file = tempfile.mktemp(suffix=".json", prefix="trivy_")

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            total_written = 0
            with open(tmp_file, "wb") as f:
                try:
                    while True:
                        chunk = await asyncio.wait_for(
                            proc.stdout.read(64 * 1024),
                            timeout=self.scan_timeout,
                        )
                        if not chunk:
                            break
                        total_written += len(chunk)
                        if total_written > self.max_output_size:
                            logger.error(
                                "Scan output exceeds limit (%d MB), aborting",
                                settings.max_scan_output_size_mb,
                            )
                            proc.kill()
                            raise RuntimeError("Scan output too large")
                        f.write(chunk)

                    _, stderr = await asyncio.wait_for(
                        proc.communicate(),
                        timeout=30,
                    )

                    if proc.returncode != 0:
                        err_msg = stderr.decode(errors="replace")[:5000]
                        logger.error(
                            "Trivy scan failed (exit %d): %s",
                            proc.returncode,
                            err_msg,
                        )
                        raise RuntimeError(f"Trivy exited with code {proc.returncode}")

                except asyncio.TimeoutError:
                    logger.error("Scan timed out after %d seconds", self.scan_timeout)
                    proc.kill()
                    raise

            await self._process_results(
                tmp_file,
                summary,
                on_batch,
            )

            logger.info(
                "Scan completed for %s: %d vulnerabilities, %s",
                image_ref,
                summary.vulnerability_count,
                summary.severity_summary,
            )
            return summary

        finally:
            if tmp_file and os.path.exists(tmp_file):
                try:
                    os.unlink(tmp_file)
                except OSError:
                    pass

    async def _process_results(
        self,
        file_path: str,
        summary: ScanResultSummary,
        on_batch: Callable[[list[Vulnerability]], Any] | None,
    ) -> None:
        file_size = os.path.getsize(file_path)

        if file_size > 100 * 1024 * 1024:
            logger.warning(
                "Large scan output (%d MB), memory-optimized parsing",
                file_size // (1024 * 1024),
            )

        loop = asyncio.get_event_loop()

        def parse_and_process():
            batch: list[Vulnerability] = []

            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            for result in data.get("Results", []):
                for vuln in result.get("Vulnerabilities", []):
                    v = self._parse_vulnerability(vuln)
                    batch.append(v)

                    summary.vulnerability_count += 1
                    sev = v.severity or "UNKNOWN"
                    summary.severity_summary[sev] = (
                        summary.severity_summary.get(sev, 0) + 1
                    )

                    if len(batch) >= self.batch_size:
                        if on_batch:
                            on_batch(batch)
                        batch = []

            if batch and on_batch:
                on_batch(batch)

            del data

        await loop.run_in_executor(None, parse_and_process)

    @staticmethod
    def _parse_vulnerability(vuln: dict[str, Any]) -> Vulnerability:
        references = vuln.get("References", []) or []
        primary_url = vuln.get("PrimaryURL", "")
        if primary_url and primary_url not in references:
            references.insert(0, primary_url)

        return Vulnerability(
            cve_id=vuln.get("VulnerabilityID", ""),
            pkg_name=vuln.get("PkgName", ""),
            installed_version=vuln.get("InstalledVersion", ""),
            fixed_version=vuln.get("FixedVersion", ""),
            severity=vuln.get("Severity", "UNKNOWN") or "UNKNOWN",
            title=vuln.get("Title", "") or "",
            description=vuln.get("Description", "") or "",
            primary_url=primary_url,
            references=references,
        )

    async def update_db(self) -> bool:
        cmd = [self.binary, "image", "--download-db-only"]
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await asyncio.wait_for(proc.communicate(), timeout=300)
            return proc.returncode == 0
        except Exception as e:
            logger.error("Trivy DB update failed: %s", e)
            return False
