pub mod raft_service {
    tonic::include_proto!("raft");
}

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tonic::{Request, Response, Status};
use tracing::info;
use serde_json::Value;

use crate::raft::{RaftNode, LogEntry, RaftState};
use raft_service::raft_service_server::{RaftService, RaftServiceServer};

pub use raft_service::raft_service_client::RaftServiceClient;

pub struct RaftServiceImpl {
    node: Arc<RaftNode>,
    kv_store: Arc<RwLock<HashMap<String, String>>>,
}

impl RaftServiceImpl {
    pub fn new(node: Arc<RaftNode>, kv_store: Arc<RwLock<HashMap<String, String>>>) -> Self {
        Self { node, kv_store }
    }
}

#[tonic::async_trait]
impl RaftService for RaftServiceImpl {
    async fn request_vote(
        &self,
        request: Request<raft_service::RequestVoteRequest>,
    ) -> Result<Response<raft_service::RequestVoteResponse>, Status> {
        let req = request.into_inner();
        let (term, vote_granted) = self.node.request_vote(
            req.term,
            req.candidate_id,
            req.last_log_index,
            req.last_log_term,
        ).await;

        Ok(Response::new(raft_service::RequestVoteResponse {
            term,
            vote_granted,
        }))
    }

    async fn append_entries(
        &self,
        request: Request<raft_service::AppendEntriesRequest>,
    ) -> Result<Response<raft_service::AppendEntriesResponse>, Status> {
        let req = request.into_inner();
        let entries: Vec<LogEntry> = req.entries.into_iter()
            .map(|e| LogEntry {
                term: e.term,
                index: e.index,
                command: e.command,
            })
            .collect();

        let (term, success, last_log_index, conflict_term, conflict_index) = self.node.append_entries(
            req.term,
            req.leader_id,
            req.prev_log_index,
            req.prev_log_term,
            entries,
            req.leader_commit,
        ).await;

        Ok(Response::new(raft_service::AppendEntriesResponse {
            term,
            success,
            last_log_index,
            conflict_term,
            conflict_index,
        }))
    }

    async fn install_snapshot(
        &self,
        request: Request<raft_service::InstallSnapshotRequest>,
    ) -> Result<Response<raft_service::InstallSnapshotResponse>, Status> {
        let req = request.into_inner();
        let (term, success) = self.node.install_snapshot(
            req.term,
            req.leader_id,
            req.last_included_index,
            req.last_included_term,
            req.data,
        ).await;

        Ok(Response::new(raft_service::InstallSnapshotResponse {
            term,
            success,
        }))
    }

    async fn put(
        &self,
        request: Request<raft_service::PutRequest>,
    ) -> Result<Response<raft_service::PutResponse>, Status> {
        let req = request.into_inner();
        
        if !self.node.is_leader().await {
            return Err(Status::failed_precondition("Not leader"));
        }

        let command = serde_json::json!({
            "op": "put",
            "key": req.key,
            "value": req.value,
        }).to_string();

        let success = self.node.propose_command(command).await;

        Ok(Response::new(raft_service::PutResponse { success }))
    }

    async fn get(
        &self,
        request: Request<raft_service::GetRequest>,
    ) -> Result<Response<raft_service::GetResponse>, Status> {
        let req = request.into_inner();
        
        if !self.node.is_leader().await {
            return Err(Status::failed_precondition("Not leader"));
        }
        
        if !self.node.safe_to_read().await {
            return Err(Status::unavailable("Not safe to read yet"));
        }
        
        let store = self.kv_store.read().await;
        
        match store.get(&req.key) {
            Some(value) => Ok(Response::new(raft_service::GetResponse {
                value: value.clone(),
                found: true,
            })),
            None => Ok(Response::new(raft_service::GetResponse {
                value: String::new(),
                found: false,
            })),
        }
    }

    async fn delete(
        &self,
        request: Request<raft_service::DeleteRequest>,
    ) -> Result<Response<raft_service::DeleteResponse>, Status> {
        let req = request.into_inner();
        
        if !self.node.is_leader().await {
            return Err(Status::failed_precondition("Not leader"));
        }

        let command = serde_json::json!({
            "op": "delete",
            "key": req.key,
        }).to_string();

        let success = self.node.propose_command(command).await;

        Ok(Response::new(raft_service::DeleteResponse { success }))
    }

    async fn add_peer(
        &self,
        request: Request<raft_service::AddPeerRequest>,
    ) -> Result<Response<raft_service::AddPeerResponse>, Status> {
        let req = request.into_inner();
        
        match self.node.add_peer(req.peer_id, req.peer_address).await {
            Ok(success) => Ok(Response::new(raft_service::AddPeerResponse {
                success,
                message: if success { "Peer added successfully".to_string() } else { "Failed to add peer".to_string() },
            })),
            Err(e) => Err(Status::invalid_argument(e)),
        }
    }

    async fn remove_peer(
        &self,
        request: Request<raft_service::RemovePeerRequest>,
    ) -> Result<Response<raft_service::RemovePeerResponse>, Status> {
        let req = request.into_inner();
        
        match self.node.remove_peer(req.peer_id).await {
            Ok(success) => Ok(Response::new(raft_service::RemovePeerResponse {
                success,
                message: if success { "Peer removed successfully".to_string() } else { "Failed to remove peer".to_string() },
            })),
            Err(e) => Err(Status::invalid_argument(e)),
        }
    }

    async fn list_peers(
        &self,
        request: Request<raft_service::ListPeersRequest>,
    ) -> Result<Response<raft_service::ListPeersResponse>, Status> {
        let _req = request.into_inner();
        
        let config = self.node.get_cluster_config().await;
        let leader_id = self.node.get_leader_id().await;
        let state = self.node.get_state().await;
        
        let mut peers = Vec::new();
        
        for (peer_id, peer_address) in &config.servers {
            peers.push(raft_service::PeerInfo {
                peer_id: peer_id.clone(),
                peer_address: peer_address.clone(),
                is_leader: leader_id.as_ref() == Some(peer_id),
                is_active: true,
            });
        }
        
        Ok(Response::new(raft_service::ListPeersResponse {
            peers,
            leader_id: leader_id.unwrap_or_default(),
        }))
    }
}

pub async fn start_grpc_server(
    node: Arc<RaftNode>,
    kv_store: Arc<RwLock<HashMap<String, String>>>,
    addr: std::net::SocketAddr,
) -> Result<(), Box<dyn std::error::Error>> {
    let service = RaftServiceImpl::new(node, kv_store);
    
    info!("Starting gRPC server on {}", addr);
    
    tonic::transport::Server::builder()
        .add_service(RaftServiceServer::new(service))
        .serve(addr)
        .await?;

    Ok(())
}

pub async fn apply_command(
    entry: LogEntry,
    kv_store: Arc<RwLock<HashMap<String, String>>>,
) {
    if let Ok(cmd) = serde_json::from_str::<Value>(&entry.command) {
        if let Some(op) = cmd.get("op").and_then(|v| v.as_str()) {
            let mut store = kv_store.write().await;
            match op {
                "put" => {
                    if let (Some(key), Some(value)) = (
                        cmd.get("key").and_then(|v| v.as_str()),
                        cmd.get("value").and_then(|v| v.as_str()),
                    ) {
                        store.insert(key.to_string(), value.to_string());
                        info!("Applied PUT: {} = {}", key, value);
                    }
                }
                "delete" => {
                    if let Some(key) = cmd.get("key").and_then(|v| v.as_str()) {
                        store.remove(key);
                        info!("Applied DELETE: {}", key);
                    }
                }
                _ => {}
            }
        }
    }
}
