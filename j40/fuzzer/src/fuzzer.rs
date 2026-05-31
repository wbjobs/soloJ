use crate::coverage::{CoverageMap, SharedCoverage};
use crate::crash::CrashManager;
use crate::mutator::{Mutator, MutatorConfig, SeedEnergy};
use crate::session::{FuzzingSession, SessionState};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, Instant, SystemTime};
use parking_lot::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FuzzerConfig {
    pub target: PathBuf,
    pub protocol: String,
    pub workers: usize,
    pub duration: Option<Duration>,
    pub output_dir: PathBuf,
    pub corpus_dir: Option<PathBuf>,
    pub dictionary: Option<PathBuf>,
    pub resume_session: Option<PathBuf>,
    pub max_corpus_size: usize,
}

impl Default for FuzzerConfig {
    fn default() -> Self {
        Self {
            target: PathBuf::from("./target"),
            protocol: "raw".to_string(),
            workers: 1,
            duration: None,
            output_dir: PathBuf::from("./output"),
            corpus_dir: None,
            dictionary: None,
            resume_session: None,
            max_corpus_size: 10000,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CorpusEntry {
    pub data: Vec<u8>,
    pub coverage: CoverageMap,
    pub energy: SeedEnergy,
    pub timestamp: u64,
}

pub struct Fuzzer {
    config: FuzzerConfig,
    coverage: Arc<SharedCoverage>,
    mutator: Arc<RwLock<Mutator>>,
    corpus: Arc<RwLock<Vec<CorpusEntry>>>,
    crash_manager: Arc<RwLock<CrashManager>>,
    session: FuzzingSession,
    start_time: Instant,
    total_executions: u64,
    corpus_trim_counter: u64,
}

impl Fuzzer {
    pub fn new(config: FuzzerConfig) -> Result<Self> {
        std::fs::create_dir_all(&config.output_dir)
            .context("Failed to create output directory")?;
        
        let mutator_config = MutatorConfig::default();
        let mut mutator = Mutator::new(mutator_config);
        
        if let Some(dict_path) = &config.dictionary {
            mutator.load_dictionary(dict_path)
                .context("Failed to load dictionary")?;
        }
        
        let session = FuzzingSession::new(&config)?;
        let crash_manager = CrashManager::new(&config.output_dir.join("crashes"))
            .context("Failed to create crash manager")?;
        
        let mut corpus = Vec::new();
        if let Some(corpus_dir) = &config.corpus_dir {
            Self::load_corpus(corpus_dir, &mut corpus)?;
        }
        
        if corpus.is_empty() {
            corpus.push(CorpusEntry {
                data: Self::generate_initial_input(&config.protocol),
                coverage: CoverageMap::new(),
                energy: SeedEnergy::new(100.0),
                timestamp: SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(),
            });
        }
        
        Ok(Self {
            config,
            coverage: Arc::new(SharedCoverage::new()),
            mutator: Arc::new(RwLock::new(mutator)),
            corpus: Arc::new(RwLock::new(corpus)),
            crash_manager: Arc::new(RwLock::new(crash_manager)),
            session,
            start_time: Instant::now(),
            total_executions: 0,
            corpus_trim_counter: 0,
        })
    }

    pub fn from_session(session_path: &Path) -> Result<Self> {
        let session = FuzzingSession::load(session_path)
            .context("Failed to load session")?;
        
        let mut fuzzer = Self::new(session.config.clone())?;
        fuzzer.session = session;
        fuzzer.restore_state()?;
        
        Ok(fuzzer)
    }

    pub fn run(&mut self) -> Result<()> {
        println!("Starting network fuzzer...");
        println!("Target: {:?}", self.config.target);
        println!("Protocol: {}", self.config.protocol);
        println!("Workers: {}", self.config.workers);
        
        if self.config.workers > 1 {
            self.run_distributed()?;
        } else {
            self.run_single()?;
        }
        
        self.save_session()?;
        Ok(())
    }

    fn run_single(&mut self) -> Result<()> {
        let mut iteration = 0u64;
        
        loop {
            if self.should_stop() {
                break;
            }
            
            self.fuzz_one()?;
            
            iteration += 1;
            self.total_executions += 1;
            
            if iteration % 1000 == 0 {
                self.print_stats(iteration);
            }
            
            if iteration % 10000 == 0 {
                self.save_session()?;
            }
            
            if iteration % 5000 == 0 {
                self.trim_corpus();
            }
        }
        
        Ok(())
    }

    fn run_distributed(&mut self) -> Result<()> {
        use crate::distributed::*;
        
        let master = Master::new(self.config.clone())?;
        master.run()?;
        
        Ok(())
    }

    fn select_seed_weighted(&self) -> Option<usize> {
        let corpus = self.corpus.read();
        if corpus.is_empty() {
            return None;
        }
        
        let total_seeds = corpus.len();
        let mut weights = Vec::with_capacity(total_seeds);
        
        for entry in corpus.iter() {
            let w = entry.energy.schedule_energy(
                total_seeds,
                self.total_executions,
                None,
            );
            weights.push(w);
        }
        
        let total_weight: f64 = weights.iter().sum();
        if total_weight <= 0.0 {
            return Some(fastrand::usize(..corpus.len()));
        }
        
        let mut r = fastrand::f64() * total_weight;
        for (i, &w) in weights.iter().enumerate() {
            r -= w;
            if r <= 0.0 {
                return Some(i);
            }
        }
        
        Some(corpus.len() - 1)
    }

    fn fuzz_one(&mut self) -> Result<()> {
        let seed_idx = self.select_seed_weighted()
            .unwrap_or(0);
        
        let corpus_entry = {
            let corpus = self.corpus.read();
            if corpus.is_empty() {
                return Ok(());
            }
            let idx = seed_idx.min(corpus.len() - 1);
            corpus[idx].data.clone()
        };
        
        let mut data = corpus_entry;
        {
            let mut mutator = self.mutator.write();
            mutator.mutate(&mut data, 4096);
        }
        
        let result = self.execute_target(&data)?;
        
        match result {
            ExecutionResult::Crash { stack_trace, signal, signal_name } => {
                let mut crash_mgr = self.crash_manager.write();
                crash_mgr.record_crash(&data, &stack_trace, signal, &signal_name)?;
                println!("\n[!] Crash found! Signal: {}", signal_name);
            }
            ExecutionResult::Coverage(coverage) => {
                let has_new = self.coverage.update(&coverage);
                if has_new {
                    {
                        let mut mutator = self.mutator.write();
                        mutator.notify_new_coverage();
                    }
                    
                    let mut corpus = self.corpus.write();
                    if let Some(entry) = corpus.get_mut(seed_idx) {
                        entry.energy.on_new_coverage();
                    }
                    
                    corpus.push(CorpusEntry {
                        data: data.clone(),
                        coverage,
                        energy: SeedEnergy::new(100.0),
                        timestamp: SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(),
                    });
                } else {
                    let mut mutator = self.mutator.write();
                    mutator.notify_no_coverage();
                }
            }
            ExecutionResult::Timeout => {}
            ExecutionResult::Success => {
                let mut mutator = self.mutator.write();
                mutator.notify_no_coverage();
            }
        }
        
        Ok(())
    }

    fn trim_corpus(&mut self) {
        self.corpus_trim_counter += 1;
        
        let mut corpus = self.corpus.write();
        if corpus.len() <= self.config.max_corpus_size {
            return;
        }
        
        corpus.sort_by(|a, b| {
            b.energy.energy.partial_cmp(&a.energy.energy).unwrap_or(std::cmp::Ordering::Equal)
        });
        
        let keep = self.config.max_corpus_size * 9 / 10;
        let protected = corpus.len() - keep;
        
        let mut to_keep = Vec::with_capacity(keep + protected / 2);
        
        for (i, entry) in corpus.drain(..).enumerate() {
            if i < keep {
                to_keep.push(entry);
            } else if i < keep + protected / 2 && fastrand::f64() < 0.5 {
                to_keep.push(entry);
            }
        }
        
        *corpus = to_keep;
        println!("\n[*] Corpus trimmed to {} entries", corpus.len());
    }

    fn execute_target(&self, _data: &[u8]) -> Result<ExecutionResult> {
        Ok(ExecutionResult::Success)
    }

    fn should_stop(&self) -> bool {
        if let Some(duration) = self.config.duration {
            if self.start_time.elapsed() >= duration {
                return true;
            }
        }
        
        false
    }

    fn print_stats(&self, iteration: u64) {
        let stats = self.coverage.get_stats();
        let elapsed = self.start_time.elapsed().as_secs_f64();
        let exec_per_sec = if elapsed > 0.0 { iteration as f64 / elapsed } else { 0.0 };
        let corpus_len = self.corpus.read().len();
        let (stagnation, gap, intensity) = self.mutator.read().get_stagnation_info();
        let phase = self.mutator.read().get_phase().to_string();
        
        print!("\r");
        print!("[{:>8}] exec/s: {:>8.0} | cov: {:>6.2}% | edges: {:>6} | corpus: {:>5} | phase: {:>14} | int: {:>2}",
            humantime::format_duration(Duration::from_secs_f64(elapsed)),
            exec_per_sec,
            stats.edge_coverage_pct,
            stats.covered_edges,
            corpus_len,
            phase,
            intensity,
        );
        let _ = std::io::Write::flush(&mut std::io::stdout());
    }

    fn save_session(&self) -> Result<()> {
        self.session.save_state(&SessionState {
            coverage: self.coverage.global_map.read().clone(),
            corpus: self.corpus.read().iter().map(|e| e.data.clone()).collect(),
        })
    }

    fn restore_state(&mut self) -> Result<()> {
        let state = self.session.load_state()?;
        
        *self.coverage.global_map.write() = state.coverage;
        
        let mut corpus = self.corpus.write();
        corpus.clear();
        for data in state.corpus {
            corpus.push(CorpusEntry {
                data,
                coverage: CoverageMap::new(),
                energy: SeedEnergy::new(50.0),
                timestamp: SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(),
            });
        }
        
        Ok(())
    }

    fn load_corpus(path: &Path, corpus: &mut Vec<CorpusEntry>) -> Result<()> {
        if !path.exists() {
            return Ok(());
        }
        
        for entry in std::fs::read_dir(path)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_file() {
                if let Ok(data) = std::fs::read(&path) {
                    corpus.push(CorpusEntry {
                        data,
                        coverage: CoverageMap::new(),
                        energy: SeedEnergy::new(100.0),
                        timestamp: SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs(),
                    });
                }
            }
        }
        
        Ok(())
    }

    fn generate_initial_input(protocol: &str) -> Vec<u8> {
        match protocol.to_lowercase().as_str() {
            "http" => b"GET / HTTP/1.1\r\nHost: localhost\r\n\r\n".to_vec(),
            "http-post" => b"POST / HTTP/1.1\r\nHost: localhost\r\nContent-Length: 5\r\n\r\nhello".to_vec(),
            "dns" => vec![0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 7, b'e', b'x', b'a', b'm', b'p', b'l', b'e', 3, b'c', b'o', b'm', 0, 0, 1, 0, 1],
            _ => b"HELLO\r\n".to_vec(),
        }
    }
}

pub enum ExecutionResult {
    Success,
    Crash {
        stack_trace: String,
        signal: i32,
        signal_name: String,
    },
    Coverage(CoverageMap),
    Timeout,
}
