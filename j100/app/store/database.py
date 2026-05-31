from __future__ import annotations

import json
import logging
from typing import Any

import aiosqlite

from app.config import settings

logger = logging.getLogger(__name__)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image TEXT NOT NULL,
    repository TEXT NOT NULL,
    tag TEXT NOT NULL,
    digest TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    severity_summary TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(image, digest)
);

CREATE TABLE IF NOT EXISTS vulnerabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scan_id INTEGER NOT NULL,
    cve_id TEXT NOT NULL,
    pkg_name TEXT NOT NULL DEFAULT '',
    installed_version TEXT NOT NULL DEFAULT '',
    fixed_version TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'UNKNOWN',
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    primary_url TEXT NOT NULL DEFAULT '',
    references_json TEXT NOT NULL DEFAULT '[]',
    FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scans_image ON scans(image);
CREATE INDEX IF NOT EXISTS idx_scans_repository ON scans(repository);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_vulns_scan_id ON vulnerabilities(scan_id);
CREATE INDEX IF NOT EXISTS idx_vulns_cve_id ON vulnerabilities(cve_id);
CREATE INDEX IF NOT EXISTS idx_vulns_severity ON vulnerabilities(severity);
"""


class ScanStore:
    def __init__(self, db_path: str | None = None):
        self.db_path = db_path or settings.database_path
        self._db: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        self._db = await aiosqlite.connect(self.db_path)
        self._db.row_factory = aiosqlite.Row
        await self._db.executescript(_SCHEMA)
        await self._db.commit()
        logger.info("Database initialized at %s", self.db_path)

    async def close(self) -> None:
        if self._db:
            await self._db.close()

    async def _get_db(self) -> aiosqlite.Connection:
        if self._db is None:
            await self.connect()
        assert self._db is not None
        return self._db

    async def create_scan(
        self, image: str, repository: str, tag: str, digest: str = ""
    ) -> int:
        db = await self._get_db()
        cursor = await db.execute(
            "INSERT OR IGNORE INTO scans (image, repository, tag, digest, status) "
            "VALUES (?, ?, ?, ?, 'pending')",
            (image, repository, tag, digest),
        )
        await db.commit()
        if cursor.lastrowid and cursor.lastrowid > 0:
            return cursor.lastrowid

        row = await db.execute(
            "SELECT id FROM scans WHERE image = ? AND digest = ?",
            (image, digest),
        )
        result = await row.fetchone()
        return result["id"] if result else cursor.lastrowid

    async def update_scan_status(
        self, scan_id: int, status: str, summary: dict[str, int] | None = None
    ) -> None:
        db = await self._get_db()
        summary_json = json.dumps(summary) if summary else "{}"
        await db.execute(
            "UPDATE scans SET status = ?, severity_summary = ?, updated_at = CURRENT_TIMESTAMP "
            "WHERE id = ?",
            (status, summary_json, scan_id),
        )
        await db.commit()

    async def save_vulnerabilities(
        self, scan_id: int, vulnerabilities: list[dict[str, Any]]
    ) -> None:
        db = await self._get_db()
        await db.execute("DELETE FROM vulnerabilities WHERE scan_id = ?", (scan_id,))

        rows = []
        for v in vulnerabilities:
            rows.append(
                (
                    scan_id,
                    v.get("cve_id", ""),
                    v.get("pkg_name", ""),
                    v.get("installed_version", ""),
                    v.get("fixed_version", ""),
                    v.get("severity", "UNKNOWN"),
                    v.get("title", ""),
                    v.get("description", ""),
                    v.get("primary_url", ""),
                    json.dumps(v.get("references", [])),
                )
            )

        if rows:
            await db.executemany(
                "INSERT INTO vulnerabilities "
                "(scan_id, cve_id, pkg_name, installed_version, fixed_version, "
                "severity, title, description, primary_url, references_json) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
        await db.commit()

    async def clear_vulnerabilities(self, scan_id: int) -> None:
        db = await self._get_db()
        await db.execute("DELETE FROM vulnerabilities WHERE scan_id = ?", (scan_id,))
        await db.commit()

    async def save_vulnerabilities_batch(
        self, scan_id: int, vulnerabilities: list[dict[str, Any]]
    ) -> None:
        db = await self._get_db()
        rows = []
        for v in vulnerabilities:
            rows.append(
                (
                    scan_id,
                    v.get("cve_id", ""),
                    v.get("pkg_name", ""),
                    v.get("installed_version", ""),
                    v.get("fixed_version", ""),
                    v.get("severity", "UNKNOWN"),
                    v.get("title", ""),
                    v.get("description", ""),
                    v.get("primary_url", ""),
                    json.dumps(v.get("references", [])),
                )
            )

        if rows:
            await db.executemany(
                "INSERT INTO vulnerabilities "
                "(scan_id, cve_id, pkg_name, installed_version, fixed_version, "
                "severity, title, description, primary_url, references_json) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
        await db.commit()

    async def get_scan(self, scan_id: int) -> dict[str, Any] | None:
        db = await self._get_db()
        cursor = await db.execute("SELECT * FROM scans WHERE id = ?", (scan_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def list_scans(
        self,
        repository: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        db = await self._get_db()
        query = "SELECT * FROM scans WHERE 1=1"
        params: list[Any] = []

        if repository:
            query += " AND repository = ?"
            params.append(repository)
        if status:
            query += " AND status = ?"
            params.append(status)

        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

    async def get_vulnerabilities(
        self,
        scan_id: int,
        severity: str | None = None,
    ) -> list[dict[str, Any]]:
        db = await self._get_db()
        query = "SELECT * FROM vulnerabilities WHERE scan_id = ?"
        params: list[Any] = [scan_id]

        if severity:
            query += " AND severity = ?"
            params.append(severity)

        query += " ORDER BY severity, cve_id"
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        results = []
        for r in rows:
            item = dict(r)
            item["references"] = json.loads(item.pop("references_json", "[]"))
            results.append(item)
        return results

    async def get_latest_scan_for_image(
        self, repository: str, tag: str
    ) -> dict[str, Any] | None:
        db = await self._get_db()
        cursor = await db.execute(
            "SELECT * FROM scans WHERE repository = ? AND tag = ? "
            "ORDER BY created_at DESC LIMIT 1",
            (repository, tag),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def get_image_vulnerabilities(
        self,
        repository: str,
        tag: str,
        severity: str | None = None,
    ) -> dict[str, Any] | None:
        scan = await self.get_latest_scan_for_image(repository, tag)
        if not scan:
            return None

        vulns = await self.get_vulnerabilities(scan["id"], severity)
        scan["severity_summary"] = json.loads(scan.get("severity_summary", "{}"))
        return {"scan": scan, "vulnerabilities": vulns}
