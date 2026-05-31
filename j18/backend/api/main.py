from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from dataclasses import asdict

from ..sql_parser import SparkSQLParser
from ..graph_db import Neo4jAdapter
from ..services import ImpactAnalyzer
from ..models.lineage_models import ParsedLineageResult

try:
    from ..services.data_quality_service import DataQualityService
    from ..services.anomaly_propagation_service import AnomalyPropagationService
    DATA_QUALITY_AVAILABLE = True
except ImportError:
    DATA_QUALITY_AVAILABLE = False


app = FastAPI(
    title="Data Lineage API",
    description="数据血缘追踪平台API - 字段级血缘解析、查询和影响分析",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NEO4J_CONFIG = {
    "uri": "bolt://localhost:7687",
    "user": "neo4j",
    "password": "password",
}

sql_parser = SparkSQLParser()


def get_neo4j_adapter() -> Neo4jAdapter:
    try:
        return Neo4jAdapter(**NEO4J_CONFIG)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to Neo4j: {e}")


def get_impact_analyzer() -> ImpactAnalyzer:
    neo4j = get_neo4j_adapter()
    return ImpactAnalyzer(neo4j)


class ParseSQLRequest(BaseModel):
    sql: str
    target_table: Optional[str] = None


class StoreLineageRequest(BaseModel):
    sql: str
    target_table: Optional[str] = None
    job_id: Optional[str] = None


class ImpactAnalysisRequest(BaseModel):
    table_name: str
    column_name: Optional[str] = None


class BatchImpactRequest(BaseModel):
    changes: List[Dict[str, str]]


class QualityMetricsRequest(BaseModel):
    table_name: str
    column_name: str
    metrics: Dict[str, float]


class AnomalyPropagationRequest(BaseModel):
    table_name: str
    column_name: str
    source_anomaly_rate: float = 0.15
    anomaly_type: str = "null_rate"
    max_depth: int = 10


class BatchPropagationRequest(BaseModel):
    sources: List[Dict[str, Any]]
    max_depth: int = 10


@app.get("/")
async def root():
    return {"message": "Data Lineage API", "version": "1.0.0"}


@app.post("/api/parse/sql", summary="解析SQL获取字段血缘")
async def parse_sql(request: ParseSQLRequest) -> Dict[str, Any]:
    try:
        result = sql_parser.parse_lineage(request.sql, request.target_table)
        return {
            "success": True,
            "data": {
                "source_tables": result.source_tables,
                "target_table": result.target_table,
                "field_mappings": [asdict(m) for m in result.field_mappings],
                "transformations": [asdict(t) for t in result.transformation_nodes],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/lineage/store", summary="解析SQL并存储血缘关系到Neo4j")
async def store_lineage(request: StoreLineageRequest) -> Dict[str, Any]:
    try:
        lineage_result = sql_parser.parse_lineage(request.sql, request.target_table)
        job_id = request.job_id or f"manual_{hash(request.sql) % 1000000}"

        neo4j = get_neo4j_adapter()
        neo4j.store_lineage(lineage_result, job_id)
        neo4j.close()

        return {
            "success": True,
            "message": "Lineage stored successfully",
            "job_id": job_id,
            "data": {
                "source_tables": lineage_result.source_tables,
                "target_table": lineage_result.target_table,
                "mappings_count": len(lineage_result.field_mappings),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/tables", summary="获取所有表列表")
async def get_tables() -> Dict[str, Any]:
    try:
        neo4j = get_neo4j_adapter()
        tables = neo4j.get_tables()
        neo4j.close()
        return {"success": True, "data": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tables/{table_name}/columns", summary="获取表的所有字段")
async def get_table_columns(table_name: str) -> Dict[str, Any]:
    try:
        neo4j = get_neo4j_adapter()
        columns = neo4j.get_table_columns(table_name)
        neo4j.close()
        return {"success": True, "data": columns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/lineage/column", summary="获取字段血缘关系")
async def get_column_lineage(
    table_name: str = Query(..., description="表名"),
    column_name: str = Query(..., description="字段名"),
    direction: str = Query("downstream", description="查询方向: upstream 或 downstream"),
) -> Dict[str, Any]:
    try:
        if direction not in ["upstream", "downstream", "both"]:
            raise HTTPException(status_code=400, detail="direction must be upstream, downstream, or both")

        neo4j = get_neo4j_adapter()

        if direction == "both":
            upstream = neo4j.get_column_lineage(table_name, column_name, "upstream")
            downstream = neo4j.get_column_lineage(table_name, column_name, "downstream")
            nodes = list({n["id"]: n for n in upstream["nodes"] + downstream["nodes"]}.values())
            edges = upstream["edges"] + downstream["edges"]
            result = {"nodes": nodes, "edges": edges}
        else:
            result = neo4j.get_column_lineage(table_name, column_name, direction)

        neo4j.close()
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/lineage/graph", summary="获取完整血缘图")
async def get_full_lineage_graph(
    depth: int = Query(5, description="遍历深度")
) -> Dict[str, Any]:
    try:
        neo4j = get_neo4j_adapter()
        result = neo4j.get_full_lineage_graph(depth)
        neo4j.close()
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/impact/analyze", summary="分析字段/表的影响")
async def analyze_impact(request: ImpactAnalysisRequest) -> Dict[str, Any]:
    try:
        analyzer = get_impact_analyzer()

        if request.column_name:
            result = analyzer.analyze_column_impact(request.table_name, request.column_name)
            return {"success": True, "data": asdict(result)}
        else:
            result = analyzer.analyze_table_impact(request.table_name)
            return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/impact/summary", summary="获取影响分析摘要")
async def get_impact_summary(
    table_name: str = Query(..., description="表名"),
    column_name: str = Query(..., description="字段名"),
) -> Dict[str, Any]:
    try:
        analyzer = get_impact_analyzer()
        result = analyzer.get_impact_summary(table_name, column_name)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/impact/batch", summary="批量分析多个变更的影响")
async def batch_impact_analysis(request: BatchImpactRequest) -> Dict[str, Any]:
    try:
        analyzer = get_impact_analyzer()
        result = analyzer.compare_impact(request.changes)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/transformation", summary="获取字段转换详情")
async def get_transformation_details(
    source_id: str = Query(..., description="源字段ID"),
    target_id: str = Query(..., description="目标字段ID"),
) -> Dict[str, Any]:
    try:
        neo4j = get_neo4j_adapter()
        result = neo4j.get_transformation_details(source_id, target_id)
        neo4j.close()
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/data/clear", summary="清空所有血缘数据")
async def clear_all_data() -> Dict[str, Any]:
    try:
        neo4j = get_neo4j_adapter()
        neo4j.clear_all_data()
        neo4j.close()
        return {"success": True, "message": "All data cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def get_data_quality_service():
    if not DATA_QUALITY_AVAILABLE:
        raise HTTPException(status_code=500, detail="Data quality service not available")
    return DataQualityService()


def get_anomaly_propagation_service():
    if not DATA_QUALITY_AVAILABLE:
        raise HTTPException(status_code=500, detail="Anomaly propagation service not available")
    neo4j = get_neo4j_adapter()
    return AnomalyPropagationService(neo4j)


@app.post("/api/quality/metrics/store", summary="存储字段质量指标")
async def store_quality_metrics(request: QualityMetricsRequest) -> Dict[str, Any]:
    try:
        service = get_data_quality_service()
        neo4j = get_neo4j_adapter()
        neo4j.store_column_quality_metrics(
            request.table_name,
            request.column_name,
            request.metrics,
        )
        neo4j.close()
        return {"success": True, "message": "Quality metrics stored"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/quality/metrics", summary="获取字段质量指标")
async def get_quality_metrics(
    table_name: str = Query(..., description="表名"),
    column_name: str = Query(..., description="字段名"),
) -> Dict[str, Any]:
    try:
        neo4j = get_neo4j_adapter()
        metrics = neo4j.get_column_quality_metrics(table_name, column_name)
        neo4j.close()
        return {"success": True, "data": metrics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/quality/generate-alerts", summary="根据质量指标生成预警")
async def generate_alerts(request: QualityMetricsRequest) -> Dict[str, Any]:
    try:
        service = get_data_quality_service()

        from ..models.data_quality_models import TableQualityMetrics, ColumnQualityMetrics
        col_metrics = ColumnQualityMetrics(
            table_name=request.table_name,
            column_name=request.column_name,
            **request.metrics,
        )
        table_metrics = TableQualityMetrics(
            table_name=request.table_name,
            columns={request.column_name: col_metrics},
        )
        alerts = service.generate_alerts(table_metrics)

        neo4j = get_neo4j_adapter()
        for alert in alerts:
            alert_dict = asdict(alert)
            alert_dict['metric_type'] = alert_dict['metric_type']['value']
            alert_dict['alert_level'] = alert_dict['alert_level']['value']
            neo4j.store_quality_alert(alert_dict)
        neo4j.close()

        return {"success": True, "data": [asdict(a) for a in alerts]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/quality/alerts", summary="获取质量预警列表")
async def get_quality_alerts(
    table_name: Optional[str] = Query(None, description="表名过滤"),
    alert_level: Optional[str] = Query(None, description="预警级别过滤"),
) -> Dict[str, Any]:
    try:
        neo4j = get_neo4j_adapter()
        alerts = neo4j.get_quality_alerts(table_name, alert_level)
        neo4j.close()
        return {"success": True, "data": alerts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/quality/columns-with-alerts", summary="获取有预警的字段列表")
async def get_columns_with_alerts() -> Dict[str, Any]:
    try:
        neo4j = get_neo4j_adapter()
        columns = neo4j.get_columns_with_alerts()
        neo4j.close()
        return {"success": True, "data": columns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/quality/anomaly-propagation", summary="分析异常传播影响")
async def analyze_anomaly_propagation(request: AnomalyPropagationRequest) -> Dict[str, Any]:
    try:
        service = get_anomaly_propagation_service()
        result = service.analyze_propagation(
            table_name=request.table_name,
            column_name=request.column_name,
            source_anomaly_rate=request.source_anomaly_rate,
            anomaly_type=request.anomaly_type,
            max_depth=request.max_depth,
        )
        service.neo4j.close()
        return {"success": True, "data": asdict(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/quality/batch-propagation", summary="批量分析异常传播")
async def batch_anomaly_propagation(request: BatchPropagationRequest) -> Dict[str, Any]:
    try:
        service = get_anomaly_propagation_service()
        result = service.batch_propagation_analysis(
            sources=request.sources,
            max_depth=request.max_depth,
        )
        service.neo4j.close()
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/quality/anomaly-visualization", summary="获取异常传播可视化数据")
async def get_anomaly_visualization(
    table_name: str = Query(..., description="表名"),
    column_name: str = Query(..., description="字段名"),
    source_anomaly_rate: float = Query(0.15, description="源异常率"),
) -> Dict[str, Any]:
    try:
        service = get_anomaly_propagation_service()
        result = service.analyze_propagation(
            table_name=table_name,
            column_name=column_name,
            source_anomaly_rate=source_anomaly_rate,
        )
        visualization = service.visualize_propagation_data(result)
        service.neo4j.close()
        return {"success": True, "data": visualization}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/quality/simulate", summary="模拟生成表质量指标")
async def simulate_quality_metrics(
    table_name: str = Query(..., description="表名"),
    columns: str = Query(..., description="字段名列表，逗号分隔"),
) -> Dict[str, Any]:
    try:
        service = get_data_quality_service()
        column_list = [c.strip() for c in columns.split(",")]
        result = service.simulate_quality_metrics(table_name, column_list)
        return {"success": True, "data": asdict(result)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
