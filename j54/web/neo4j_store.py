import json
from typing import Any

from neo4j import GraphDatabase

from config import NEO4J_PASSWORD, NEO4J_URI, NEO4J_USER


class Neo4jStore:
    def __init__(self, uri: str | None = None, user: str | None = None, password: str | None = None):
        self._driver = GraphDatabase.driver(
            uri or NEO4J_URI,
            auth=(user or NEO4J_USER, password or NEO4J_PASSWORD),
        )

    def close(self):
        self._driver.close()

    def _run(self, query: str, params: dict[str, Any] | None = None):
        with self._driver.session() as session:
            result = session.run(query, params or {})
            return [record.data() for record in result]

    def ensure_constraints(self):
        self._run("CREATE CONSTRAINT chart_name IF NOT EXISTS FOR (c:Chart) REQUIRE c.name IS UNIQUE")
        self._run("CREATE CONSTRAINT image_id IF NOT EXISTS FOR (i:Image) REQUIRE i.image_id IS UNIQUE")
        self._run("CREATE CONSTRAINT dep_name IF NOT EXISTS FOR (d:Dependency) REQUIRE d.name IS UNIQUE")

    def store_report(self, report: dict[str, Any]):
        chart = report["chart"]
        images = report.get("images", [])
        dependencies = report.get("dependencies", [])

        self._run(
            """
            MERGE (c:Chart {name: $name})
            SET c.version = $version,
                c.appVersion = $appVersion,
                c.description = $description
            """,
            {
                "name": chart["name"],
                "version": chart["version"],
                "appVersion": chart.get("appVersion", ""),
                "description": chart.get("description", ""),
            },
        )

        for img in images:
            image_id = f"{img['repository']}:{img['tag']}"
            vuln_data = img.get("vulnerabilities", {})
            highest_severity = vuln_data.get("highest_severity", "NONE") if isinstance(vuln_data, dict) else "NONE"
            severity_counts = vuln_data.get("severity_counts", {}) if isinstance(vuln_data, dict) else {}
            total_vulns = vuln_data.get("total_vulnerabilities", 0) if isinstance(vuln_data, dict) else 0
            cve_list = vuln_data.get("vulnerabilities", []) if isinstance(vuln_data, dict) else []
            cve_json = json.dumps(cve_list[:10]) if cve_list else "[]"
            sev_counts_json = json.dumps(severity_counts)

            self._run(
                """
                MERGE (i:Image {image_id: $image_id})
                SET i.repository = $repository,
                    i.tag = $tag,
                    i.highest_severity = $highest_severity,
                    i.severity_counts = $severity_counts,
                    i.total_vulnerabilities = $total_vulnerabilities,
                    i.cve_list = $cve_list
                MERGE (c:Chart {name: $chart_name})
                MERGE (c)-[:USES_IMAGE]->(i)
                """,
                {
                    "image_id": image_id,
                    "repository": img["repository"],
                    "tag": img["tag"],
                    "highest_severity": highest_severity,
                    "severity_counts": sev_counts_json,
                    "total_vulnerabilities": total_vulns,
                    "cve_list": cve_json,
                    "chart_name": chart["name"],
                },
            )

        for dep in dependencies:
            self._run(
                """
                MERGE (d:Dependency {name: $name})
                SET d.version = $version, d.repository = $repository
                MERGE (c:Chart {name: $chart_name})
                MERGE (c)-[:DEPENDS_ON]->(d)
                """,
                {
                    "name": dep["name"],
                    "version": dep.get("version", ""),
                    "repository": dep.get("repository", ""),
                    "chart_name": chart["name"],
                },
            )

    def get_topology(self) -> dict[str, list[dict[str, Any]]]:
        nodes_result = self._run(
            """
            MATCH (n)
            RETURN labels(n)[0] AS label, properties(n) AS props
            """
        )
        edges_result = self._run(
            """
            MATCH (a)-[r]->(b)
            RETURN labels(a)[0] AS source_label,
                   properties(a) AS source_props,
                   type(r) AS rel_type,
                   labels(b)[0] AS target_label,
                   properties(b) AS target_props
            """
        )

        node_map: dict[str, str] = {}
        nodes: list[dict[str, Any]] = []

        for rec in nodes_result:
            label = rec["label"]
            props = rec["props"]
            node_id = self._make_node_id(label, props)
            if node_id not in node_map:
                node_map[node_id] = node_id
                nodes.append(
                    {
                        "id": node_id,
                        "label": label,
                        "name": props.get("name") or props.get("image_id") or node_id,
                        "properties": props,
                    }
                )

        links: list[dict[str, Any]] = []
        for rec in edges_result:
            src_id = self._make_node_id(rec["source_label"], rec["source_props"])
            tgt_id = self._make_node_id(rec["target_label"], rec["target_props"])
            links.append(
                {
                    "source": src_id,
                    "target": tgt_id,
                    "type": rec["rel_type"],
                }
            )

        return {"nodes": nodes, "links": links}

    @staticmethod
    def _make_node_id(label: str, props: dict[str, Any]) -> str:
        if label == "Chart":
            return f"chart_{props.get('name', 'unknown')}"
        if label == "Image":
            return f"image_{props.get('image_id', 'unknown')}"
        if label == "Dependency":
            return f"dep_{props.get('name', 'unknown')}"
        return f"{label}_{props.get('name', props.get('image_id', 'unknown'))}"
