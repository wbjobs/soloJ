export interface DicomMetadata {
  patient_name: string;
  patient_id: string;
  patient_birth_date: string;
  patient_sex: string;
  study_date: string;
  study_time: string;
  accession_number: string;
  institution_name: string;
  referring_physician: string;
  study_description: string;
  series_description: string;
  modality: string;
  manufacturer: string;
  rows: number;
  columns: number;
  bits_allocated: number;
  bits_stored: number;
  samples_per_pixel: number;
  photometric_interpretation: string;
}

export interface DicomParseResult {
  metadata: DicomMetadata;
  pixel_data: number[];
  width: number;
  height: number;
}

export interface AuditLogRequest {
  patient_name: string;
  patient_id: string;
  patient_birth_date: string;
  patient_sex: string;
  study_date: string;
  study_time: string;
  accession_number: string;
  institution_name: string;
  referring_physician: string;
  study_description: string;
  series_description: string;
  modality: string;
  manufacturer: string;
}

export interface AuditLogResponse {
  id: number;
  patient_name_hash: string;
  patient_id_hash: string;
  patient_birth_date_hash: string;
  patient_sex_hash: string;
  study_date_hash: string;
  accession_number_hash: string;
  institution_name_hash: string;
  referring_physician_hash: string;
  created_at: string;
}

export interface AnonymizedFileResult {
  fileName: string;
  metadata: DicomMetadata;
  anonymizedData: Uint8Array;
}

export interface HourlyStats {
  hours: string[];
  counts: number[];
  total: number;
}

export interface BatchAnonymizeProgress {
  current: number;
  total: number;
  currentFile: string;
  percent: number;
}
