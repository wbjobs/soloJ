from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional
import re


def normalize_dicom_date(value: str | None) -> str | None:
    if value is None or value.strip() == "":
        return None

    cleaned = re.sub(r"[^0-9]", "", value)

    if len(cleaned) == 8:
        year = cleaned[0:4]
        month = cleaned[4:6]
        day = cleaned[6:8]
        try:
            datetime(int(year), int(month), int(day))
            return f"{year}-{month}-{day}"
        except ValueError:
            return value

    if re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        try:
            datetime.strptime(value, "%Y-%m-%d")
            return value
        except ValueError:
            return value

    if re.match(r"^\d{2}/\d{2}/\d{4}$", value):
        try:
            dt = datetime.strptime(value, "%m/%d/%Y")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            return value

    return value


def normalize_dicom_time(value: str | None) -> str | None:
    if value is None or value.strip() == "":
        return None

    cleaned = re.sub(r"[^0-9.]", "", value)

    match = re.match(r"^(\d{2})(\d{2})(\d{2})(?:\.(\d+))?$", cleaned)
    if match:
        hours = match.group(1)
        minutes = match.group(2)
        seconds = match.group(3)
        frac = match.group(4)
        h, m, s = int(hours), int(minutes), int(seconds)
        if 0 <= h <= 23 and 0 <= m <= 59 and 0 <= s <= 59:
            if frac:
                frac_trimmed = frac[:6].rstrip("0")
                return f"{hours}:{minutes}:{seconds}.{frac_trimmed}" if frac_trimmed else f"{hours}:{minutes}:{seconds}"
            return f"{hours}:{minutes}:{seconds}"

    if re.match(r"^\d{2}:\d{2}:\d{2}", value):
        return value

    return value


class AuditLogCreate(BaseModel):
    patient_name: str
    patient_id: str
    patient_birth_date: Optional[str] = None
    patient_sex: Optional[str] = None
    study_date: Optional[str] = None
    study_time: Optional[str] = None
    accession_number: Optional[str] = None
    institution_name: Optional[str] = None
    referring_physician: Optional[str] = None
    study_description: Optional[str] = None
    series_description: Optional[str] = None
    modality: Optional[str] = None
    manufacturer: Optional[str] = None

    @field_validator("patient_birth_date", "study_date", mode="before")
    @classmethod
    def normalize_date_fields(cls, v: str | None) -> str | None:
        return normalize_dicom_date(v)

    @field_validator("study_time", mode="before")
    @classmethod
    def normalize_time_fields(cls, v: str | None) -> str | None:
        return normalize_dicom_time(v)

    @field_validator("patient_sex", mode="before")
    @classmethod
    def normalize_sex(cls, v: str | None) -> str | None:
        if v is None or v.strip() == "":
            return None
        return v.strip().upper()[:1]


class AuditLogResponse(BaseModel):
    id: int
    patient_name_hash: str
    patient_id_hash: str
    patient_birth_date_hash: Optional[str] = None
    patient_sex_hash: Optional[str] = None
    study_date_hash: Optional[str] = None
    accession_number_hash: Optional[str] = None
    institution_name_hash: Optional[str] = None
    referring_physician_hash: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    logs: list[AuditLogResponse]
    total: int
    page: int
    limit: int


class HashInfo(BaseModel):
    field: str
    original_value: str
    hash_value: str


class HourlyStatsResponse(BaseModel):
    hours: list[str]
    counts: list[int]
    total: int
