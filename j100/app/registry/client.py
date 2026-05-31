from __future__ import annotations

import base64
import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class Layer:
    digest: str
    media_type: str
    size: int


@dataclass
class ImageManifest:
    schema_version: int
    media_type: str
    config_digest: str
    config_size: int
    layers: list[Layer] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict)


class RegistryClient:
    def __init__(
        self,
        registry_url: str | None = None,
        username: str | None = None,
        password: str | None = None,
    ):
        self.registry_url = (registry_url or settings.registry_url).rstrip("/")
        self.username = username or settings.registry_username
        self.password = password or settings.registry_password
        self._token_cache: dict[str, str] = {}
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    def _basic_auth_header(self) -> dict[str, str]:
        if not self.username or not self.password:
            return {}
        token = base64.b64encode(f"{self.username}:{self.password}".encode()).decode()
        return {"Authorization": f"Basic {token}"}

    async def _get_auth_token(self, scope: str) -> str | None:
        client = await self._get_client()
        try:
            resp = await client.get(
                f"{self.registry_url}/v2/",
                headers=self._basic_auth_header(),
            )
            if resp.status_code == 401:
                auth_header = resp.headers.get("www-authenticate", "")
                if "Bearer" not in auth_header:
                    return None
                params = self._parse_www_authenticate(auth_header)
                realm = params.get("realm", "")
                service = params.get("service", "")
                token_resp = await client.get(
                    realm,
                    params={
                        "service": service,
                        "scope": scope,
                        "grant_type": "password",
                    },
                    auth=(self.username, self.password) if self.username else None,
                )
                if token_resp.status_code == 200:
                    return token_resp.json().get("token")
            elif resp.status_code == 200:
                return None
        except Exception as e:
            logger.error("Failed to get auth token: %s", e)
        return None

    @staticmethod
    def _parse_www_authenticate(header: str) -> dict[str, str]:
        result: dict[str, str] = {}
        parts = header.replace("Bearer ", "").split(",")
        for part in parts:
            kv = part.strip().split("=", 1)
            if len(kv) == 2:
                result[kv[0]] = kv[1].strip('"')
        return result

    async def _request(
        self, method: str, path: str, scope: str | None = None, **kwargs: Any
    ) -> httpx.Response:
        client = await self._get_client()
        url = f"{self.registry_url}/v2{path}"

        headers = dict(kwargs.pop("headers", {}))

        basic = self._basic_auth_header()
        if basic:
            headers.update(basic)

        if scope:
            token = await self._get_auth_token(scope)
            if token:
                headers["Authorization"] = f"Bearer {token}"

        resp = await client.request(method, url, headers=headers, **kwargs)
        resp.raise_for_status()
        return resp

    async def get_manifest(self, repository: str, reference: str = "latest") -> ImageManifest:
        scope = f"repository:{repository}:pull"
        resp = await self._request(
            "GET",
            f"/{repository}/manifests/{reference}",
            scope=scope,
            headers={
                "Accept": "application/vnd.docker.distribution.manifest.v2+json,"
                "application/vnd.docker.distribution.manifest.list.v2+json,"
                "application/vnd.oci.image.manifest.v1+json,"
                "application/vnd.oci.image.index.v1+json",
            },
        )
        data = resp.json()
        return self._parse_manifest(data)

    async def get_manifest_list(
        self, repository: str, reference: str = "latest"
    ) -> list[ImageManifest]:
        scope = f"repository:{repository}:pull"
        resp = await self._request(
            "GET",
            f"/{repository}/manifests/{reference}",
            scope=scope,
            headers={
                "Accept": "application/vnd.docker.distribution.manifest.list.v2+json,"
                "application/vnd.oci.image.index.v1+json",
            },
        )
        data = resp.json()
        if data.get("mediaType") in (
            "application/vnd.docker.distribution.manifest.list.v2+json",
            "application/vnd.oci.image.index.v1+json",
        ):
            manifests = []
            for m in data.get("manifests", []):
                digest = m.get("digest", "")
                manifests.append(await self.get_manifest(repository, digest))
            return manifests
        return [self._parse_manifest(data)]

    @staticmethod
    def _parse_manifest(data: dict[str, Any]) -> ImageManifest:
        layers = []
        for layer_data in data.get("layers", []):
            layers.append(
                Layer(
                    digest=layer_data["digest"],
                    media_type=layer_data.get("mediaType", ""),
                    size=layer_data.get("size", 0),
                )
            )

        config = data.get("config", {})
        return ImageManifest(
            schema_version=data.get("schemaVersion", 2),
            media_type=data.get("mediaType", ""),
            config_digest=config.get("digest", ""),
            config_size=config.get("size", 0),
            layers=layers,
            raw=data,
        )

    async def get_tags(self, repository: str) -> list[str]:
        scope = f"repository:{repository}:pull"
        resp = await self._request("GET", f"/{repository}/tags/list", scope=scope)
        data = resp.json()
        return data.get("tags", [])

    async def get_blob(self, repository: str, digest: str) -> bytes:
        scope = f"repository:{repository}:pull"
        resp = await self._request(
            "GET", f"/{repository}/blobs/{digest}", scope=scope
        )
        return resp.content

    def image_ref(self, repository: str, reference: str = "latest") -> str:
        host = self.registry_url.replace("http://", "").replace("https://", "")
        return f"{host}/{repository}:{reference}"
