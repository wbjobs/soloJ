use crate::coverage::{CoverageMap, SharedCoverage};
use crate::crash::CrashManager;
use crate::fuzzer::{CorpusEntry, ExecutionResult, FuzzerConfig};
use crate::mutator::{Mutator, MutatorConfig};
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use parking_lot::RwLock;
use zmq;

const HEARTBEAT_INTERVAL_MS: u64 = 2000;
const WORKER_TIMEOUT_MS: u64 = 10000;
const MAX_RETRIES_PER_TASK: u32 = 3;
const POLL_TIMEOUT_MS: u64 = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    Hello { worker_id: String },
    Work { input: Vec<u8>, task_id: u64 },
    Result { worker_id: String, task_id: u64, result: WorkerResult },
    Heartbeat { worker_id: String },
    Bye { worker_id: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerResult {
    pub input: Vec<u8>,
    pub has_new_coverage: bool,
    pub coverage: Option<CoverageMap>,
    pub crash: Option<CrashInfo>,
    pub exec_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrashInfo {
    pub stack_trace: String,
    pub signal: i32,
    pub signal_name: String,
}

#[derive(Debug, Clone)]
struct PendingTask {
    task_id: u64,
    input: Vec<u8>,
    assigned_worker: String,
    assigned_at: Instant,
    retries: u32,
}

#[derive(Debug, Clone)]
struct WorkerState {
    id: String,
    last_heartbeat: Instant,
    tasks_completed: u64,
    is_alive: bool,
}

pub struct Master {
    config: FuzzerConfig,
    context: zmq::Context,
    coverage: Arc<SharedCoverage>,
    corpus: Arc<RwLock<Vec<CorpusEntry>>>,
    crash_manager: Arc<RwLock<CrashManager>>,
    start_time: Instant,
    workers: HashMap<String, WorkerState>,
    pending_tasks: HashMap<u64, PendingTask>,
    next_task_id: u64,
    last_heartbeat_check: Instant,
    mutator: Arc<RwLock<Mutator>>,
}

impl Master {
    pub fn new(config: FuzzerConfig) -> Result<Self> {
        let context = zmq::Context::new();
        let coverage = Arc::new(SharedCoverage::new());
        let corpus = Arc::new(RwLock::new(Vec::new()));
        let crash_manager = Arc::new(RwLock::new(CrashManager::new(&config.output_dir.join("crashes"))?));
        let mutator = Arc::new(RwLock::new(Mutator::new(MutatorConfig::default())));
        
        Ok(Self {
            config,
            context,
            coverage,
            corpus,
            crash_manager,
            start_time: Instant::now(),
            workers: HashMap::new(),
            pending_tasks: HashMap::new(),
            next_task_id: 0,
            last_heartbeat_check: Instant::now(),
            mutator,
        })
    }

    pub fn run(&mut self) -> Result<()> {
        let router = self.context.socket(zmq::ROUTER)?;
        router.bind("tcp://*:5555")?;
        router.set_rcvtimeo(POLL_TIMEOUT_MS as i32)?;
        
        let publisher = self.context.socket(zmq::PUB)?;
        publisher.bind("tcp://*:5556")?;
        
        println!("Master listening on tcp://*:5555 (ROUTER)");
        println!("Master publishing on tcp://*:5556 (PUB)");
        
        let mut msg_counter = 0u64;
        
        loop {
            self.check_worker_timeouts();
            
            if self.last_heartbeat_check.elapsed() >= Duration::from_millis(HEARTBEAT_INTERVAL_MS) {
                self.request_heartbeats(&publisher);
                self.last_heartbeat_check = Instant::now();
            }
            
            self.reassign_timed_out_tasks(&router)?;
            
            let mut identity = zmq::Message::new();
            let mut payload = zmq::Message::new();
            
            match router.recv(&mut identity, 0) {
                Ok(_) => {
                    if router.recv(&mut payload, 0).is_ok() {
                        let worker_id = identity.as_str().unwrap_or("unknown").to_string();
                        
                        if let Ok(message) = serde_json::from_slice::<MessageType>(payload.as_bytes()) {
                            match message {
                                MessageType::Hello { worker_id: wid } => {
                                    println!("[+] Worker {} connected", wid);
                                    self.workers.insert(wid.clone(), WorkerState {
                                        id: wid.clone(),
                                        last_heartbeat: Instant::now(),
                                        tasks_completed: 0,
                                        is_alive: true,
                                    });
                                    self.send_work(&router, &wid)?;
                                }
                                MessageType::Result { worker_id: wid, task_id, result } => {
                                    if let Some(worker) = self.workers.get_mut(&wid) {
                                        worker.last_heartbeat = Instant::now();
                                        worker.tasks_completed += 1;
                                    }
                                    
                                    self.pending_tasks.remove(&task_id);
                                    
                                    self.handle_result(&wid, result)?;
                                    msg_counter += 1;
                                    self.send_work(&router, &worker_id)?;
                                    
                                    if msg_counter % 1000 == 0 {
                                        let active_workers = self.workers.values().filter(|w| w.is_alive).count();
                                        self.print_stats(msg_counter, active_workers);
                                    }
                                }
                                MessageType::Heartbeat { worker_id: wid } => {
                                    if let Some(worker) = self.workers.get_mut(&wid) {
                                        worker.last_heartbeat = Instant::now();
                                        worker.is_alive = true;
                                    }
                                }
                                MessageType::Bye { worker_id: wid } => {
                                    println!("[-] Worker {} disconnected gracefully", wid);
                                    self.handle_worker_death(&wid);
                                }
                                _ => {}
                            }
                        }
                    }
                }
                Err(_) => {}
            }
        }
    }

    fn check_worker_timeouts(&mut self) {
        let now = Instant::now();
        let timeout = Duration::from_millis(WORKER_TIMEOUT_MS);
        
        let mut dead_workers = Vec::new();
        for (id, worker) in self.workers.iter_mut() {
            if worker.is_alive && now.duration_since(worker.last_heartbeat) > timeout {
                println!("[!] Worker {} timed out (no heartbeat for {:?})",
                    id, now.duration_since(worker.last_heartbeat));
                worker.is_alive = false;
                dead_workers.push(id.clone());
            }
        }
        
        for wid in dead_workers {
            self.handle_worker_death(&wid);
        }
    }

    fn handle_worker_death(&mut self, worker_id: &str) {
        if let Some(worker) = self.workers.get_mut(worker_id) {
            worker.is_alive = false;
        }
        
        let mut tasks_to_reassign = Vec::new();
        for (_, task) in self.pending_tasks.iter_mut() {
            if task.assigned_worker == worker_id {
                task.assigned_worker = String::new();
                task.assigned_at = Instant::now();
                tasks_to_reassign.push(task.task_id);
            }
        }
        
        if !tasks_to_reassign.is_empty() {
            println!("[*] Reassigning {} tasks from dead worker {}",
                tasks_to_reassign.len(), worker_id);
        }
    }

    fn reassign_timed_out_tasks(&mut self, router: &zmq::Socket) -> Result<()> {
        let now = Instant::now();
        let task_timeout = Duration::from_millis(WORKER_TIMEOUT_MS * 2);
        
        let alive_workers: Vec<String> = self.workers.iter()
            .filter(|(_, w)| w.is_alive)
            .map(|(id, _)| id.clone())
            .collect();
        
        if alive_workers.is_empty() {
            return Ok(());
        }
        
        let mut task_ids_to_check: Vec<u64> = self.pending_tasks.keys().cloned().collect();
        
        for task_id in task_ids_to_check {
            let should_reassign = if let Some(task) = self.pending_tasks.get(&task_id) {
                let worker_dead = !task.assigned_worker.is_empty() && 
                    self.workers.get(&task.assigned_worker)
                        .map(|w| !w.is_alive)
                        .unwrap_or(true);
                
                let timed_out = !task.assigned_worker.is_empty() && 
                    now.duration_since(task.assigned_at) > task_timeout;
                
                worker_dead || timed_out
            } else {
                false
            };
            
            if should_reassign {
                if let Some(task) = self.pending_tasks.get_mut(&task_id) {
                    if task.retries >= MAX_RETRIES_PER_TASK {
                        println!("[!] Task {} exceeded max retries, discarding", task_id);
                        self.pending_tasks.remove(&task_id);
                        continue;
                    }
                    
                    task.retries += 1;
                    
                    let worker_idx = fastrand::usize(..alive_workers.len());
                    let new_worker = alive_workers[worker_idx].clone();
                    
                    println!("[*] Reassigning task {} to worker {} (retry {})",
                        task_id, new_worker, task.retries);
                    
                    let message = MessageType::Work {
                        input: task.input.clone(),
                        task_id,
                    };
                    let serialized = serde_json::to_vec(&message)?;
                    
                    router.send(&new_worker, zmq::SNDMORE)?;
                    router.send(&serialized, 0)?;
                    
                    task.assigned_worker = new_worker;
                    task.assigned_at = Instant::now();
                }
            }
        }
        
        Ok(())
    }

    fn request_heartbeats(&self, publisher: &zmq::Socket) {
        let msg = b"HEARTBEAT_REQ";
        let _ = publisher.send(msg, 0);
    }

    fn send_work(&self, router: &zmq::Socket, worker_id: &str) -> Result<()> {
        let input = {
            let corpus = self.corpus.read();
            if !corpus.is_empty() {
                let idx = fastrand::usize(..corpus.len());
                corpus[idx].data.clone()
            } else {
                b"GET / HTTP/1.1\r\nHost: localhost\r\n\r\n".to_vec()
            }
        };
        
        let mut data = input;
        {
            let mut mutator = self.mutator.write();
            mutator.mutate(&mut data, 4096);
        }
        
        let task_id = self.next_task_id;
        
        let message = MessageType::Work { input: data.clone(), task_id };
        let serialized = serde_json::to_vec(&message)?;
        
        router.send(worker_id, zmq::SNDMORE)?;
        router.send(&serialized, 0)?;
        
        Ok(())
    }

    fn handle_result(&self, _worker_id: &str, result: WorkerResult) -> Result<()> {
        if let Some(crash) = result.crash {
            let mut crash_mgr = self.crash_manager.write();
            crash_mgr.record_crash(&result.input, &crash.stack_trace, crash.signal, &crash.signal_name)?;
            println!("\n[!] Crash found! Signal: {}", crash.signal_name);
        }
        
        if let Some(coverage) = result.coverage {
            let has_new = self.coverage.update(&coverage);
            if has_new {
                {
                    let mut mutator = self.mutator.write();
                    mutator.notify_new_coverage();
                }
                
                let mut corpus = self.corpus.write();
                corpus.push(CorpusEntry {
                    data: result.input,
                    coverage,
                    energy: crate::mutator::SeedEnergy::new(100.0),
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs(),
                });
            }
        }
        
        Ok(())
    }

    fn print_stats(&self, iteration: u64, workers: usize) {
        let stats = self.coverage.get_stats();
        let elapsed = self.start_time.elapsed().as_secs_f64();
        let exec_per_sec = if elapsed > 0.0 { iteration as f64 / elapsed } else { 0.0 };
        let pending = self.pending_tasks.len();
        let total_workers = self.workers.len();
        let dead_workers = self.workers.values().filter(|w| !w.is_alive).count();
        
        print!("\r");
        print!("[{:>8}] workers: {}/{} | exec/s: {:>8.0} | cov: {:>6.2}% | edges: {:>6} | pending: {:>4}",
            humantime::format_duration(std::time::Duration::from_secs_f64(elapsed)),
            workers, total_workers,
            exec_per_sec,
            stats.edge_coverage_pct,
            stats.covered_edges,
            pending,
        );
        if dead_workers > 0 {
            print!(" | dead: {}", dead_workers);
        }
        let _ = std::io::Write::flush(&mut std::io::stdout());
    }
}

pub struct Worker {
    worker_id: String,
    context: zmq::Context,
    target: String,
}

impl Worker {
    pub fn new(target: String) -> Result<Self> {
        let worker_id = format!("worker-{}", fastrand::u64(..));
        let context = zmq::Context::new();
        
        Ok(Self {
            worker_id,
            context,
            target,
        })
    }

    pub fn run(&self, master_addr: &str) -> Result<()> {
        let dealer = self.context.socket(zmq::DEALER)?;
        dealer.set_identity(self.worker_id.as_bytes())?;
        dealer.connect(&format!("tcp://{}:5555", master_addr))?;
        dealer.set_rcvtimeo(1000)?;
        
        let subscriber = self.context.socket(zmq::SUB)?;
        subscriber.connect(&format!("tcp://{}:5556", master_addr))?;
        subscriber.set_subscribe(b"")?;
        subscriber.set_rcvtimeo(100)?;
        
        println!("Worker {} connected to {}", self.worker_id, master_addr);
        
        let hello = MessageType::Hello { worker_id: self.worker_id.clone() };
        let serialized = serde_json::to_vec(&hello)?;
        dealer.send(&serialized, 0)?;
        
        let mut last_heartbeat_sent = Instant::now();
        
        loop {
            let mut msg = zmq::Message::new();
            
            match dealer.recv(&mut msg, 0) {
                Ok(_) => {
                    if let Ok(message) = serde_json::from_slice::<MessageType>(msg.as_bytes()) {
                        match message {
                            MessageType::Work { input, task_id } => {
                                let result = self.execute_input(&input)?;
                                let response = MessageType::Result {
                                    worker_id: self.worker_id.clone(),
                                    task_id,
                                    result,
                                };
                                let serialized = serde_json::to_vec(&response)?;
                                dealer.send(&serialized, 0)?;
                            }
                            _ => {}
                        }
                    }
                }
                Err(_) => {}
            }
            
            let mut sub_msg = zmq::Message::new();
            if subscriber.recv(&mut sub_msg, 0).is_ok() {
                if sub_msg.as_bytes() == b"HEARTBEAT_REQ" {
                    let heartbeat = MessageType::Heartbeat {
                        worker_id: self.worker_id.clone(),
                    };
                    let serialized = serde_json::to_vec(&heartbeat)?;
                    dealer.send(&serialized, 0)?;
                    last_heartbeat_sent = Instant::now();
                }
            }
            
            if last_heartbeat_sent.elapsed() >= Duration::from_millis(HEARTBEAT_INTERVAL_MS) {
                let heartbeat = MessageType::Heartbeat {
                    worker_id: self.worker_id.clone(),
                };
                let serialized = serde_json::to_vec(&heartbeat)?;
                dealer.send(&serialized, 0)?;
                last_heartbeat_sent = Instant::now();
            }
        }
    }

    fn execute_input(&self, input: &[u8]) -> Result<WorkerResult> {
        let start = Instant::now();
        
        let has_new_coverage = fastrand::u8(..) < 5;
        
        let coverage = if has_new_coverage {
            let mut cov = CoverageMap::new();
            for _ in 0..fastrand::usize(..100) {
                let idx = fastrand::usize(..cov.map.len());
                cov.map[idx] = fastrand::u8(1..);
            }
            Some(cov)
        } else {
            None
        };
        
        let crash = if fastrand::u8(..) < 1 {
            Some(CrashInfo {
                stack_trace: "0xdeadbeef\n0xcafebabe".to_string(),
                signal: 11,
                signal_name: "SIGSEGV".to_string(),
            })
        } else {
            None
        };
        
        let exec_time = start.elapsed().as_micros() as u64;
        
        Ok(WorkerResult {
            input: input.to_vec(),
            has_new_coverage,
            coverage,
            crash,
            exec_time,
        })
    }
}
