import os
import re
from typing import Any

import yaml


_HELM_TEMPLATE_PATTERN = re.compile(r"\{\{.*?\}\}", re.DOTALL)


def _sanitize_helm_template(content: str) -> str:
    def _replace_template(match: re.Match[str]) -> str:
        template_str = match.group(0)
        placeholder = f"__TPL_{abs(hash(template_str))}__"
        return placeholder
    return _HELM_TEMPLATE_PATTERN.sub(_replace_template, content)


def parse_chart_yaml(chart_dir: str) -> dict[str, Any]:
    chart_yaml_path = os.path.join(chart_dir, "Chart.yaml")
    if not os.path.isfile(chart_yaml_path):
        return {}
    try:
        with open(chart_yaml_path, "r", encoding="utf-8") as f:
            content = f.read()
        content = _sanitize_helm_template(content)
        data = yaml.safe_load(content) or {}
    except yaml.YAMLError:
        return {}
    return {
        "name": data.get("name", ""),
        "version": data.get("version", ""),
        "appVersion": data.get("appVersion", ""),
        "description": data.get("description", ""),
        "dependencies": data.get("dependencies", []),
    }


def parse_values_yaml(chart_dir: str) -> dict[str, Any]:
    values_yaml_path = os.path.join(chart_dir, "values.yaml")
    if not os.path.isfile(values_yaml_path):
        return {}
    try:
        with open(values_yaml_path, "r", encoding="utf-8") as f:
            content = f.read()
        content = _sanitize_helm_template(content)
        data = yaml.safe_load(content) or {}
    except yaml.YAMLError:
        return {}
    return data


def _extract_images_from_values(values: Any, prefix: str = "") -> list[dict[str, str]]:
    images: list[dict[str, str]] = []
    if not isinstance(values, dict):
        return images

    repository = values.get("repository") or values.get("image")
    if isinstance(repository, str) and (":" in repository or "/" in repository):
        if repository.startswith("__TPL_"):
            repository = None
        else:
            tag_val = values.get("tag", values.get("version", "latest"))
            if isinstance(tag_val, str) and tag_val.startswith("__TPL_"):
                tag_val = "latest"
            tag = str(tag_val)
            if ":" in repository:
                repo_part, tag_part = repository.rsplit(":", 1)
                images.append({"repository": repo_part, "tag": tag_part})
            else:
                images.append({"repository": repository, "tag": tag})

    for key, val in values.items():
        if repository is None or key not in ("repository", "image", "tag", "version"):
            child_prefix = f"{prefix}.{key}" if prefix else key
            images.extend(_extract_images_from_values(val, child_prefix))

    return images


def _deduplicate_images(images: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    result: list[dict[str, str]] = []
    for img in images:
        key = f"{img['repository']}:{img['tag']}"
        if key not in seen:
            seen.add(key)
            result.append(img)
    return result


def scan_chart(chart_dir: str) -> dict[str, Any]:
    chart_meta = parse_chart_yaml(chart_dir)
    if not chart_meta or not chart_meta.get("name"):
        return {}
    values = parse_values_yaml(chart_dir)
    images = _extract_images_from_values(values)
    images = _deduplicate_images(images)

    dep_images: list[dict[str, Any]] = []
    for dep in chart_meta.get("dependencies", []):
        if isinstance(dep, dict):
            dep_images.append(
                {
                    "name": dep.get("name", ""),
                    "version": dep.get("version", ""),
                    "repository": dep.get("repository", ""),
                }
            )

    return {
        "chart": {
            "name": chart_meta["name"],
            "version": chart_meta["version"],
            "appVersion": chart_meta.get("appVersion", ""),
            "description": chart_meta.get("description", ""),
        },
        "images": images,
        "dependencies": dep_images,
        "path": os.path.abspath(chart_dir),
    }


def scan_directory(root_dir: str) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for dirpath, dirnames, filenames in os.walk(root_dir):
        if "Chart.yaml" in filenames:
            report = scan_chart(dirpath)
            if report:
                results.append(report)
            dirnames.clear()
    return results
