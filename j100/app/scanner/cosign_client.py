from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class SignResult:
    image_ref: str
    success: bool
    signed: bool = False
    certificate_url: str = ""
    bundle_path: str = ""
    error: str = ""


class CosignSigner:
    def __init__(
        self,
        binary: str | None = None,
        key_path: str | None = None,
        password: str | None = None,
        fulcio_url: str | None = None,
        rekor_url: str | None = None,
    ):
        self.binary = binary or settings.cosign_binary
        self.key_path = key_path or settings.cosign_key_path
        self.password = password or settings.cosign_password
        self.fulcio_url = fulcio_url or settings.cosign_fulcio_url
        self.rekor_url = rekor_url or settings.cosign_rekor_url
        self.enabled = settings.auto_sign_enabled

    async def sign_image(
        self,
        image_ref: str,
        digest: str = "",
        annotations: dict[str, str] | None = None,
    ) -> SignResult:
        if not self.enabled:
            return SignResult(
                image_ref=image_ref,
                success=True,
                signed=False,
                error="Auto-sign disabled",
            )

        target = f"{image_ref}@{digest}" if digest else image_ref
        logger.info("Starting Cosign signing for %s", target)

        cmd = self._build_sign_command(target, annotations)

        try:
            env = os.environ.copy()
            if self.password:
                env["COSIGN_PASSWORD"] = self.password

            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=120,
                )
            except asyncio.TimeoutError:
                proc.kill()
                logger.error("Cosign sign timed out for %s", target)
                return SignResult(
                    image_ref=image_ref,
                    success=False,
                    error="Signing timed out",
                )

            if proc.returncode != 0:
                err_msg = stderr.decode(errors="replace")[:2000]
                logger.error(
                    "Cosign sign failed (exit %d) for %s: %s",
                    proc.returncode,
                    target,
                    err_msg,
                )
                return SignResult(
                    image_ref=image_ref,
                    success=False,
                    error=err_msg,
                )

            logger.info("Successfully signed %s", target)
            return SignResult(
                image_ref=image_ref,
                success=True,
                signed=True,
            )

        except FileNotFoundError:
            logger.error("Cosign binary not found at: %s", self.binary)
            return SignResult(
                image_ref=image_ref,
                success=False,
                error=f"Cosign binary not found at {self.binary}",
            )
        except Exception as e:
            logger.error("Cosign sign error for %s: %s", target, e)
            return SignResult(
                image_ref=image_ref,
                success=False,
                error=str(e),
            )

    def _build_sign_command(
        self,
        target: str,
        annotations: dict[str, str] | None = None,
    ) -> list[str]:
        cmd = [self.binary, "sign", "--yes"]

        if self.key_path:
            cmd.extend(["--key", self.key_path])
        else:
            cmd.append("--keyless")

        if self.fulcio_url:
            cmd.extend(["--fulcio-url", self.fulcio_url])
        if self.rekor_url:
            cmd.extend(["--rekor-url", self.rekor_url])

        if annotations:
            for k, v in annotations.items():
                cmd.extend(["--annotations", f"{k}={v}"])

        cmd.append(target)
        return cmd

    async def verify_image(
        self,
        image_ref: str,
        digest: str = "",
        cert_identity: str | None = None,
        cert_oidc_issuer: str | None = None,
    ) -> bool:
        target = f"{image_ref}@{digest}" if digest else image_ref

        cmd = [self.binary, "verify", "--yes"]

        if self.key_path:
            cmd.extend(["--key", self.key_path])
        else:
            cmd.append("--keyless")
            if cert_identity:
                cmd.extend(["--certificate-identity", cert_identity])
            if cert_oidc_issuer:
                cmd.extend(["--certificate-oidc-issuer", cert_oidc_issuer])

        if self.rekor_url:
            cmd.extend(["--rekor-url", self.rekor_url])

        cmd.append(target)

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await asyncio.wait_for(proc.communicate(), timeout=60)
            return proc.returncode == 0
        except Exception as e:
            logger.error("Cosign verify error for %s: %s", target, e)
            return False
