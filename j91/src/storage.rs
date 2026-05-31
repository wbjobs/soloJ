use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use anyhow::{Result, Context};
use serde::{Serialize, Deserialize};
use tracing::info;

use crate::raft::LogEntry;

pub trait Storage {
    fn load_logs(&self) -> Result<Vec<LogEntry>>;
    fn save_logs(&self, logs: &[LogEntry]) -> Result<()>;
    fn load_term(&self) -> Result<u64>;
    fn save_term(&self, term: u64) -> Result<()>;
    fn load_voted_for(&self) -> Result<Option<String>>;
    fn save_voted_for(&self, voted_for: Option<String>) -> Result<()>;
    fn save_snapshot(&self, last_included_index: u64, last_included_term: u64, data: &[u8]) -> Result<()>;
    fn load_snapshot(&self) -> Result<Option<(u64, u64, Vec<u8>)>>;
}

pub struct WalLog {
    base_path: PathBuf,
    log_file: Mutex<File>,
    term_file: PathBuf,
    voted_for_file: PathBuf,
}

impl WalLog {
    pub fn new(base_path: impl AsRef<Path>) -> Result<Self> {
        let base_path = base_path.as_ref().to_path_buf();
        fs::create_dir_all(&base_path)?;

        let log_path = base_path.join("raft.log");
        let term_path = base_path.join("term.dat");
        let voted_for_path = base_path.join("voted_for.dat");

        let log_file = OpenOptions::new()
            .create(true)
            .read(true)
            .write(true)
            .append(false)
            .open(&log_path)?;

        Ok(Self {
            base_path,
            log_file: Mutex::new(log_file),
            term_file: term_path,
            voted_for_file: voted_for_path,
        })
    }
}

#[async_trait::async_trait]
impl Storage for WalLog {
    fn load_logs(&self) -> Result<Vec<LogEntry>> {
        let mut file = self.log_file.lock().unwrap();
        file.seek(SeekFrom::Start(0))?;

        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)?;

        if buffer.is_empty() {
            return Ok(Vec::new());
        }

        let mut logs = Vec::new();
        let mut offset = 0;

        while offset < buffer.len() {
            if offset + 8 > buffer.len() {
                break;
            }
            let len = u64::from_be_bytes(buffer[offset..offset + 8].try_into().unwrap()) as usize;
            offset += 8;

            if offset + len > buffer.len() {
                break;
            }

            let entry: LogEntry = bincode::deserialize(&buffer[offset..offset + len])
                .context("Failed to deserialize log entry")?;
            logs.push(entry);
            offset += len;
        }

        Ok(logs)
    }

    fn save_logs(&self, logs: &[LogEntry]) -> Result<()> {
        let mut file = self.log_file.lock().unwrap();
        file.seek(SeekFrom::Start(0))?;
        file.set_len(0)?;

        for entry in logs {
            let bytes = bincode::serialize(entry)?;
            let len = bytes.len() as u64;
            file.write_all(&len.to_be_bytes())?;
            file.write_all(&bytes)?;
        }

        file.flush()?;
        Ok(())
    }

    fn load_term(&self) -> Result<u64> {
        if !self.term_file.exists() {
            return Ok(0);
        }

        let mut file = File::open(&self.term_file)?;
        let mut bytes = [0u8; 8];
        file.read_exact(&mut bytes)?;
        Ok(u64::from_be_bytes(bytes))
    }

    fn save_term(&self, term: u64) -> Result<()> {
        let mut file = File::create(&self.term_file)?;
        file.write_all(&term.to_be_bytes())?;
        file.flush()?;
        Ok(())
    }

    fn load_voted_for(&self) -> Result<Option<String>> {
        if !self.voted_for_file.exists() {
            return Ok(None);
        }

        let mut file = File::open(&self.voted_for_file)?;
        let mut buffer = String::new();
        file.read_to_string(&mut buffer)?;

        if buffer.is_empty() || buffer == "None" {
            Ok(None)
        } else {
            Ok(Some(buffer))
        }
    }

    fn save_voted_for(&self, voted_for: Option<String>) -> Result<()> {
        let mut file = File::create(&self.voted_for_file)?;
        match voted_for {
            Some(id) => file.write_all(id.as_bytes())?,
            None => file.write_all(b"None")?,
        }
        file.flush()?;
        Ok(())
    }

    fn save_snapshot(&self, last_included_index: u64, last_included_term: u64, data: &[u8]) -> Result<()> {
        let snapshot_path = self.base_path.join("snapshot.dat");
        let mut file = File::create(&snapshot_path)?;

        file.write_all(&last_included_index.to_be_bytes())?;
        file.write_all(&last_included_term.to_be_bytes())?;
        file.write_all(&(data.len() as u64).to_be_bytes())?;
        file.write_all(data)?;
        file.flush()?;

        info!("Saved snapshot: index={}, term={}", last_included_index, last_included_term);
        Ok(())
    }

    fn load_snapshot(&self) -> Result<Option<(u64, u64, Vec<u8>)>> {
        let snapshot_path = self.base_path.join("snapshot.dat");
        if !snapshot_path.exists() {
            return Ok(None);
        }

        let mut file = File::open(&snapshot_path)?;
        let mut bytes = [0u8; 8];

        file.read_exact(&mut bytes)?;
        let last_included_index = u64::from_be_bytes(bytes);

        file.read_exact(&mut bytes)?;
        let last_included_term = u64::from_be_bytes(bytes);

        file.read_exact(&mut bytes)?;
        let data_len = u64::from_be_bytes(bytes) as usize;

        let mut data = vec![0u8; data_len];
        file.read_exact(&mut data)?;

        Ok(Some((last_included_index, last_included_term, data)))
    }
}

pub struct Snapshot;

impl Snapshot {
    pub fn create_snapshot(
        storage: &dyn Storage,
        kv_store: &std::collections::HashMap<String, String>,
        last_applied: u64,
        current_term: u64,
    ) -> Result<()> {
        let data = serde_json::to_vec(kv_store)?;
        storage.save_snapshot(last_applied, current_term, &data)
    }

    pub fn load_snapshot(storage: &dyn Storage) -> Result<Option<std::collections::HashMap<String, String>>> {
        if let Some((_, _, data)) = storage.load_snapshot()? {
            let kv_store: std::collections::HashMap<String, String> = serde_json::from_slice(&data)?;
            Ok(Some(kv_store))
        } else {
            Ok(None)
        }
    }
}
