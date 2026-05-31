CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    video_file_name VARCHAR(255) NOT NULL,
    video_file_size BIGINT NOT NULL,
    video_duration FLOAT,
    subtitle_file_name VARCHAR(255) NOT NULL,
    original_subtitle_path VARCHAR(500) NOT NULL,
    aligned_subtitle_path VARCHAR(500),
    alignment_offset FLOAT,
    confidence FLOAT,
    vad_segments JSONB,
    subtitle_segments JSONB,
    error_message TEXT,
    progress INTEGER DEFAULT 0,
    model_version VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_model_version ON tasks(model_version);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS alignment_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    original_offset FLOAT,
    new_offset FLOAT,
    user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alignment_history_task_id ON alignment_history(task_id);

CREATE TABLE IF NOT EXISTS subtitle_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    subtitle_index INTEGER NOT NULL,
    original_start FLOAT NOT NULL,
    original_end FLOAT NOT NULL,
    corrected_start FLOAT NOT NULL,
    corrected_end FLOAT NOT NULL,
    original_text TEXT,
    vad_start FLOAT,
    vad_end FLOAT,
    user_id VARCHAR(100),
    is_used_for_training BOOLEAN DEFAULT FALSE,
    training_batch_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subtitle_corrections_task_id ON subtitle_corrections(task_id);
CREATE INDEX IF NOT EXISTS idx_subtitle_corrections_is_used ON subtitle_corrections(is_used_for_training);
CREATE INDEX IF NOT EXISTS idx_subtitle_corrections_created_at ON subtitle_corrections(created_at);

DROP TRIGGER IF EXISTS update_subtitle_corrections_updated_at ON subtitle_corrections;
CREATE TRIGGER update_subtitle_corrections_updated_at
    BEFORE UPDATE ON subtitle_corrections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS model_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    model_type VARCHAR(50) NOT NULL DEFAULT 'rule_based',
    model_data JSONB,
    is_active BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    training_sample_count INTEGER DEFAULT 0,
    validation_accuracy FLOAT,
    test_accuracy FLOAT,
    avg_offset_error FLOAT,
    trained_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_model_versions_is_active ON model_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_model_versions_is_default ON model_versions(is_default);

CREATE TABLE IF NOT EXISTS ab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    model_a_id UUID REFERENCES model_versions(id),
    model_b_id UUID REFERENCES model_versions(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    traffic_split_a INTEGER DEFAULT 50,
    traffic_split_b INTEGER DEFAULT 50,
    results JSONB,
    winner_id UUID REFERENCES model_versions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);
CREATE INDEX IF NOT EXISTS idx_ab_tests_created_at ON ab_tests(created_at);

CREATE TABLE IF NOT EXISTS ab_test_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ab_test_id UUID REFERENCES ab_tests(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    assigned_model_id UUID REFERENCES model_versions(id),
    variant VARCHAR(10) NOT NULL,
    offset_error FLOAT,
    is_converted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_test_id ON ab_test_assignments(ab_test_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_assignments_task_id ON ab_test_assignments(task_id);

CREATE TABLE IF NOT EXISTS training_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100),
    sample_count INTEGER DEFAULT 0,
    model_version_id UUID REFERENCES model_versions(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    parameters JSONB,
    metrics JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_training_batches_status ON training_batches(status);
CREATE INDEX IF NOT EXISTS idx_training_batches_model_version_id ON training_batches(model_version_id);

CREATE TABLE IF NOT EXISTS calibration_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    model_version VARCHAR(50),
    original_offset FLOAT,
    corrected_offset FLOAT,
    confidence FLOAT,
    vad_segment_count INTEGER,
    subtitle_segment_count INTEGER,
    match_rate_before FLOAT,
    match_rate_after FLOAT,
    avg_offset_error_before FLOAT,
    avg_offset_error_after FLOAT,
    report_data JSONB,
    file_path VARCHAR(500),
    user_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calibration_reports_task_id ON calibration_reports(task_id);
CREATE INDEX IF NOT EXISTS idx_calibration_reports_created_at ON calibration_reports(created_at);

INSERT INTO model_versions (id, version, name, description, model_type, is_active, is_default, created_at)
VALUES 
    (uuid_generate_v4(), 'v1.0.0', 'Rule-based Alignment', '基于重叠度的规则对齐算法', 'rule_based', true, true, CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;
