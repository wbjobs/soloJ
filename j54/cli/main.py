import json
import sys

import click
import requests

from scanner.chart_parser import scan_chart, scan_directory
from scanner.trivy_scanner import scan_image_vulnerabilities, trivy_available


def _add_vulnerability_scan(report: dict) -> dict:
    if not report or "images" not in report:
        return report

    images_with_vulns: list[dict] = []
    for img in report["images"]:
        image_ref = f"{img['repository']}:{img['tag']}"
        click.echo(f"  Scanning vulnerabilities for: {image_ref}")
        vuln_data = scan_image_vulnerabilities(image_ref)
        img_with_vuln = dict(img)
        img_with_vuln["vulnerabilities"] = vuln_data
        images_with_vulns.append(img_with_vuln)

    report["images"] = images_with_vulns
    return report


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """Helm Chart Dependency Scanner - scan local Helm Charts and audit image dependencies."""
    pass


@cli.command()
@click.argument("chart_path", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), default=None, help="Output JSON report to file.")
@click.option("--server", "-s", default="http://localhost:5000", help="Flask audit server URL.")
@click.option("--send", is_flag=True, default=False, help="Send report to Flask audit server.")
@click.option("--trivy", is_flag=True, default=False, help="Scan images for vulnerabilities using Trivy.")
def scan(chart_path: str, output: str, server: str, send: bool, trivy: bool):
    """Scan a single Helm Chart directory and generate a dependency report."""
    report = scan_chart(chart_path)
    if not report:
        click.echo(f"No valid Helm Chart found at: {chart_path}", err=True)
        sys.exit(1)

    if trivy:
        if not trivy_available():
            click.echo("Warning: Trivy CLI not found, skipping vulnerability scan.", err=True)
        else:
            click.echo(f"Scanning {len(report['images'])} image(s) with Trivy...")
            report = _add_vulnerability_scan(report)

    report_json = json.dumps(report, indent=2, ensure_ascii=False)

    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(report_json)
        click.echo(f"Report saved to: {output}")

    click.echo(report_json)

    if send:
        _send_report(server, report)


@cli.command()
@click.argument("root_dir", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), default=None, help="Output JSON report to file.")
@click.option("--server", "-s", default="http://localhost:5000", help="Flask audit server URL.")
@click.option("--send", is_flag=True, default=False, help="Send report to Flask audit server.")
@click.option("--trivy", is_flag=True, default=False, help="Scan images for vulnerabilities using Trivy.")
def scan_dir(root_dir: str, output: str, server: str, send: bool, trivy: bool):
    """Recursively scan a directory for Helm Charts and generate reports."""
    reports = scan_directory(root_dir)
    if not reports:
        click.echo(f"No Helm Charts found in: {root_dir}", err=True)
        sys.exit(1)

    if trivy:
        if not trivy_available():
            click.echo("Warning: Trivy CLI not found, skipping vulnerability scan.", err=True)
        else:
            click.echo(f"Found {len(reports)} chart(s), scanning vulnerabilities...")
            for idx, report in enumerate(reports, 1):
                click.echo(f"[{idx}/{len(reports)}] {report['chart']['name']}")
                reports[idx - 1] = _add_vulnerability_scan(report)

    report_json = json.dumps(reports, indent=2, ensure_ascii=False)

    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(report_json)
        click.echo(f"Report saved to: {output}")

    click.echo(f"Found {len(reports)} Helm Chart(s)")
    click.echo(report_json)

    if send:
        for report in reports:
            _send_report(server, report)


def _send_report(server: str, report: dict):
    url = f"{server.rstrip('/')}/api/reports"
    try:
        resp = requests.post(url, json=report, timeout=30)
        if resp.status_code == 201:
            click.echo(f"Report sent successfully: {report['chart']['name']}")
        else:
            click.echo(f"Failed to send report: {resp.status_code} - {resp.text}", err=True)
    except requests.RequestException as e:
        click.echo(f"Error sending report: {e}", err=True)


if __name__ == "__main__":
    cli()
