from typing import List, Dict, Any, Set
from dataclasses import asdict

from ..graph_db import Neo4jAdapter
from ..models.lineage_models import ImpactAnalysisResult


class ImpactAnalyzer:
    def __init__(self, neo4j_adapter: Neo4jAdapter):
        self.neo4j = neo4j_adapter

    def analyze_column_impact(
        self, table_name: str, column_name: str
    ) -> ImpactAnalysisResult:
        base_result = self.neo4j.analyze_impact(table_name, column_name)

        impact_path = self._build_impact_path(table_name, column_name)

        return ImpactAnalysisResult(
            affected_columns=self._deduplicate_columns(base_result.affected_columns, table_name, column_name),
            affected_tables=self._deduplicate_tables(base_result.affected_tables, table_name),
            affected_jobs=base_result.affected_jobs,
            impact_path=impact_path,
        )

    def _deduplicate_columns(
        self, columns: List[str], table_name: str, column_name: str
    ) -> List[str]:
        source_col = f"{table_name}.{column_name}"
        return [col for col in columns if col != source_col]

    def _deduplicate_tables(self, tables: List[str], table_name: str) -> List[str]:
        return [t for t in tables if t != table_name]

    def _build_impact_path(self, table_name: str, column_name: str) -> List[Dict[str, Any]]:
        downstream_result = self.neo4j.get_column_lineage(
            table_name, column_name, direction="downstream"
        )

        paths = []
        visited = set()
        start_id = f"{table_name}.{column_name}"

        edges = downstream_result.get("edges", [])
        nodes = downstream_result.get("nodes", [])

        node_map = {node["id"]: node for node in nodes}

        self._dfs_build_paths(
            start_id, edges, node_map, visited, [], paths
        )

        return paths

    def _dfs_build_paths(
        self,
        current_id: str,
        edges: List[Dict[str, Any]],
        node_map: Dict[str, Any],
        visited: Set[str],
        current_path: List[Dict[str, Any]],
        all_paths: List[Dict[str, Any]],
    ) -> None:
        if current_id in visited:
            return

        visited.add(current_id)

        current_node = node_map.get(current_id, {"id": current_id})
        current_path.append(
            {
                "column": current_id,
                "table": current_node.get("table", ""),
                "column_name": current_node.get("column", ""),
            }
        )

        outgoing_edges = [e for e in edges if e["source"] == current_id]

        if not outgoing_edges:
            if len(current_path) > 1:
                all_paths.append(
                    {
                        "path": list(current_path),
                        "length": len(current_path) - 1,
                        "transformations": self._extract_transformations(current_path, edges),
                    }
                )
        else:
            for edge in outgoing_edges:
                self._dfs_build_paths(
                    edge["target"], edges, node_map, visited, current_path, all_paths
                )

        current_path.pop()
        visited.remove(current_id)

    def _extract_transformations(
        self, path: List[Dict[str, Any]], edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        transformations = []
        for i in range(len(path) - 1):
            source = path[i]["column"]
            target = path[i + 1]["column"]

            edge = next(
                (e for e in edges if e["source"] == source and e["target"] == target),
                None,
            )

            if edge:
                transformations.append(
                    {
                        "type": edge.get("type", ""),
                        "sql": edge.get("sql", ""),
                        "logic": edge.get("logic", ""),
                    }
                )

        return transformations

    def analyze_table_impact(self, table_name: str) -> Dict[str, Any]:
        columns = self.neo4j.get_table_columns(table_name)
        all_affected_columns: Set[str] = set()
        all_affected_tables: Set[str] = set()
        all_affected_jobs: Set[str] = set()

        column_impacts = {}
        for col in columns:
            impact = self.analyze_column_impact(table_name, col)
            column_impacts[col] = asdict(impact)
            all_affected_columns.update(impact.affected_columns)
            all_affected_tables.update(impact.affected_tables)
            all_affected_jobs.update(impact.affected_jobs)

        return {
            "source_table": table_name,
            "column_count": len(columns),
            "column_impacts": column_impacts,
            "summary": {
                "total_affected_columns": len(all_affected_columns),
                "total_affected_tables": len(all_affected_tables),
                "total_affected_jobs": len(all_affected_jobs),
                "affected_columns": list(all_affected_columns),
                "affected_tables": list(all_affected_tables),
                "affected_jobs": list(all_affected_jobs),
            },
        }

    def get_impact_summary(
        self, table_name: str, column_name: str
    ) -> Dict[str, Any]:
        impact = self.analyze_column_impact(table_name, column_name)

        tables_by_count = {}
        for col in impact.affected_columns:
            t = col.split(".")[0]
            tables_by_count[t] = tables_by_count.get(t, 0) + 1

        return {
            "source": f"{table_name}.{column_name}",
            "affected_columns_count": len(impact.affected_columns),
            "affected_tables_count": len(impact.affected_tables),
            "affected_jobs_count": len(impact.affected_jobs),
            "impact_chain_length": max(
                [p.get("length", 0) for p in impact.impact_path], default=0
            ),
            "affected_tables_distribution": tables_by_count,
        }

    def compare_impact(
        self,
        changes: List[Dict[str, str]],
    ) -> Dict[str, Any]:
        all_affected = set()
        all_tables = set()
        all_jobs = set()

        details = []
        for change in changes:
            table = change.get("table")
            column = change.get("column")
            if table and column:
                impact = self.analyze_column_impact(table, column)
                all_affected.update(impact.affected_columns)
                all_tables.update(impact.affected_tables)
                all_jobs.update(impact.affected_jobs)
                details.append(
                    {
                        "change": f"{table}.{column}",
                        "impact": asdict(impact),
                    }
                )

        return {
            "changes_count": len(changes),
            "total_affected_columns": len(all_affected),
            "total_affected_tables": len(all_tables),
            "total_affected_jobs": len(all_jobs),
            "details": details,
            "combined_impact": {
                "columns": list(all_affected),
                "tables": list(all_tables),
                "jobs": list(all_jobs),
            },
        }
