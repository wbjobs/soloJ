from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from .database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    patient_name_hash = Column(String(128), nullable=False, index=True)
    patient_id_hash = Column(String(128), nullable=False, index=True)
    patient_birth_date_hash = Column(String(128))
    patient_sex_hash = Column(String(128))
    study_date_hash = Column(String(128))
    study_time_hash = Column(String(128))
    accession_number_hash = Column(String(128))
    institution_name_hash = Column(String(128))
    referring_physician_hash = Column(String(128))
    study_description_hash = Column(String(128))
    series_description_hash = Column(String(128))
    modality_hash = Column(String(128))
    manufacturer_hash = Column(String(128))
    request_ip = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
