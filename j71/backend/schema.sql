CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    patient_name_hash VARCHAR(128) NOT NULL,
    patient_id_hash VARCHAR(128) NOT NULL,
    patient_birth_date_hash VARCHAR(128),
    patient_sex_hash VARCHAR(128),
    study_date_hash VARCHAR(128),
    study_time_hash VARCHAR(128),
    accession_number_hash VARCHAR(128),
    institution_name_hash VARCHAR(128),
    referring_physician_hash VARCHAR(128),
    study_description_hash VARCHAR(128),
    series_description_hash VARCHAR(128),
    modality_hash VARCHAR(128),
    manufacturer_hash VARCHAR(128),
    request_ip VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_name ON audit_logs(patient_name_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_patient_id ON audit_logs(patient_id_hash);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
