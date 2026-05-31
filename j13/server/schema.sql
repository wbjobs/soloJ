CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  host_id VARCHAR(255),
  model_url VARCHAR(500),
  locked_view JSONB,
  model_transform JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) UNIQUE NOT NULL,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) DEFAULT 'viewer',
  color VARCHAR(20) DEFAULT '#4CAF50',
  connected BOOLEAN DEFAULT true,
  joined_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  position_x DOUBLE PRECISION NOT NULL,
  position_y DOUBLE PRECISION NOT NULL,
  position_z DOUBLE PRECISION NOT NULL,
  local_position_x DOUBLE PRECISION,
  local_position_y DOUBLE PRECISION,
  local_position_z DOUBLE PRECISION,
  text_content TEXT,
  audio_url VARCHAR(500),
  audio_duration INTEGER DEFAULT 0,
  camera_view JSONB,
  model_transform JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_annotations_room ON annotations(room_id);
CREATE INDEX IF NOT EXISTS idx_users_room ON users(room_id);
CREATE INDEX IF NOT EXISTS idx_users_session ON users(session_id);

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS model_transform JSONB;
ALTER TABLE annotations ADD COLUMN IF NOT EXISTS local_position_x DOUBLE PRECISION;
ALTER TABLE annotations ADD COLUMN IF NOT EXISTS local_position_y DOUBLE PRECISION;
ALTER TABLE annotations ADD COLUMN IF NOT EXISTS local_position_z DOUBLE PRECISION;
ALTER TABLE annotations ADD COLUMN IF NOT EXISTS model_transform JSONB;

CREATE TABLE IF NOT EXISTS operation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  op_type VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_session_id VARCHAR(255),
  seq BIGINT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  parent_branch VARCHAR(100) DEFAULT 'main',
  branch_root UUID,
  is_branch BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_op_logs_room_seq ON operation_logs(room_id, seq);
CREATE INDEX IF NOT EXISTS idx_op_logs_room_branch ON operation_logs(room_id, parent_branch, seq);
CREATE INDEX IF NOT EXISTS idx_op_logs_room_type ON operation_logs(room_id, op_type);

CREATE TABLE IF NOT EXISTS session_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  up_to_seq BIGINT NOT NULL,
  state JSONB NOT NULL,
  branch VARCHAR(100) DEFAULT 'main',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_room_branch ON session_snapshots(room_id, branch, up_to_seq);

CREATE TABLE IF NOT EXISTS session_forks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  forked_room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  source_op_id UUID REFERENCES operation_logs(id) ON DELETE SET NULL,
  source_seq BIGINT NOT NULL,
  source_branch VARCHAR(100) DEFAULT 'main',
  forked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forks_source_room ON session_forks(source_room_id);
CREATE INDEX IF NOT EXISTS idx_forks_forked_room ON session_forks(forked_room_id);
