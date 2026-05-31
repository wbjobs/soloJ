from typing import List, Dict, Optional, Any, Set, Tuple
from dataclasses import dataclass, asdict
import uuid
from collections import deque

from ..models.data_quality_models import (
    AnomalyPropagationResult,
    PropagationNode,
    PropagationType,
    ColumnQualityMetrics,
)
from ..graph_db import Neo4jAdapter
from ..models.lineage_models import TransformationType


class AnomalyPropagationService:
    def __init__(self, neo4j_adapter: Neo4jAdapter):
        self.neo4j = neo4j_adapter

    def _map_transformation_type(self, trans_type: str) -> PropagationType:
        type_map = {
            'select': PropagationType.DIRECT,
            'join': PropagationType.JOIN,
            'aggregate': PropagationType.AGGREGATE,
            'filter': PropagationType.FILTER,
            'project': PropagationType.TRANSFORM,
        }
        return type_map.get(trans_type, PropagationType.TRANSFORM)

    def _calculate_propagation_factor(
        self,
        propagation_type: PropagationType,
        input_columns_count: int = 1,
    ) -> float:
        factors = {
            PropagationType.DIRECT: 1.0,
            PropagationType.TRANSFORM: 0.9,
            PropagationType.JOIN: 0.7,
            PropagationType.AGGREGATE: 0.5,
            PropagationType.FILTER: 0.3,
        }

        base_factor = factors.get(propagation_type, 0.5)
        if input_columns_count > 1:
            base_factor = base_factor * (1.0 / input_columns_count) * 1.5

        return min(1.0, base_factor)

    def _propagate_null_rate(
        self,
        source_null_rate: float,
        propagation_type: PropagationType,
        input_columns: List[str],
    ) -> float:
        factor = self._calculate_propagation_factor(propagation_type, len(input_columns))

        if propagation_type == PropagationType.JOIN:
            return source_null_rate * 0.8
        elif propagation_type == PropagationType.AGGREGATE:
            return source_null_rate * 0.3
        elif propagation_type == PropagationType.FILTER:
            return min(1.0, source_null_rate * 1.5)
        elif len(input_columns) > 1:
            return 1.0 - (1.0 - source_null_rate) ** (1.0 / len(input_columns))
        else:
            return source_null_rate * factor

    def _propagate_outlier_rate(
        self,
        source_outlier_rate: float,
        propagation_type: PropagationType,
        input_columns_count: int,
    ) -> float:
        factor = self._calculate_propagation_factor(propagation_type, input_columns_count)

        if propagation_type == PropagationType.AGGREGATE:
            return source_outlier_rate * 0.2
        elif propagation_type == PropagationType.JOIN:
            return source_outlier_rate * 0.6
        else:
            return source_outlier_rate * factor

    def analyze_propagation(
        self,
        table_name: str,
        column_name: str,
        source_anomaly_rate: Optional[float] = None,
        anomaly_type: str = "null_rate",
        max_depth: int = 10,
    ) -> AnomalyPropagationResult:
        lineage_data = self.neo4j.get_column_lineage(
            table_name, column_name, direction="downstream"
        )

        nodes = lineage_data.get("nodes", [])
        edges = lineage_data.get("edges", [])

        if source_anomaly_rate is None:
            source_anomaly_rate = 0.15

        propagation_graph = self._build_propagation_graph(nodes, edges)

        start_node_id = f"{table_name}.{column_name}"

        propagation_results = self._bfs_propagate(
            start_node_id=start_node_id,
            propagation_graph=propagation_graph,
            source_anomaly_rate=source_anomaly_rate,
            max_depth=max_depth,
        )

        affected_columns = []
        affected_tables = set()
        propagation_chain = []
        propagation_path = []

        for node_id, result in propagation_results.items():
            if node_id == start_node_id:
                continue

            t_name, c_name = node_id.split('.', 1) if '.' in node_id else (node_id, '')
            affected_columns.append(node_id)
            affected_tables.add(t_name)

            propagation_chain.append(
                PropagationNode(
                    column_id=node_id,
                    table_name=t_name,
                    column_name=c_name,
                    propagation_type=result['propagation_type'],
                    input_anomaly_rate=result['input_anomaly_rate'],
                    output_anomaly_rate=result['output_anomaly_rate'],
                    confidence=result['confidence'],
                    transformation_logic=result.get('transformation_logic', ''),
                )
            )

            propagation_path.append({
                'from': result['source'],
                'to': node_id,
                'anomaly_rate': result['output_anomaly_rate'],
                'propagation_type': result['propagation_type'].value,
                'confidence': result['confidence'],
            })

        estimated_impact = self._calculate_impact(propagation_results, start_node_id)

        return AnomalyPropagationResult(
            source_column_id=start_node_id,
            source_table=table_name,
            source_column=column_name,
            source_anomaly_rate=source_anomaly_rate,
            propagation_chain=propagation_chain,
            affected_columns=affected_columns,
            affected_tables=list(affected_tables),
            propagation_path=propagation_path,
            estimated_impact=estimated_impact,
        )

    def _build_propagation_graph(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]],
    ) -> Dict[str, List[Dict[str, Any]]]:
        graph: Dict[str, List[Dict[str, Any]]] = {}

        for node in nodes:
            node_id = node.get('id')
            if node_id:
                graph[node_id] = []

        for edge in edges:
            source = edge.get('source')
            target = edge.get('target')
            if source and target and source in graph:
                trans_type = self._map_transformation_type(edge.get('type', 'select'))
                graph[source].append({
                    'target': target,
                    'type': trans_type,
                    'sql': edge.get('sql', ''),
                    'logic': edge.get('logic', ''),
                })

        return graph

    def _bfs_propagate(
        self,
        start_node_id: str,
        propagation_graph: Dict[str, List[Dict[str, Any]]],
        source_anomaly_rate: float,
        max_depth: int,
    ) -> Dict[str, Dict[str, Any]]:
        results = {}
        queue = deque()

        results[start_node_id] = {
            'source': None,
            'input_anomaly_rate': source_anomaly_rate,
            'output_anomaly_rate': source_anomaly_rate,
            'propagation_type': PropagationType.DIRECT,
            'confidence': 1.0,
            'depth': 0,
        }

        queue.append((start_node_id, source_anomaly_rate, 0))

        while queue:
            current_node, current_rate, current_depth = queue.popleft()

            if current_depth >= max_depth:
                continue

            neighbors = propagation_graph.get(current_node, [])
            input_count = len(neighbors)

            for neighbor in neighbors:
                target_node = neighbor['target']
                propagation_type = neighbor['type']

                propagation_factor = self._calculate_propagation_factor(
                    propagation_type, input_count or 1
                )

                output_rate = current_rate * propagation_factor

                confidence = max(0.3, 1.0 - (current_depth * 0.05))

                if target_node not in results or output_rate > results[target_node]['output_anomaly_rate']:
                    results[target_node] = {
                        'source': current_node,
                        'input_anomaly_rate': current_rate,
                        'output_anomaly_rate': output_rate,
                        'propagation_type': propagation_type,
                        'confidence': confidence,
                        'depth': current_depth + 1,
                        'transformation_logic': neighbor.get('logic', ''),
                    }
                    queue.append((target_node, output_rate, current_depth + 1))

        return results

    def _calculate_impact(
        self,
        propagation_results: Dict[str, Dict[str, Any]],
        start_node_id: str,
    ) -> Dict[str, float]:
        total_impact_score = 0.0
        max_anomaly_rate = 0.0
        affected_count = 0

        for node_id, result in propagation_results.items():
            if node_id == start_node_id:
                continue

            affected_count += 1
            anomaly_rate = result['output_anomaly_rate']
            confidence = result['confidence']
            depth = result['depth']

            decay_factor = 1.0 / (depth * 0.5 + 0.5)
            impact = anomaly_rate * confidence * decay_factor
            total_impact_score += impact
            max_anomaly_rate = max(max_anomaly_rate, anomaly_rate)

        return {
            'total_impact_score': total_impact_score,
            'max_anomaly_rate': max_anomaly_rate,
            'affected_columns_count': affected_count,
            'avg_anomaly_rate': total_impact_score / affected_count if affected_count > 0 else 0,
            'risk_level': self._calculate_risk_level(max_anomaly_rate),
        }

    def _calculate_risk_level(self, max_anomaly_rate: float) -> str:
        if max_anomaly_rate >= 0.2:
            return 'CRITICAL'
        elif max_anomaly_rate >= 0.1:
            return 'HIGH'
        elif max_anomaly_rate >= 0.05:
            return 'MEDIUM'
        elif max_anomaly_rate >= 0.01:
            return 'LOW'
        else:
            return 'NONE'

    def batch_propagation_analysis(
        self,
        sources: List[Dict[str, Any]],
        max_depth: int = 10,
    ) -> Dict[str, Any]:
        all_results = []
        combined_impact = {}

        for source in sources:
            result = self.analyze_propagation(
                table_name=source['table_name'],
                column_name=source['column_name'],
                source_anomaly_rate=source.get('anomaly_rate', 0.1),
                anomaly_type=source.get('anomaly_type', 'null_rate'),
                max_depth=max_depth,
            )
            all_results.append(asdict(result))

            for col, rate in self._extract_column_anomalies(result).items():
                if col not in combined_impact or rate > combined_impact[col]:
                    combined_impact[col] = rate

        return {
            'results': all_results,
            'combined_impact': combined_impact,
            'summary': {
                'total_sources': len(sources),
                'unique_affected_columns': len(combined_impact),
                'max_combined_anomaly': max(combined_impact.values()) if combined_impact else 0,
            },
        }

    def _extract_column_anomalies(
        self,
        result: AnomalyPropagationResult,
    ) -> Dict[str, float]:
        anomalies = {result.source_column_id: result.source_anomaly_rate}
        for node in result.propagation_chain:
            anomalies[node.column_id] = node.output_anomaly_rate
        return anomalies

    def visualize_propagation_data(
        self,
        propagation_result: AnomalyPropagationResult,
    ) -> Dict[str, Any]:
        nodes = []
        edges = []

        nodes.append({
            'id': propagation_result.source_column_id,
            'label': f"{propagation_result.source_column}\n({propagation_result.source_anomaly_rate:.1%})",
            'type': 'source',
            'anomaly_rate': propagation_result.source_anomaly_rate,
            'table': propagation_result.source_table,
            'column': propagation_result.source_column,
        })

        for node in propagation_result.propagation_chain:
            nodes.append({
                'id': node.column_id,
                'label': f"{node.column_name}\n({node.output_anomaly_rate:.1%})",
                'type': 'affected',
                'anomaly_rate': node.output_anomaly_rate,
                'table': node.table_name,
                'column': node.column_name,
                'confidence': node.confidence,
            })

        for path in propagation_result.propagation_path:
            edges.append({
                'source': path['from'],
                'target': path['to'],
                'label': f"{path['propagation_type']}",
                'anomaly_rate': path['anomaly_rate'],
                'confidence': path['confidence'],
            })

        return {
            'nodes': nodes,
            'edges': edges,
            'source_column': propagation_result.source_column_id,
        }
