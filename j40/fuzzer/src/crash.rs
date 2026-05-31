use serde::{Deserialize, Serialize};
use sqlite::{Connection, State};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use anyhow::{Context, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrashInfo {
    pub id: String,
    pub input: Vec<u8>,
    pub stack_trace: String,
    pub registers: HashMap<String, u64>,
    pub signal: i32,
    pub signal_name: String,
    pub timestamp: u64,
    pub priority: u32,
    pub duplicate_of: Option<String>,
}

#[derive(Debug, Clone)]
pub struct CrashManager {
    conn: Connection,
    output_dir: PathBuf,
}

impl CrashManager {
    pub fn new(output_dir: &Path) -> Result<Self> {
        std::fs::create_dir_all(output_dir)?;
        
        let db_path = output_dir.join("crashes.db");
        let conn = Connection::open(&db_path).context("Failed to open crash database")?;
        
        let manager = Self {
            conn,
            output_dir: output_dir.to_path_buf(),
        };
        
        manager.init_schema()?;
        
        Ok(manager)
    }

    fn init_schema(&self) -> Result<()> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS crashes (
                id TEXT PRIMARY KEY,
                input BLOB,
                stack_trace TEXT,
                registers TEXT,
                signal INTEGER,
                signal_name TEXT,
                timestamp INTEGER,
                priority INTEGER,
                duplicate_of TEXT
            )",
        ).context("Failed to create crashes table")?;
        
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS crash_stats (
                key TEXT PRIMARY KEY,
                count INTEGER,
                first_seen INTEGER,
                last_seen INTEGER
            )",
        ).context("Failed to create crash_stats table")?;
        
        Ok(())
    }

    pub fn record_crash(&mut self, input: &[u8], stack_trace: &str, signal: i32, signal_name: &str) -> Result<String> {
        let crash_id = self.generate_crash_id(stack_trace);
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        
        let registers = HashMap::new();
        let registers_json = serde_json::to_string(&registers)?;
        
        let duplicate = self.find_duplicate(stack_trace)?;
        
        if let Some(dup_id) = &duplicate {
            self.conn.execute(
                "INSERT OR REPLACE INTO crash_stats (key, count, first_seen, last_seen)
                VALUES (?1, COALESCE((SELECT count FROM crash_stats WHERE key = ?1, 0) + 1, ?2, ?2)",
                (&dup_id, &timestamp),
            )?;
        }
        
        let priority = self.calculate_priority(stack_trace, signal);
        
        self.conn.execute(
            "INSERT INTO crashes (
                id, input, stack_trace, registers, signal, signal_name, timestamp, priority, duplicate_of
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            (
                &crash_id, input, stack_trace, &registers_json, &signal, signal_name, &timestamp, &priority, &duplicate),
        )?;
        
        self.save_input(&crash_id, input)?;
        
        Ok(crash_id)
    }

    fn generate_crash_id(&self, stack_trace: &str) -> String {
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(stack_trace.as_bytes());
        let result = hasher.finalize();
        format!("{:x}", result)[..16].to_string()
    }

    fn find_duplicate(&self, stack_trace: &str) -> Result<Option<String>> {
        let mut stmt = self.conn.prepare(
            "SELECT id FROM crashes WHERE stack_trace = ?1 LIMIT 1"
        )?;
        
        let mut rows = stmt.query(&[stack_trace])?;
        
        if let Some(row) = rows.next()? {
            Ok(Some(row.read::<String, _>(0)?))
        } else {
            Ok(None)
        }
    }

    fn calculate_priority(&self, stack_trace: &str, signal: i32) -> u32 {
        let mut priority = 0;
        
        match signal {
            11 => priority += 100,
            6 => priority += 80,
            4 => priority += 60,
            7 => priority += 50,
            _ => priority += 10,
        }
        
        if stack_trace.contains("null") || stack_trace.contains("0x0") {
            priority += 50;
        }
        if stack_trace.contains("free") || stack_trace.contains("malloc") {
            priority += 30;
        }
        if stack_trace.contains("overflow") {
            priority += 40;
        }
        
        priority
    }

    fn save_input(&self, crash_id: &str, input: &[u8]) -> Result<()> {
        let crash_dir = self.output_dir.join("crashes");
        std::fs::create_dir_all(&crash_dir)?;
        
        let file_path = crash_dir.join(format!("crash_{}", crash_id));
        std::fs::write(file_path, input)?;
        
        Ok(())
    }

    pub fn get_unique_crashes(&self) -> Result<Vec<CrashInfo>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, input, stack_trace, registers, signal, signal_name, timestamp, priority, duplicate_of
             FROM crashes WHERE duplicate_of IS NULL ORDER BY priority DESC"
        )?;
        
        let mut rows = stmt.query([])?;
        let mut crashes = Vec::new();
        
        while let Some(row) = rows.next()? {
            let registers_str: String = row.read(2)?;
            let registers: HashMap<String, u64> = serde_json::from_str(&registers_str).unwrap_or_default();
            
            crashes.push(CrashInfo {
                id: row.read(0)?,
                input: row.read(1)?,
                stack_trace: row.read(2)?,
                registers,
                signal: row.read(4)?,
                signal_name: row.read(5)?,
                timestamp: row.read(6)?,
                priority: row.read(7)?,
                duplicate_of: row.read(8)?,
            });
        }
        
        Ok(crashes)
    }
}

pub struct CrashTriage {
    input_path: PathBuf,
    output_path: Option<PathBuf>,
}

impl CrashTriage {
    pub fn new(input: &Path, output: Option<PathBuf>) -> Result<Self> {
        Ok(Self {
            input_path: input.to_path_buf(),
            output_path: output,
        })
    }

    pub fn analyze(&self) -> Result<()> {
        let db_path = if self.input_path.is_dir() {
            self.input_path.join("crashes.db")
        } else {
            self.input_path.clone()
        };
        
        let conn = Connection::open(&db_path)?;
        
        println!("=== Crash Triage Report");
        println!("========================");
        
        let total_count: i64 = conn.prepare("SELECT COUNT(*) FROM crashes")?
            .query_row([], |row| row.read(0))?;
        
        let unique_count: i64 = conn.prepare("SELECT COUNT(*) FROM crashes WHERE duplicate_of IS NULL")?
            .query_row([], |row| row.read(0))?;
        
        println!("Total crashes: {}", total_count);
        println!("Unique crashes: {}", unique_count);
        
        let mut stmt = conn.prepare(
            "SELECT signal_name, COUNT(*) as cnt 
             FROM crashes 
             WHERE duplicate_of IS NULL 
             GROUP BY signal_name 
             ORDER BY cnt DESC"
        )?;
        
        let mut rows = stmt.query([])?;
        
        println!("\nCrash types:");
        while let Some(row) = rows.next()? {
            let signal: String = row.read(0)?;
            let count: i64 = row.read(1)?;
            println!("  {}: {}", signal, count);
        }
        
        let mut stmt = conn.prepare(
            "SELECT id, signal_name, priority, timestamp
             FROM crashes 
             WHERE duplicate_of IS NULL 
             ORDER BY priority DESC LIMIT 10"
        )?;
        
        let mut rows = stmt.query([])?;
        
        println!("\nTop 10 highest priority crashes:");
        while let Some(row) = rows.next()? {
            let id: String = row.read(0)?;
            let signal: String = row.read(1)?;
            let priority: i32 = row.read(2)?;
            println!("  [{}] {} (priority: {})", id, signal, priority);
        }
        
        Ok(())
    }
}
