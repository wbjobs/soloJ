use crate::coverage::CoverageMap;
use crate::fuzzer::FuzzerConfig;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub coverage: CoverageMap,
    pub corpus: Vec<Vec<u8>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FuzzingSession {
    pub id: String,
    pub config: FuzzerConfig,
    pub created_at: u64,
    pub updated_at: u64,
    pub session_dir: PathBuf,
}

impl FuzzingSession {
    pub fn new(config: &FuzzerConfig) -> Result<Self> {
        let id = Self::generate_id();
        let session_dir = config.output_dir.join("sessions").join(&id);
        
        fs::create_dir_all(&session_dir)
            .context("Failed to create session directory")?;
        
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let session = Self {
            id,
            config: config.clone(),
            created_at: now,
            updated_at: now,
            session_dir,
        };
        
        session.save_metadata()?;
        
        Ok(session)
    }

    pub fn load(session_path: &Path) -> Result<Self> {
        let metadata_path = if session_path.is_dir() {
            session_path.join("session.json")
        } else {
            session_path.to_path_buf()
        };
        
        let metadata = fs::read_to_string(&metadata_path)
            .context("Failed to read session metadata")?;
        
        let mut session: FuzzingSession = serde_json::from_str(&metadata)
            .context("Failed to parse session metadata")?;
        
        if session_path.is_dir() {
            session.session_dir = session_path.to_path_buf();
        }
        
        Ok(session)
    }

    pub fn save_state(&self, state: &SessionState) -> Result<()> {
        let state_path = self.session_dir.join("state.bin");
        
        let encoded = bincode::serialize(state)
            .context("Failed to serialize session state")?;
        
        fs::write(&state_path, encoded)
            .context("Failed to write session state")?;
        
        Ok(())
    }

    pub fn load_state(&self) -> Result<SessionState> {
        let state_path = self.session_dir.join("state.bin");
        
        let encoded = fs::read(&state_path)
            .context("Failed to read session state")?;
        
        let state: SessionState = bincode::deserialize(&encoded)
            .context("Failed to deserialize session state")?;
        
        Ok(state)
    }

    fn save_metadata(&self) -> Result<()> {
        let metadata_path = self.session_dir.join("session.json");
        
        let json = serde_json::to_string_pretty(self)
            .context("Failed to serialize session metadata")?;
        
        fs::write(&metadata_path, json)
            .context("Failed to write session metadata")?;
        
        Ok(())
    }

    fn generate_id() -> String {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        (0..8)
            .map(|_| rng.sample(rand::distributions::Alphanumeric) as char)
            .collect()
    }
}
