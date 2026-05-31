use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{RwLock, mpsc};
use tokio::time::timeout;
use rand::Rng;
use tracing::{debug, info, warn, error};
use serde::{Serialize, Deserialize};

use crate::storage::Storage;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RaftState {
    Follower,
    Candidate,
    Leader,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConfigChangeState {
    Stable,
    JointConsensus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterConfig {
    pub servers: HashMap<String, String>,
}

impl ClusterConfig {
    pub fn new() -> Self {
        Self {
            servers: HashMap::new(),
        }
    }

    pub fn from_peers(id: &str, peers: &[String]) -> Self {
        let mut servers = HashMap::new();
        for peer in peers {
            servers.insert(peer.clone(), peer.clone());
        }
        if !servers.contains_key(id) {
            servers.insert(id.to_string(), String::new());
        }
        Self { servers }
    }

    pub fn all_nodes(&self) -> Vec<String> {
        self.servers.keys().cloned().collect()
    }

    pub fn contains(&self, id: &str) -> bool {
        self.servers.contains_key(id)
    }

    pub fn majority(&self, match_indices: &HashMap<String, u64>, last_log_index: u64) -> u64 {
        let mut indices: Vec<u64> = self.servers.iter()
            .filter_map(|(id, _)| match_indices.get(id).cloned())
            .collect();
        
        if !self.servers.contains_key(&String::new()) {
            indices.push(last_log_index);
        }
        
        indices.sort();
        let n = indices.len();
        if n == 0 {
            0
        } else {
            indices[n / 2]
        }
    }

    pub fn has_majority(&self, votes: usize) -> bool {
        let total = self.servers.len();
        votes > total / 2 + 1
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub term: u64,
    pub index: u64,
    pub command: String,
}

#[derive(Debug, Clone)]
pub struct RaftConfig {
    pub id: String,
    pub peer_addresses: HashMap<String, String>,
    pub election_timeout_min: u64,
    pub election_timeout_max: u64,
    pub heartbeat_interval: u64,
}

impl RaftConfig {
    pub fn peers(&self) -> Vec<String> {
        self.peer_addresses.keys()
            .filter(|id| id.as_str() != self.id)
            .cloned()
            .collect()
    }

    pub fn peer_list(&self) -> Vec<String> {
        self.peer_addresses.values().cloned().collect()
    }
}

impl Default for RaftConfig {
    fn default() -> Self {
        Self {
            id: String::new(),
            peer_addresses: HashMap::new(),
            election_timeout_min: 150,
            election_timeout_max: 300,
            heartbeat_interval: 50,
        }
    }
}

pub struct RaftNode {
    pub config: RaftConfig,
    pub state: RwLock<RaftStateInner>,
    pub storage: Arc<dyn Storage + Send + Sync>,
    pub apply_tx: mpsc::Sender<LogEntry>,
}

pub struct RaftStateInner {
    pub state: RaftState,
    pub current_term: u64,
    pub voted_for: Option<String>,
    pub log: Vec<LogEntry>,
    pub commit_index: u64,
    pub last_applied: u64,
    pub next_index: HashMap<String, u64>,
    pub match_index: HashMap<String, u64>,
    pub leader_id: Option<String>,
    pub last_election_time: std::time::Instant,
    pub last_heartbeat_time: std::time::Instant,
    pub read_index: u64,
    pub config_change_state: ConfigChangeState,
    pub current_config: ClusterConfig,
    pub old_config: Option<ClusterConfig>,
    pub pending_config_change: bool,
}

impl RaftNode {
    pub fn new(
        config: RaftConfig,
        storage: Arc<dyn Storage + Send + Sync>,
        apply_tx: mpsc::Sender<LogEntry>,
    ) -> Self {
        let log = storage.load_logs().unwrap_or_default();
        let current_term = storage.load_term().unwrap_or(0);
        let voted_for = storage.load_voted_for().unwrap_or(None);

        let mut next_index = HashMap::new();
        let mut match_index = HashMap::new();
        let last_log_index = log.last().map(|e| e.index).unwrap_or(0);
        
        let peers = config.peers();
        for peer in &peers {
            next_index.insert(peer.clone(), last_log_index + 1);
            match_index.insert(peer.clone(), 0);
        }

        let current_config = ClusterConfig::from_peers(&config.id, &peers);

        let state_inner = RaftStateInner {
            state: RaftState::Follower,
            current_term,
            voted_for,
            log,
            commit_index: 0,
            last_applied: 0,
            next_index,
            match_index,
            leader_id: None,
            last_election_time: std::time::Instant::now(),
            last_heartbeat_time: std::time::Instant::now(),
            read_index: 0,
            config_change_state: ConfigChangeState::Stable,
            current_config,
            old_config: None,
            pending_config_change: false,
        };

        Self {
            config,
            state: RwLock::new(state_inner),
            storage,
            apply_tx,
        }
    }

    pub async fn request_vote(
        &self,
        term: u64,
        candidate_id: String,
        last_log_index: u64,
        last_log_term: u64,
    ) -> (u64, bool) {
        let mut state = self.state.write().await;

        if term < state.current_term {
            return (state.current_term, false);
        }

        if term > state.current_term {
            state.current_term = term;
            state.voted_for = None;
            state.state = RaftState::Follower;
            self.storage.save_term(term).ok();
        }

        let last_log = state.log.last();
        let our_last_log_index = last_log.map(|e| e.index).unwrap_or(0);
        let our_last_log_term = last_log.map(|e| e.term).unwrap_or(0);

        let log_ok = (last_log_term > our_last_log_term)
            || (last_log_term == our_last_log_term && last_log_index >= our_last_log_index);

        let can_vote = state.voted_for.is_none() || state.voted_for.as_ref() == Some(&candidate_id);

        if log_ok && can_vote {
            state.voted_for = Some(candidate_id);
            state.last_election_time = std::time::Instant::now();
            self.storage.save_voted_for(state.voted_for.clone()).ok();
            (state.current_term, true)
        } else {
            (state.current_term, false)
        }
    }

    pub async fn append_entries(
        &self,
        term: u64,
        leader_id: String,
        prev_log_index: u64,
        prev_log_term: u64,
        entries: Vec<LogEntry>,
        leader_commit: u64,
    ) -> (u64, bool, u64, u64, u64) {
        let mut state = self.state.write().await;

        let last_log_index = state.log.last().map(|e| e.index).unwrap_or(0);

        if term < state.current_term {
            return (state.current_term, false, last_log_index, 0, 0);
        }

        state.current_term = term;
        state.state = RaftState::Follower;
        state.leader_id = Some(leader_id);
        state.last_heartbeat_time = std::time::Instant::now();
        self.storage.save_term(term).ok();

        if prev_log_index > 0 {
            let prev_entry = state.log.iter().find(|e| e.index == prev_log_index);
            match prev_entry {
                Some(entry) if entry.term != prev_log_term => {
                    let mut conflict_term = entry.term;
                    let mut conflict_index = prev_log_index;
                    
                    for e in state.log.iter().rev() {
                        if e.term == conflict_term {
                            conflict_index = e.index;
                        } else {
                            break;
                        }
                    }
                    
                    let idx = state.log.iter().position(|e| e.index == prev_log_index).unwrap();
                    state.log.truncate(idx);
                    self.storage.save_logs(&state.log).ok();
                    
                    let new_last_index = state.log.last().map(|e| e.index).unwrap_or(0);
                    return (state.current_term, false, new_last_index, conflict_term, conflict_index);
                }
                None => {
                    let our_last_term = state.log.last().map(|e| e.term).unwrap_or(0);
                    return (state.current_term, false, last_log_index, our_last_term, last_log_index + 1);
                }
                _ => {}
            }
        }

        for entry in entries {
            if let Some(existing) = state.log.iter().find(|e| e.index == entry.index) {
                if existing.term != entry.term {
                    let idx = state.log.iter().position(|e| e.index == entry.index).unwrap();
                    state.log.truncate(idx);
                    state.log.push(entry.clone());
                }
            } else {
                state.log.push(entry.clone());
            }
        }
        self.storage.save_logs(&state.log).ok();

        if leader_commit > state.commit_index {
            let last_new_index = state.log.last().map(|e| e.index).unwrap_or(0);
            let new_commit = std::cmp::min(leader_commit, last_new_index);
            if new_commit > state.commit_index {
                state.commit_index = new_commit;
                self.apply_committed_entries(&mut state).await;
            }
        }

        (state.current_term, true, state.log.last().map(|e| e.index).unwrap_or(0), 0, 0)
    }

    pub async fn install_snapshot(
        &self,
        term: u64,
        leader_id: String,
        last_included_index: u64,
        last_included_term: u64,
        data: Vec<u8>,
    ) -> (u64, bool) {
        let mut state = self.state.write().await;

        if term < state.current_term {
            return (state.current_term, false);
        }

        state.current_term = term;
        state.state = RaftState::Follower;
        state.leader_id = Some(leader_id);
        state.last_heartbeat_time = std::time::Instant::now();

        if last_included_index <= state.commit_index {
            return (state.current_term, true);
        }

        self.storage.save_snapshot(last_included_index, last_included_term, &data).ok();

        state.log.retain(|e| e.index > last_included_index);
        if state.log.is_empty() {
            state.log.push(LogEntry {
                term: last_included_term,
                index: last_included_index,
                command: String::new(),
            });
        }

        state.commit_index = last_included_index;
        state.last_applied = last_included_index;

        (state.current_term, true)
    }

    async fn apply_committed_entries(&self, state: &mut RaftStateInner) {
        while state.last_applied < state.commit_index {
            state.last_applied += 1;
            if let Some(entry) = state.log.iter().find(|e| e.index == state.last_applied) {
                if !entry.command.is_empty() {
                    if let Ok(cmd) = serde_json::from_str::<serde_json::Value>(&entry.command) {
                        if let Some(op) = cmd.get("op").and_then(|v| v.as_str()) {
                            if op == "config_change" {
                                self.apply_config_change(state, &cmd);
                                
                                if state.config_change_state == ConfigChangeState::JointConsensus {
                                    let new_config_command = serde_json::json!({
                                        "op": "config_change",
                                        "type": "new_config",
                                        "new_config": state.current_config.servers,
                                    }).to_string();
                                    
                                    let new_index = state.log.last().map(|e| e.index).unwrap_or(0) + 1;
                                    let new_entry = LogEntry {
                                        term: state.current_term,
                                        index: new_index,
                                        command: new_config_command,
                                    };
                                    
                                    state.log.push(new_entry);
                                    self.storage.save_logs(&state.log).ok();
                                }
                                continue;
                            }
                        }
                    }
                    
                    let _ = self.apply_tx.send(entry.clone()).await;
                }
            }
        }
    }

    pub async fn get_state(&self) -> RaftState {
        self.state.read().await.state
    }

    pub async fn get_leader_id(&self) -> Option<String> {
        self.state.read().await.leader_id.clone()
    }

    pub async fn is_leader(&self) -> bool {
        self.state.read().await.state == RaftState::Leader
    }

    pub async fn get_last_log_index(&self) -> u64 {
        self.state.read().await.log.last().map(|e| e.index).unwrap_or(0)
    }

    pub async fn get_last_log_term(&self) -> u64 {
        self.state.read().await.log.last().map(|e| e.term).unwrap_or(0)
    }

    pub async fn get_current_term(&self) -> u64 {
        self.state.read().await.current_term
    }

    pub async fn propose_command(&self, command: String) -> bool {
        let mut state = self.state.write().await;
        
        if state.state != RaftState::Leader {
            return false;
        }

        if state.pending_config_change {
            return false;
        }

        let new_index = state.log.last().map(|e| e.index).unwrap_or(0) + 1;
        let entry = LogEntry {
            term: state.current_term,
            index: new_index,
            command,
        };

        state.log.push(entry.clone());
        self.storage.save_logs(&state.log).ok();

        true
    }

    pub async fn add_peer(&self, peer_id: String, peer_address: String) -> Result<bool, String> {
        let mut state = self.state.write().await;
        
        if state.state != RaftState::Leader {
            return Err("Not leader".to_string());
        }

        if state.pending_config_change {
            return Err("Another config change in progress".to_string());
        }

        if state.current_config.contains(&peer_id) {
            return Err("Peer already exists".to_string());
        }

        let mut new_config = state.current_config.clone();
        new_config.servers.insert(peer_id.clone(), peer_address.clone());

        let command = serde_json::json!({
            "op": "config_change",
            "type": "joint_consensus",
            "new_config": new_config.servers,
        }).to_string();

        let new_index = state.log.last().map(|e| e.index).unwrap_or(0) + 1;
        let entry = LogEntry {
            term: state.current_term,
            index: new_index,
            command,
        };

        state.old_config = Some(state.current_config.clone());
        state.current_config = new_config;
        state.config_change_state = ConfigChangeState::JointConsensus;
        state.pending_config_change = true;

        state.log.push(entry);
        self.storage.save_logs(&state.log).ok();

        state.next_index.insert(peer_id.clone(), 1);
        state.match_index.insert(peer_id.clone(), 0);

        self.config.peer_addresses.insert(peer_id, peer_address);

        info!("Started joint consensus to add peer");
        Ok(true)
    }

    pub async fn remove_peer(&self, peer_id: String) -> Result<bool, String> {
        let mut state = self.state.write().await;
        
        if state.state != RaftState::Leader {
            return Err("Not leader".to_string());
        }

        if state.pending_config_change {
            return Err("Another config change in progress".to_string());
        }

        if !state.current_config.contains(&peer_id) {
            return Err("Peer does not exist".to_string());
        }

        if peer_id == self.config.id {
            return Err("Cannot remove self".to_string());
        }

        let mut new_config = state.current_config.clone();
        new_config.servers.remove(&peer_id);

        let command = serde_json::json!({
            "op": "config_change",
            "type": "joint_consensus",
            "new_config": new_config.servers,
        }).to_string();

        let new_index = state.log.last().map(|e| e.index).unwrap_or(0) + 1;
        let entry = LogEntry {
            term: state.current_term,
            index: new_index,
            command,
        };

        state.old_config = Some(state.current_config.clone());
        state.current_config = new_config;
        state.config_change_state = ConfigChangeState::JointConsensus;
        state.pending_config_change = true;

        state.log.push(entry);
        self.storage.save_logs(&state.log).ok();

        info!("Started joint consensus to remove peer: {}", peer_id);
        Ok(true)
    }

    pub async fn get_cluster_config(&self) -> ClusterConfig {
        self.state.read().await.current_config.clone()
    }

    pub async fn get_config_change_state(&self) -> ConfigChangeState {
        self.state.read().await.config_change_state
    }

    fn apply_config_change(&self, state: &mut RaftStateInner, command: &serde_json::Value) {
        if let Some(change_type) = command.get("type").and_then(|v| v.as_str()) {
            match change_type {
                "joint_consensus" => {
                    if let Some(new_servers) = command.get("new_config") {
                        if let Ok(servers) = serde_json::from_value::<HashMap<String, String>>(new_servers.clone()) {
                            state.old_config = Some(state.current_config.clone());
                            state.current_config = ClusterConfig { servers };
                            state.config_change_state = ConfigChangeState::JointConsensus;
                            state.pending_config_change = true;
                            info!("Entered joint consensus state");
                        }
                    }
                }
                "new_config" => {
                    if let Some(new_servers) = command.get("new_config") {
                        if let Ok(servers) = serde_json::from_value::<HashMap<String, String>>(new_servers.clone()) {
                            state.current_config = ClusterConfig { servers };
                            state.old_config = None;
                            state.config_change_state = ConfigChangeState::Stable;
                            state.pending_config_change = false;
                            info!("Transitioned to new stable configuration");
                        }
                    }
                }
                _ => {}
            }
        }
    }

    pub async fn on_become_leader(&self) {
        let mut state = self.state.write().await;
        
        let last_log_index = state.log.last().map(|e| e.index).unwrap_or(0);
        let noop_entry = LogEntry {
            term: state.current_term,
            index: last_log_index + 1,
            command: String::new(),
        };
        
        state.log.push(noop_entry);
        state.read_index = last_log_index + 1;
        
        self.storage.save_logs(&state.log).ok();
        
        for peer in &self.config.peers {
            state.next_index.insert(peer.clone(), last_log_index + 2);
            state.match_index.insert(peer.clone(), 0);
        }
    }

    pub async fn safe_to_read(&self) -> bool {
        let state = self.state.read().await;
        
        if state.state != RaftState::Leader {
            return false;
        }
        
        let last_log_index = state.log.last().map(|e| e.index).unwrap_or(0);
        
        let confirmed = if state.config_change_state == ConfigChangeState::JointConsensus {
            if let Some(ref old_config) = state.old_config {
                let new_config_commit = state.current_config.majority(&state.match_index, last_log_index);
                let old_config_commit = old_config.majority(&state.match_index, last_log_index);
                std::cmp::min(new_config_commit, old_config_commit)
            } else {
                state.current_config.majority(&state.match_index, last_log_index)
            }
        } else {
            state.current_config.majority(&state.match_index, last_log_index)
        };
        
        confirmed >= state.read_index && state.last_applied >= state.read_index
    }

    pub async fn update_read_index(&self) {
        let mut state = self.state.write().await;
        if state.state == RaftState::Leader {
            state.read_index = state.log.last().map(|e| e.index).unwrap_or(0);
        }
    }
}

pub async fn run_election_timeout(node: Arc<RaftNode>, mut stop_rx: mpsc::Receiver<()>) {
    let mut rng = rand::thread_rng();
    
    loop {
        let timeout_ms = rng.gen_range(
            node.config.election_timeout_min..node.config.election_timeout_max
        );
        
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_millis(timeout_ms)) => {
                let should_start_election = {
                    let state = node.state.read().await;
                    state.state != RaftState::Leader
                        && state.last_heartbeat_time.elapsed().as_millis() as u64 > timeout_ms
                };

                if should_start_election {
                    start_election(node.clone()).await;
                }
            }
            _ = stop_rx.recv() => {
                return;
            }
        }
    }
}

async fn start_election(node: Arc<RaftNode>) {
    let (last_log_index, last_log_term, term, peer_addresses, old_config_opt, new_config) = {
        let mut state = node.state.write().await;
        
        if state.state == RaftState::Leader {
            return;
        }

        state.state = RaftState::Candidate;
        state.current_term += 1;
        state.voted_for = Some(node.config.id.clone());
        state.last_election_time = std::time::Instant::now();

        node.storage.save_term(state.current_term).ok();
        node.storage.save_voted_for(state.voted_for.clone()).ok();

        let mut all_peers: Vec<String> = node.config.peers();
        let mut all_addresses: Vec<String> = all_peers.iter()
            .filter_map(|id| node.config.peer_addresses.get(id).cloned())
            .collect();

        if state.config_change_state == ConfigChangeState::JointConsensus {
            if let Some(ref old_config) = state.old_config {
                for (peer_id, _) in &old_config.servers {
                    if peer_id != &node.config.id && !all_peers.contains(peer_id) {
                        all_peers.push(peer_id.clone());
                        if let Some(addr) = node.config.peer_addresses.get(peer_id) {
                            all_addresses.push(addr.clone());
                        }
                    }
                }
            }
        }

        (
            state.log.last().map(|e| e.index).unwrap_or(0),
            state.log.last().map(|e| e.term).unwrap_or(0),
            state.current_term,
            all_addresses,
            state.old_config.clone(),
            state.current_config.clone(),
        )
    };

    info!("Node {} starting election for term {}", node.config.id, term);

    let votes = Arc::new(std::sync::atomic::AtomicUsize::new(1));
    let elected = Arc::new(std::sync::atomic::AtomicBool::new(false));
    
    let in_joint_consensus = old_config_opt.is_some();
    let old_config = old_config_opt.clone();

    for peer_addr in peer_addresses {
        let node_clone = node.clone();
        let peer_clone = peer_addr.clone();
        let votes_clone = votes.clone();
        let elected_clone = elected.clone();
        let old_config_clone = old_config.clone();
        let new_config_clone = new_config.clone();
        tokio::spawn(async move {
            let result = timeout(
                Duration::from_secs(1),
                request_vote_from_peer(
                    &peer_clone,
                    term,
                    node_clone.config.id.clone(),
                    last_log_index,
                    last_log_term,
                ),
            ).await;

            if let Ok(Some((peer_term, vote_granted))) = result {
                let mut state = node_clone.state.write().await;
                
                if peer_term > state.current_term {
                    state.current_term = peer_term;
                    state.state = RaftState::Follower;
                    state.voted_for = None;
                    node_clone.storage.save_term(peer_term).ok();
                    return;
                }

                if peer_term == term && vote_granted && state.state == RaftState::Candidate && !elected_clone.load(std::sync::atomic::Ordering::SeqCst) {
                    let current_votes = votes_clone.fetch_add(1, std::sync::atomic::Ordering::SeqCst) + 1;
                    
                    let can_lead = if in_joint_consensus {
                        if let Some(ref old_cfg) = old_config_clone {
                            let new_total = new_config_clone.servers.len();
                            let old_total = old_cfg.servers.len();
                            let new_majority = new_total / 2 + 1;
                            let old_majority = old_total / 2 + 1;
                            current_votes >= new_majority && current_votes >= old_majority
                        } else {
                            let total = new_config_clone.servers.len();
                            current_votes >= total / 2 + 1
                        }
                    } else {
                        let total = new_config_clone.servers.len();
                        current_votes >= total / 2 + 1
                    };

                    if can_lead && !elected_clone.swap(true, std::sync::atomic::Ordering::SeqCst) {
                        state.state = RaftState::Leader;
                        state.leader_id = Some(node_clone.config.id.clone());
                        info!("Node {} elected leader for term {}", node_clone.config.id, term);
                        
                        let last_log_idx = state.log.last().map(|e| e.index).unwrap_or(0);
                        let noop_entry = LogEntry {
                            term: state.current_term,
                            index: last_log_idx + 1,
                            command: String::new(),
                        };
                        
                        state.log.push(noop_entry);
                        state.read_index = last_log_idx + 1;
                        
                        node_clone.storage.save_logs(&state.log).ok();
                        
                        let peers = node_clone.config.peers();
                        for peer in &peers {
                            state.next_index.insert(peer.clone(), last_log_idx + 2);
                            state.match_index.insert(peer.clone(), 0);
                        }
                    }
                }
            }
        });
    }
}

async fn request_vote_from_peer(
    peer: &str,
    term: u64,
    candidate_id: String,
    last_log_index: u64,
    last_log_term: u64,
) -> Option<(u64, bool)> {
    use crate::server::raft_service::raft_service_client::RaftServiceClient;

    let client = RaftServiceClient::connect(format!("http://{}", peer)).await.ok()?;
    
    let request = tonic::Request::new(crate::server::raft_service::RequestVoteRequest {
        term,
        candidate_id,
        last_log_index,
        last_log_term,
    });

    let response = client.request_vote(request).await.ok()?;
    let inner = response.into_inner();
    Some((inner.term, inner.vote_granted))
}

pub async fn run_heartbeat(node: Arc<RaftNode>, mut stop_rx: mpsc::Receiver<()>) {
    let interval = Duration::from_millis(node.config.heartbeat_interval);
    
    loop {
        tokio::select! {
            _ = tokio::time::sleep(interval) => {
                if node.is_leader().await {
                    send_heartbeats(node.clone()).await;
                }
            }
            _ = stop_rx.recv() => {
                return;
            }
        }
    }
}

async fn send_heartbeats(node: Arc<RaftNode>) {
    let peers = node.config.peers();
    
    for peer_id in &peers {
        let peer_address = node.config.peer_addresses.get(peer_id).cloned().unwrap_or_default();
        if peer_address.is_empty() {
            continue;
        }
        let peer_clone = peer_address.clone();
        let node_clone = node.clone();
        
        tokio::spawn(async move {
            send_append_entries(node_clone, &peer_clone).await;
        });
    }
}

async fn send_append_entries(node: Arc<RaftNode>, peer: &str) {
    let (term, prev_log_index, prev_log_term, entries, leader_commit) = {
        let state = node.state.read().await;
        
        if state.state != RaftState::Leader {
            return;
        }

        let next_idx = *state.next_index.get(peer).unwrap_or(&1);
        let prev_index = next_idx - 1;
        
        let prev_term = if prev_index == 0 {
            0
        } else {
            state.log.iter()
                .find(|e| e.index == prev_index)
                .map(|e| e.term)
                .unwrap_or(0)
        };

        let entries_to_send: Vec<LogEntry> = state.log.iter()
            .filter(|e| e.index >= next_idx)
            .cloned()
            .collect();

        (
            state.current_term,
            prev_index,
            prev_term,
            entries_to_send,
            state.commit_index,
        )
    };

    let result = send_append_entries_to_peer(
        peer,
        term,
        node.config.id.clone(),
        prev_log_index,
        prev_log_term,
        entries,
        leader_commit,
    ).await;

    if let Some((peer_term, success, last_log_index, conflict_term, conflict_index)) = result {
        let mut state = node.state.write().await;
        
        if peer_term > state.current_term {
            state.current_term = peer_term;
            state.state = RaftState::Follower;
            state.leader_id = None;
            node.storage.save_term(peer_term).ok();
            return;
        }

        if peer_term != term {
            return;
        }

        if success {
            state.next_index.insert(peer.to_string(), last_log_index + 1);
            state.match_index.insert(peer.to_string(), last_log_index);
            
            let last_log_index_val = state.log.last().map(|e| e.index).unwrap_or(0);
            
            let mut new_commit = if state.config_change_state == ConfigChangeState::JointConsensus {
                if let Some(ref old_config) = state.old_config {
                    let new_config_majority = state.current_config.majority(&state.match_index, last_log_index_val);
                    let old_config_majority = old_config.majority(&state.match_index, last_log_index_val);
                    std::cmp::min(new_config_majority, old_config_majority)
                } else {
                    state.current_config.majority(&state.match_index, last_log_index_val)
                }
            } else {
                state.current_config.majority(&state.match_index, last_log_index_val)
            };
            
            if new_commit > state.commit_index {
                if let Some(entry) = state.log.iter().find(|e| e.index == new_commit) {
                    if entry.term == state.current_term || state.config_change_state == ConfigChangeState::JointConsensus {
                        state.commit_index = new_commit;
                        node.apply_committed_entries(&mut state).await;
                    }
                }
            }
        } else {
            let current_next = *state.next_index.get(peer).unwrap_or(&1);
            
            if conflict_term > 0 {
                let mut new_next = conflict_index;
                
                if let Some(conflict_entry) = state.log.iter().find(|e| e.term == conflict_term) {
                    let last_of_term = state.log.iter()
                        .filter(|e| e.term == conflict_term)
                        .map(|e| e.index)
                        .max()
                        .unwrap_or(0);
                    new_next = last_of_term + 1;
                } else {
                    new_next = conflict_index;
                }
                
                if new_next < 1 {
                    new_next = 1;
                }
                if new_next < current_next {
                    state.next_index.insert(peer.to_string(), new_next);
                }
            } else if current_next > 1 {
                state.next_index.insert(peer.to_string(), current_next - 1);
            }
        }
    }
}

async fn send_append_entries_to_peer(
    peer: &str,
    term: u64,
    leader_id: String,
    prev_log_index: u64,
    prev_log_term: u64,
    entries: Vec<LogEntry>,
    leader_commit: u64,
) -> Option<(u64, bool, u64, u64, u64)> {
    use crate::server::raft_service::raft_service_client::RaftServiceClient;

    let client = RaftServiceClient::connect(format!("http://{}", peer)).await.ok()?;

    let proto_entries = entries.into_iter()
        .map(|e| crate::server::raft_service::LogEntry {
            term: e.term,
            index: e.index,
            command: e.command,
        })
        .collect();

    let request = tonic::Request::new(crate::server::raft_service::AppendEntriesRequest {
        term,
        leader_id,
        prev_log_index,
        prev_log_term,
        entries: proto_entries,
        leader_commit,
    });

    let response = client.append_entries(request).await.ok()?;
    let inner = response.into_inner();
    Some((inner.term, inner.success, inner.last_log_index, inner.conflict_term, inner.conflict_index))
}
