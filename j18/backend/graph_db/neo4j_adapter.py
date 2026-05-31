from typing import List, Dict, Optional, Any
from dataclasses import asdict

try:
    from neo4j import GraphDatabase, Driver, Result
except ImportError:
    GraphDatabase = None
    Driver = None

from ..models.lineage_models import (
    ParsedLineageResult,
    FieldMapping,
    JobExecutionContext,
    ImpactAnalysisResult,
    LineageGraph,
    ColumnNode,
    TableNode,
    LineageEdge,
    TransformationType,
)


class Neo4jAdapter:
    def __init__(self, uri: str, user: str, password: str):
        self.uri = uri
        self.user = user
        self.password = password
        self._driver: Optional[Driver] = None
        self._connect()

    def _connect(self) -> None:
        if GraphDatabase is None:
            raise ImportError("neo4j driver is not installed. Install with: pip install neo4j")
        self._driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))

    def close(self) -> None:
        if self._driver:
            self._driver.close()

    def store_lineage(self, lineage_result: ParsedLineageResult, job_id: str) -> None:
        if not self._driver:
            return

        with self._driver.session() as session:
            session.execute_write(self._create_table_nodes, lineage_result.source_tables)
            session.execute_write(self._create_table_node, lineage_result.target_table)

            for mapping in lineage_result.field_mappings:
                session.execute_write(self._create_field_lineage_edge, mapping, job_id)

            session.execute_write(self._link_job_to_tables, job_id, lineage_result)

    @staticmethod
    def _create_table_nodes(tx, tables: List[str]) -> None:
        for table in tables:
            Neo4jAdapter._create_table_node(tx, table)

    @staticmethod
    def _create_table_node(tx, table_name: str) -> None:
        db, schema, tbl = Neo4jAdapter._parse_table_name(table_name)
        query = """
        MERGE (t:Table {name: $table_name})
        SET t.database = $database,
            t.schema = $schema,
            t.updated_at = datetime()
        """
        tx.run(query, table_name=table_name, database=db, schema=schema)

    @staticmethod
    def _parse_table_name(table_name: str) -> tuple:
        parts = table_name.split(".")
        if len(parts) == 3:
            return parts[0], parts[1], parts[2]
        elif len(parts) == 2:
            return None, parts[0], parts[1]
        else:
            return None, None, parts[0]

    @staticmethod
    def _create_field_lineage_edge(tx, mapping: FieldMapping, job_id: str) -> None:
        source_col_id = f"{mapping.source_table}.{mapping.source_column}"
        target_col_id = f"{mapping.target_table}.{mapping.target_column}"

        query = """
        MERGE (sc:Column {id: $source_col_id})
        SET sc.table_name = $source_table,
            sc.column_name = $source_column

        MERGE (tc:Column {id: $target_col_id})
        SET tc.table_name = $target_table,
            tc.column_name = $target_column

        MERGE (sc)-[r:TRANSFORMS_TO {
            transformation_type: $trans_type,
            transformation_logic: $trans_logic,
            sql_snippet: $sql_snippet,
            job_id: $job_id
        }]->(tc)
        SET r.updated_at = datetime()
        """
        tx.run(
            query,
            source_col_id=source_col_id,
            source_table=mapping.source_table,
            source_column=mapping.source_column,
            target_col_id=target_col_id,
            target_table=mapping.target_table,
            target_column=mapping.target_column,
            trans_type=mapping.transformation_type.value if hasattr(mapping.transformation_type, 'value') else str(mapping.transformation_type),
            trans_logic=mapping.transformation_logic,
            sql_snippet=mapping.sql_snippet,
            job_id=job_id,
        )

    @staticmethod
    def _link_job_to_tables(tx, job_id: str, lineage_result: ParsedLineageResult) -> None:
        query = """
        MERGE (j:Job {job_id: $job_id})
        SET j.updated_at = datetime()
        """
        tx.run(query, job_id=job_id)

        for source_table in lineage_result.source_tables:
            query = """
            MATCH (j:Job {job_id: $job_id})
            MATCH (t:Table {name: $table_name})
            MERGE (j)-[r:READS_FROM]->(t)
            SET r.updated_at = datetime()
            """
            tx.run(query, job_id=job_id, table_name=source_table)

        query = """
        MATCH (j:Job {job_id: $job_id})
        MATCH (t:Table {name: $table_name})
        MERGE (j)-[r:WRITES_TO]->(t)
        SET r.updated_at = datetime()
        """
        tx.run(query, job_id=job_id, table_name=lineage_result.target_table)

    def store_job_metadata(self, context: JobExecutionContext) -> None:
        if not self._driver:
            return

        with self._driver.session() as session:
            session.execute_write(self._store_job_metadata, context)

    @staticmethod
    def _store_job_metadata(tx, context: JobExecutionContext) -> None:
        query = """
        MERGE (j:Job {job_id: $job_id})
        SET j.job_name = $job_name,
            j.start_time = $start_time,
            j.end_time = $end_time,
            j.status = $status,
            j.sql_count = $sql_count,
            j.updated_at = datetime()
        """
        tx.run(
            query,
            job_id=context.job_id,
            job_name=context.job_name,
            start_time=context.start_time,
            end_time=context.end_time,
            status=context.status,
            sql_count=len(context.sql_statements),
        )

    def get_column_lineage(self, table_name: str, column_name: str, direction: str = "downstream") -> Dict[str, Any]:
        if not self._driver:
            return {"nodes": [], "edges": []}

        column_id = f"{table_name}.{column_name}"

        with self._driver.session() as session:
            if direction == "downstream":
                result = session.execute_read(self._get_downstream_lineage, column_id)
            elif direction == "upstream":
                result = session.execute_read(self._get_upstream_lineage, column_id)
            else:
                result = {"nodes": [], "edges": []}

        return result

    @staticmethod
    def _get_downstream_lineage(tx, column_id: str) -> Dict[str, Any]:
        query = """
        MATCH path = (start:Column {id: $column_id})-[*1..10]->(end:Column)
        UNWIND nodes(path) AS n
        UNWIND relationships(path) AS r
        RETURN
            COLLECT(DISTINCT {
                id: n.id,
                type: 'column',
                table: n.table_name,
                column: n.column_name
            }) AS nodes,
            COLLECT(DISTINCT {
                source: startNode(r).id,
                target: endNode(r).id,
                type: r.transformation_type,
                sql: r.sql_snippet,
                logic: r.transformation_logic
            }) AS edges
        """
        result = tx.run(query, column_id=column_id)
        record = result.single()
        return {"nodes": record["nodes"], "edges": record["edges"]} if record else {"nodes": [], "edges": []}

    @staticmethod
    def _get_upstream_lineage(tx, column_id: str) -> Dict[str, Any]:
        query = """
        MATCH path = (start:Column {id: $column_id})<-[*1..10]-(end:Column)
        UNWIND nodes(path) AS n
        UNWIND relationships(path) AS r
        RETURN
            COLLECT(DISTINCT {
                id: n.id,
                type: 'column',
                table: n.table_name,
                column: n.column_name
            }) AS nodes,
            COLLECT(DISTINCT {
                source: endNode(r).id,
                target: startNode(r).id,
                type: r.transformation_type,
                sql: r.sql_snippet,
                logic: r.transformation_logic
            }) AS edges
        """
        result = tx.run(query, column_id=column_id)
        record = result.single()
        return {"nodes": record["nodes"], "edges": record["edges"]} if record else {"nodes": [], "edges": []}

    def analyze_impact(self, table_name: str, column_name: str) -> ImpactAnalysisResult:
        if not self._driver:
            return ImpactAnalysisResult([], [], [], [])

        column_id = f"{table_name}.{column_name}"

        with self._driver.session() as session:
            result = session.execute_read(self._get_impact_analysis, column_id)

        return ImpactAnalysisResult(
            affected_columns=result.get("affected_columns", []),
            affected_tables=result.get("affected_tables", []),
            affected_jobs=result.get("affected_jobs", []),
            impact_path=result.get("impact_path", []),
        )

    @staticmethod
    def _get_impact_analysis(tx, column_id: str) -> Dict[str, Any]:
        query = """
        MATCH path = (start:Column {id: $column_id})-[*1..10]->(end:Column)
        WITH COLLECT(path) AS paths
        UNWIND paths AS p
        WITH nodes(p) AS path_nodes, relationships(p) AS path_rels
        UNWIND path_nodes AS n
        WITH COLLECT(DISTINCT n.id) AS columns, path_rels, path_nodes
        UNWIND columns AS col
        WITH COLLECT(DISTINCT col) AS all_columns,
             COLLECT(DISTINCT split(col, '.')[0]) AS tables,
             path_rels
        UNWIND path_rels AS r
        WITH all_columns, tables, COLLECT(DISTINCT r.job_id) AS jobs
        RETURN all_columns, tables, jobs
        """
        result = tx.run(query, column_id=column_id)
        record = result.single()

        if record:
            return {
                "affected_columns": record["all_columns"],
                "affected_tables": record["tables"],
                "affected_jobs": record["jobs"],
                "impact_path": [],
            }
        return {"affected_columns": [], "affected_tables": [], "affected_jobs": [], "impact_path": []}

    def get_full_lineage_graph(self, depth: int = 5) -> Dict[str, Any]:
        if not self._driver:
            return {"nodes": [], "edges": []}

        with self._driver.session() as session:
            result = session.execute_read(self._get_full_graph, depth)

        return result

    @staticmethod
    def _get_full_graph(tx, depth: int) -> Dict[str, Any]:
        query = """
        MATCH (c:Column)
        MATCH (t:Table)
        MATCH ()-[r:TRANSFORMS_TO]->()
        RETURN
            COLLECT(DISTINCT {
                id: c.id,
                type: 'column',
                table: c.table_name,
                column: c.column_name
            }) AS column_nodes,
            COLLECT(DISTINCT {
                id: t.name,
                type: 'table',
                name: t.name
            }) AS table_nodes,
            COLLECT(DISTINCT {
                source: startNode(r).id,
                target: endNode(r).id,
                type: r.transformation_type,
                sql: r.sql_snippet,
                logic: r.transformation_logic
            }) AS edges
        """
        result = tx.run(query)
        record = result.single()

        if record:
            return {
                "nodes": record["column_nodes"] + record["table_nodes"],
                "edges": record["edges"],
            }
        return {"nodes": [], "edges": []}

    def get_tables(self) -> List[str]:
        if not self._driver:
            return []

        with self._driver.session() as session:
            result = session.execute_read(self._get_all_tables)

        return result

    @staticmethod
    def _get_all_tables(tx) -> List[str]:
        query = "MATCH (t:Table) RETURN t.name AS name ORDER BY name"
        result = tx.run(query)
        return [record["name"] for record in result]

    def get_table_columns(self, table_name: str) -> List[str]:
        if not self._driver:
            return []

        with self._driver.session() as session:
            result = session.execute_read(self._get_table_columns, table_name)

        return result

    @staticmethod
    def _get_table_columns(tx, table_name: str) -> List[str]:
        query = """
        MATCH (c:Column {table_name: $table_name})
        RETURN c.column_name AS column_name
        ORDER BY column_name
        """
        result = tx.run(query, table_name=table_name)
        return [record["column_name"] for record in result]

    def get_transformation_details(self, source_id: str, target_id: str) -> Dict[str, Any]:
        if not self._driver:
            return {}

        with self._driver.session() as session:
            result = session.execute_read(self._get_edge_details, source_id, target_id)

        return result

    @staticmethod
    def _get_edge_details(tx, source_id: str, target_id: str) -> Dict[str, Any]:
        query = """
        MATCH (s:Column {id: $source_id})-[r:TRANSFORMS_TO]->(t:Column {id: $target_id})
        RETURN r.transformation_type AS type,
               r.transformation_logic AS logic,
               r.sql_snippet AS sql,
               r.job_id AS job_id
        """
        result = tx.run(query, source_id=source_id, target_id=target_id)
        record = result.single()
        return dict(record) if record else {}

    def clear_all_data(self) -> None:
        if not self._driver:
            return

        with self._driver.session() as session:
            session.execute_write(self._clear_database)

    @staticmethod
    def _clear_database(tx) -> None:
        tx.run("MATCH (n) DETACH DELETE n")

    def store_column_quality_metrics(self, table_name: str, column_name: str, metrics: Dict[str, Any]) -> None:
        if not self._driver:
            return

        with self._driver.session() as session:
            session.execute_write(self._store_column_quality, table_name, column_name, metrics)

    @staticmethod
    def _store_column_quality(tx, table_name: str, column_name: str, metrics: Dict[str, Any]) -> None:
        column_id = f"{table_name}.{column_name}"
        query = """
        MERGE (c:Column {id: $column_id})
        SET c.table_name = $table_name,
            c.column_name = $column_name,
            c.null_rate = $null_rate,
            c.duplicate_rate = $duplicate_rate,
            c.outlier_rate = $outlier_rate,
            c.invalid_format_rate = $invalid_format_rate,
            c.value_range_violation = $value_range_violation,
            c.uniqueness_violation = $uniqueness_violation,
            c.quality_score = $quality_score,
            c.quality_updated_at = datetime(),
            c.has_quality_alert = $has_alert
        """
        tx.run(
            query,
            column_id=column_id,
            table_name=table_name,
            column_name=column_name,
            null_rate=metrics.get('null_rate', 0.0),
            duplicate_rate=metrics.get('duplicate_rate', 0.0),
            outlier_rate=metrics.get('outlier_rate', 0.0),
            invalid_format_rate=metrics.get('invalid_format_rate', 0.0),
            value_range_violation=metrics.get('value_range_violation', 0.0),
            uniqueness_violation=metrics.get('uniqueness_violation', 0.0),
            quality_score=metrics.get('quality_score', 1.0),
            has_alert=metrics.get('has_alert', False),
        )

    def get_column_quality_metrics(self, table_name: str, column_name: str) -> Optional[Dict[str, Any]]:
        if not self._driver:
            return None

        with self._driver.session() as session:
            result = session.execute_read(self._get_column_quality, table_name, column_name)

        return result

    @staticmethod
    def _get_column_quality(tx, table_name: str, column_name: str) -> Optional[Dict[str, Any]]:
        column_id = f"{table_name}.{column_name}"
        query = """
        MATCH (c:Column {id: $column_id})
        RETURN c{
            .id,
            .table_name,
            .column_name,
            .null_rate,
            .duplicate_rate,
            .outlier_rate,
            .invalid_format_rate,
            .value_range_violation,
            .uniqueness_violation,
            .quality_score,
            .has_quality_alert,
            .quality_updated_at
        } AS metrics
        """
        result = tx.run(query, column_id=column_id)
        record = result.single()
        return dict(record['metrics']) if record and record['metrics'] else None

    def store_quality_alert(self, alert: Dict[str, Any]) -> None:
        if not self._driver:
            return

        with self._driver.session() as session:
            session.execute_write(self._store_quality_alert, alert)

    @staticmethod
    def _store_quality_alert(tx, alert: Dict[str, Any]) -> None:
        query = """
        CREATE (a:QualityAlert {
            alert_id: $alert_id,
            table_name: $table_name,
            column_name: $column_name,
            metric_type: $metric_type,
            metric_value: $metric_value,
            threshold: $threshold,
            alert_level: $alert_level,
            message: $message,
            created_at: $created_at,
            resolved: false
        })
        WITH a
        MATCH (c:Column {id: $column_id})
        CREATE (c)-[:HAS_ALERT]->(a)
        """
        column_id = f"{alert['table_name']}.{alert['column_name']}"
        tx.run(
            query,
            alert_id=alert['alert_id'],
            table_name=alert['table_name'],
            column_name=alert['column_name'],
            column_id=column_id,
            metric_type=alert['metric_type'],
            metric_value=alert['metric_value'],
            threshold=alert['threshold'],
            alert_level=alert['alert_level'],
            message=alert['message'],
            created_at=alert.get('created_at'),
        )

    def get_quality_alerts(self, table_name: Optional[str] = None, alert_level: Optional[str] = None) -> List[Dict[str, Any]]:
        if not self._driver:
            return []

        with self._driver.session() as session:
            result = session.execute_read(self._get_quality_alerts, table_name, alert_level)

        return result

    @staticmethod
    def _get_quality_alerts(tx, table_name: Optional[str], alert_level: Optional[str]) -> List[Dict[str, Any]]:
        query = "MATCH (a:QualityAlert) "
        params = {}

        conditions = []
        if table_name:
            conditions.append("a.table_name = $table_name")
            params['table_name'] = table_name
        if alert_level:
            conditions.append("a.alert_level = $alert_level")
            params['alert_level'] = alert_level

        if conditions:
            query += "WHERE " + " AND ".join(conditions) + " "

        query += """
        RETURN a{
            .alert_id,
            .table_name,
            .column_name,
            .metric_type,
            .metric_value,
            .threshold,
            .alert_level,
            .message,
            .created_at,
            .resolved
        } AS alert
        ORDER BY a.created_at DESC
        """

        result = tx.run(query, **params)
        return [dict(record['alert']) for record in result]

    def get_columns_with_alerts(self) -> List[Dict[str, Any]]:
        if not self._driver:
            return []

        with self._driver.session() as session:
            result = session.execute_read(self._get_columns_with_alerts)

        return result

    @staticmethod
    def _get_columns_with_alerts(tx) -> List[Dict[str, Any]]:
        query = """
        MATCH (c:Column)-[:HAS_ALERT]->(a:QualityAlert {resolved: false})
        RETURN 
            c.id AS column_id,
            c.table_name AS table_name,
            c.column_name AS column_name,
            c.quality_score AS quality_score,
            COLLECT(DISTINCT a.alert_level) AS alert_levels,
            COUNT(a) AS alert_count
        ORDER BY c.quality_score ASC
        """
        result = tx.run(query)
        return [dict(record) for record in result]

    def get_lineage_with_quality(self, table_name: str, column_name: str, direction: str = "downstream") -> Dict[str, Any]:
        if not self._driver:
            return {"nodes": [], "edges": []}

        column_id = f"{table_name}.{column_name}"

        with self._driver.session() as session:
            if direction == "downstream":
                result = session.execute_read(self._get_downstream_lineage_with_quality, column_id)
            elif direction == "upstream":
                result = session.execute_read(self._get_upstream_lineage_with_quality, column_id)
            else:
                result = {"nodes": [], "edges": []}

        return result

    @staticmethod
    def _get_downstream_lineage_with_quality(tx, column_id: str) -> Dict[str, Any]:
        query = """
        MATCH path = (start:Column {id: $column_id})-[*1..10]->(end:Column)
        UNWIND nodes(path) AS n
        UNWIND relationships(path) AS r
        RETURN
            COLLECT(DISTINCT {
                id: n.id,
                type: 'column',
                table: n.table_name,
                column: n.column_name,
                quality_score: COALESCE(n.quality_score, 1.0),
                null_rate: COALESCE(n.null_rate, 0.0),
                has_alert: COALESCE(n.has_quality_alert, false)
            }) AS nodes,
            COLLECT(DISTINCT {
                source: startNode(r).id,
                target: endNode(r).id,
                type: r.transformation_type,
                sql: r.sql_snippet,
                logic: r.transformation_logic
            }) AS edges
        """
        result = tx.run(query, column_id=column_id)
        record = result.single()
        return {"nodes": record["nodes"], "edges": record["edges"]} if record else {"nodes": [], "edges": []}

    @staticmethod
    def _get_upstream_lineage_with_quality(tx, column_id: str) -> Dict[str, Any]:
        query = """
        MATCH path = (start:Column {id: $column_id})<-[*1..10]-(end:Column)
        UNWIND nodes(path) AS n
        UNWIND relationships(path) AS r
        RETURN
            COLLECT(DISTINCT {
                id: n.id,
                type: 'column',
                table: n.table_name,
                column: n.column_name,
                quality_score: COALESCE(n.quality_score, 1.0),
                null_rate: COALESCE(n.null_rate, 0.0),
                has_alert: COALESCE(n.has_quality_alert, false)
            }) AS nodes,
            COLLECT(DISTINCT {
                source: endNode(r).id,
                target: startNode(r).id,
                type: r.transformation_type,
                sql: r.sql_snippet,
                logic: r.transformation_logic
            }) AS edges
        """
        result = tx.run(query, column_id=column_id)
        record = result.single()
        return {"nodes": record["nodes"], "edges": record["edges"]} if record else {"nodes": [], "edges": []}
