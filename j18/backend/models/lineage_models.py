from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum


class TransformationType(Enum):
    SELECT = "select"
    FILTER = "filter"
    JOIN = "join"
    AGGREGATE = "aggregate"
    PROJECT = "project"
    UNION = "union"
    SORT = "sort"
    WINDOW = "window"


class NodeType(Enum):
    TABLE = "table"
    COLUMN = "column"
    TRANSFORMATION = "transformation"
    JOB = "job"


@dataclass
class FieldMapping:
    source_table: str
    source_column: str
    target_table: str
    target_column: str
    transformation_type: TransformationType
    transformation_logic: str
    sql_snippet: str


@dataclass
class ColumnNode:
    table_name: str
    column_name: str
    data_type: str
    description: Optional[str] = None


@dataclass
class TableNode:
    table_name: str
    database: str
    schema: str
    columns: List[ColumnNode] = field(default_factory=list)


@dataclass
class TransformationNode:
    transformation_id: str
    transformation_type: TransformationType
    sql_snippet: str
    input_fields: List[str]
    output_fields: List[str]
    logic: str


@dataclass
class LineageEdge:
    source_id: str
    target_id: str
    transformation_type: TransformationType
    sql_snippet: str
    transformation_logic: str


@dataclass
class LineageGraph:
    tables: Dict[str, TableNode] = field(default_factory=dict)
    columns: Dict[str, ColumnNode] = field(default_factory=dict)
    transformations: Dict[str, TransformationNode] = field(default_factory=dict)
    edges: List[LineageEdge] = field(default_factory=list)

    def get_column_id(self, table_name: str, column_name: str) -> str:
        return f"{table_name}.{column_name}"


@dataclass
class ParsedLineageResult:
    source_tables: List[str]
    target_table: str
    field_mappings: List[FieldMapping]
    transformation_nodes: List[TransformationNode]
    raw_sql: str


@dataclass
class ImpactAnalysisResult:
    affected_columns: List[str]
    affected_tables: List[str]
    affected_jobs: List[str]
    impact_path: List[Dict[str, Any]]


@dataclass
class JobExecutionContext:
    job_id: str
    job_name: str
    start_time: str
    end_time: Optional[str] = None
    status: str = "running"
    sql_statements: List[str] = field(default_factory=list)
    lineage_records: List[FieldMapping] = field(default_factory=list)
