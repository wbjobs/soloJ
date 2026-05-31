import json
import subprocess
from typing import Any


def trivy_available() -> bool:
    try:
        result = subprocess.run(
            ["trivy", "--version"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def scan_image_vulnerabilities(image_ref: str) -> dict[str, Any]:
    if not trivy_available():
        return {"error": "Trivy CLI not available", "vulnerabilities": [], "severity_counts": {}}

    try:
        result = subprocess.run(
            [
                "trivy",
                "image",
                "--scanners",
                "vuln",
                "--format",
                "json",
                "--quiet",
                image_ref,
            ],
            capture_output=True,
            text=True,
            timeout=300,
        )

        if result.returncode != 0:
            return {
                "error": f"Trivy scan failed: {result.stderr}",
                "vulnerabilities": [],
                "severity_counts": {},
            }

        data = json.loads(result.stdout)
        vulnerabilities: list[dict[str, Any]] = []
        severity_counts: dict[str, int] = {
            "CRITICAL": 0,
            "HIGH": 0,
            "MEDIUM": 0,
            "LOW": 0,
            "UNKNOWN": 0,
        }

        for result_entry in data.get("Results", []):
            for vuln in result_entry.get("Vulnerabilities", []):
                severity = vuln.get("Severity", "UNKNOWN").upper()
                vulnerabilities.append(
                    {
                        "vulnerability_id": vuln.get("VulnerabilityID", ""),
                        "severity": severity,
                        "package_name": vuln.get("PkgName", ""),
                        "installed_version": vuln.get("InstalledVersion", ""),
                        "fixed_version": vuln.get("FixedVersion", ""),
                        "title": vuln.get("Title", ""),
                        "description": vuln.get("Description", "")[:200],
                    }
                )
                if severity in severity_counts:
                    severity_counts[severity] += 1
                else:
                    severity_counts[severity] = severity_counts.get(severity, 0) + 1

        highest_severity = "NONE"
        for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]:
            if severity_counts.get(sev, 0) > 0:
                highest_severity = sev
                break

        return {
            "error": None,
            "vulnerabilities": vulnerabilities,
            "severity_counts": severity_counts,
            "highest_severity": highest_severity,
            "total_vulnerabilities": len(vulnerabilities),
        }

    except subprocess.TimeoutExpired:
        return {"error": "Trivy scan timed out", "vulnerabilities": [], "severity_counts": {}}
    except json.JSONDecodeError:
        return {"error": "Failed to parse Trivy output", "vulnerabilities": [], "severity_counts": {}}
    except Exception as e:
        return {"error": str(e), "vulnerabilities": [], "severity_counts": {}}
