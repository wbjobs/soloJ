from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, DataError, OperationalError
from typing import Annotated
import logging
import traceback

from .database import get_db, engine
from .models import Base
from .schemas import AuditLogCreate, AuditLogResponse, AuditLogListResponse, HourlyStatsResponse
from . import crud

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DICOM 审计日志 API",
    description="接收 DICOM 敏感元数据，哈希化后存储为审计日志",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@app.get("/")
async def root():
    return {
        "name": "DICOM Audit API",
        "version": "1.0.0",
        "endpoints": {
            "POST /api/audit": "创建审计日志",
            "GET /api/audit": "查询审计日志列表",
            "GET /api/audit/stats": "按小时统计处理数量",
            "GET /api/audit/{id}": "查询单个审计日志",
            "GET /health": "健康检查",
        },
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post(
    "/api/audit",
    response_model=AuditLogResponse,
    summary="创建审计日志",
    description="接收敏感元数据，使用 SHA-256 哈希化后存入数据库",
)
async def create_audit(
    audit_data: AuditLogCreate,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
):
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("User-Agent")

    logger.info(
        f"Received audit log request from {client_ip}: "
        f"patient_id={audit_data.patient_id[:4]}***, "
        f"study_date={audit_data.study_date!r}, "
        f"study_time={audit_data.study_time!r}"
    )

    if not audit_data.patient_name or not audit_data.patient_id:
        raise HTTPException(
            status_code=400,
            detail="patient_name and patient_id are required fields",
        )

    try:
        db_audit = crud.create_audit_log(
            db=db,
            audit_data=audit_data,
            request_ip=client_ip,
            user_agent=user_agent,
        )
        logger.info(f"Audit log created with ID: {db_audit.id}")
        return db_audit
    except DataError as e:
        logger.error(f"Database data error: {e}\n{traceback.format_exc()}")
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"数据格式错误，请检查日期/时间格式: {str(e)[:200]}",
        )
    except IntegrityError as e:
        logger.error(f"Database integrity error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="数据完整性冲突",
        )
    except OperationalError as e:
        logger.error(f"Database operational error: {e}")
        db.rollback()
        raise HTTPException(
            status_code=503,
            detail="数据库服务暂时不可用，请稍后重试",
        )
    except Exception as e:
        logger.error(f"Unexpected error creating audit log: {e}\n{traceback.format_exc()}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"创建审计日志失败: {str(e)[:200]}",
        )


@app.get(
    "/api/audit/stats",
    response_model=HourlyStatsResponse,
    summary="获取审计日志按小时统计",
)
async def get_audit_stats(
    hours: int = 24,
    db: Annotated[Session, Depends(get_db)] = None,
):
    if hours < 1:
        hours = 1
    if hours > 720:
        hours = 720

    try:
        stats = crud.get_hourly_stats(db, hours=hours)
    except Exception as e:
        logger.error(f"Error getting audit stats: {e}")
        raise HTTPException(status_code=500, detail="查询统计数据失败")

    hour_labels = []
    counts = []
    total = 0

    for entry in stats:
        hour_val = entry["hour"]
        if hour_val is not None:
            label = hour_val.strftime("%Y-%m-%dT%H:00:00") if hasattr(hour_val, "strftime") else str(hour_val)
        else:
            label = ""
        hour_labels.append(label)
        counts.append(entry["count"])
        total += entry["count"]

    return {
        "hours": hour_labels,
        "counts": counts,
        "total": total,
    }


@app.get(
    "/api/audit",
    response_model=AuditLogListResponse,
    summary="查询审计日志列表",
)
async def list_audits(
    page: int = 1,
    limit: int = 20,
    patient_id_hash: str | None = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    if page < 1:
        page = 1
    if limit < 1 or limit > 100:
        limit = 20

    skip = (page - 1) * limit
    try:
        logs, total = crud.get_audit_logs(
            db, skip=skip, limit=limit, patient_id_hash=patient_id_hash
        )
    except Exception as e:
        logger.error(f"Error listing audit logs: {e}")
        raise HTTPException(status_code=500, detail="查询审计日志失败")

    return {
        "logs": logs,
        "total": total,
        "page": page,
        "limit": limit,
    }


@app.get(
    "/api/audit/{audit_id}",
    response_model=AuditLogResponse,
    summary="查询单个审计日志",
)
async def get_audit(
    audit_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    db_audit = crud.get_audit_log(db, audit_id=audit_id)
    if db_audit is None:
        raise HTTPException(status_code=404, detail="Audit log not found")
    return db_audit


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
