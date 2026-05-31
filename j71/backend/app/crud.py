from sqlalchemy.orm import Session
from sqlalchemy import func, text
from .models import AuditLog
from .schemas import AuditLogCreate
from .utils import hash_sha256


def create_audit_log(
    db: Session,
    audit_data: AuditLogCreate,
    request_ip: str | None = None,
    user_agent: str | None = None,
) -> AuditLog:
    db_audit = AuditLog(
        patient_name_hash=hash_sha256(audit_data.patient_name),
        patient_id_hash=hash_sha256(audit_data.patient_id),
        patient_birth_date_hash=hash_sha256(audit_data.patient_birth_date),
        patient_sex_hash=hash_sha256(audit_data.patient_sex),
        study_date_hash=hash_sha256(audit_data.study_date),
        study_time_hash=hash_sha256(audit_data.study_time),
        accession_number_hash=hash_sha256(audit_data.accession_number),
        institution_name_hash=hash_sha256(audit_data.institution_name),
        referring_physician_hash=hash_sha256(audit_data.referring_physician),
        study_description_hash=hash_sha256(audit_data.study_description),
        series_description_hash=hash_sha256(audit_data.series_description),
        modality_hash=hash_sha256(audit_data.modality),
        manufacturer_hash=hash_sha256(audit_data.manufacturer),
        request_ip=request_ip,
        user_agent=user_agent,
    )
    db.add(db_audit)
    db.commit()
    db.refresh(db_audit)
    return db_audit


def get_audit_log(db: Session, audit_id: int) -> AuditLog | None:
    return db.query(AuditLog).filter(AuditLog.id == audit_id).first()


def get_audit_logs(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    patient_id_hash: str | None = None,
) -> tuple[list[AuditLog], int]:
    query = db.query(AuditLog)
    
    if patient_id_hash:
        query = query.filter(AuditLog.patient_id_hash == patient_id_hash)
    
    total = query.with_entities(func.count(AuditLog.id)).scalar()
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    
    return logs, total


def get_hourly_stats(
    db: Session,
    hours: int = 24,
) -> list[dict]:
    sql = text("""
        SELECT
            date_trunc('hour', created_at) AS hour,
            COUNT(*) AS count
        FROM audit_logs
        WHERE created_at >= NOW() - INTERVAL :interval_str
        GROUP BY hour
        ORDER BY hour ASC
    """)

    interval_str = f"{hours} hours"
    rows = db.execute(sql, {"interval_str": interval_str}).fetchall()

    return [{"hour": row[0], "count": row[1]} for row in rows]
