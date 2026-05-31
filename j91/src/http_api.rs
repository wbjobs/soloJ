use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, delete},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

use crate::raft::RaftNode;

#[derive(Clone)]
pub struct AppState {
    pub node: Arc<RaftNode>,
    pub kv_store: Arc<RwLock<HashMap<String, String>>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PutRequest {
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PutResponse {
    pub success: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetResponse {
    pub value: String,
    pub found: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteResponse {
    pub success: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatusResponse {
    pub state: String,
    pub term: u64,
    pub leader: Option<String>,
    pub is_leader: bool,
    pub last_log_index: u64,
    pub commit_index: u64,
    pub config_change_state: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddPeerRequest {
    pub peer_id: String,
    pub peer_address: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddPeerResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemovePeerRequest {
    pub peer_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RemovePeerResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PeerInfoResponse {
    pub peer_id: String,
    pub peer_address: String,
    pub is_leader: bool,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListPeersResponse {
    pub peers: Vec<PeerInfoResponse>,
    pub leader_id: String,
}

pub async fn put_handler(
    State(state): State<AppState>,
    Path(key): Path<String>,
    Json(request): Json<PutRequest>,
) -> impl IntoResponse {
    if !state.node.is_leader().await {
        return (
            StatusCode::PRECONDITION_FAILED,
            Json(PutResponse { success: false }),
        );
    }

    let command = serde_json::json!({
        "op": "put",
        "key": key,
        "value": request.value,
    }).to_string();

    let success = state.node.propose_command(command).await;

    (
        if success { StatusCode::OK } else { StatusCode::INTERNAL_SERVER_ERROR },
        Json(PutResponse { success }),
    )
}

pub async fn get_handler(
    State(state): State<AppState>,
    Path(key): Path<String>,
) -> impl IntoResponse {
    if !state.node.is_leader().await {
        return (
            StatusCode::PRECONDITION_FAILED,
            Json(GetResponse {
                value: String::new(),
                found: false,
            }),
        );
    }

    if !state.node.safe_to_read().await {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(GetResponse {
                value: String::new(),
                found: false,
            }),
        );
    }

    let store = state.kv_store.read().await;
    
    match store.get(&key) {
        Some(value) => (
            StatusCode::OK,
            Json(GetResponse {
                value: value.clone(),
                found: true,
            }),
        ),
        None => (
            StatusCode::NOT_FOUND,
            Json(GetResponse {
                value: String::new(),
                found: false,
            }),
        ),
    }
}

pub async fn delete_handler(
    State(state): State<AppState>,
    Path(key): Path<String>,
) -> impl IntoResponse {
    if !state.node.is_leader().await {
        return (
            StatusCode::PRECONDITION_FAILED,
            Json(DeleteResponse { success: false }),
        );
    }

    let command = serde_json::json!({
        "op": "delete",
        "key": key,
    }).to_string();

    let success = state.node.propose_command(command).await;

    (
        if success { StatusCode::OK } else { StatusCode::INTERNAL_SERVER_ERROR },
        Json(DeleteResponse { success }),
    )
}

pub async fn status_handler(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let node_state = state.node.get_state().await;
    let state_str = match node_state {
        crate::raft::RaftState::Follower => "follower",
        crate::raft::RaftState::Candidate => "candidate",
        crate::raft::RaftState::Leader => "leader",
    };

    let config_state = state.node.get_config_change_state().await;
    let config_str = match config_state {
        crate::raft::ConfigChangeState::Stable => "stable",
        crate::raft::ConfigChangeState::JointConsensus => "joint_consensus",
    };

    let inner_state = state.node.state.read().await;

    Json(StatusResponse {
        state: state_str.to_string(),
        term: inner_state.current_term,
        leader: inner_state.leader_id.clone(),
        is_leader: state.node.is_leader().await,
        last_log_index: inner_state.log.last().map(|e| e.index).unwrap_or(0),
        commit_index: inner_state.commit_index,
        config_change_state: config_str.to_string(),
    })
}

pub async fn add_peer_handler(
    State(state): State<AppState>,
    Json(request): Json<AddPeerRequest>,
) -> impl IntoResponse {
    if !state.node.is_leader().await {
        return (
            StatusCode::PRECONDITION_FAILED,
            Json(AddPeerResponse {
                success: false,
                message: "Not leader".to_string(),
            }),
        );
    }

    match state.node.add_peer(request.peer_id, request.peer_address).await {
        Ok(success) => (
            if success { StatusCode::OK } else { StatusCode::INTERNAL_SERVER_ERROR },
            Json(AddPeerResponse {
                success,
                message: if success { "Peer added successfully".to_string() } else { "Failed to add peer".to_string() },
            }),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(AddPeerResponse {
                success: false,
                message: e,
            }),
        ),
    }
}

pub async fn remove_peer_handler(
    State(state): State<AppState>,
    Json(request): Json<RemovePeerRequest>,
) -> impl IntoResponse {
    if !state.node.is_leader().await {
        return (
            StatusCode::PRECONDITION_FAILED,
            Json(RemovePeerResponse {
                success: false,
                message: "Not leader".to_string(),
            }),
        );
    }

    match state.node.remove_peer(request.peer_id).await {
        Ok(success) => (
            if success { StatusCode::OK } else { StatusCode::INTERNAL_SERVER_ERROR },
            Json(RemovePeerResponse {
                success,
                message: if success { "Peer removed successfully".to_string() } else { "Failed to remove peer".to_string() },
            }),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(RemovePeerResponse {
                success: false,
                message: e,
            }),
        ),
    }
}

pub async fn list_peers_handler(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let config = state.node.get_cluster_config().await;
    let leader_id = state.node.get_leader_id().await;
    
    let mut peers = Vec::new();
    
    for (peer_id, peer_address) in &config.servers {
        peers.push(PeerInfoResponse {
            peer_id: peer_id.clone(),
            peer_address: peer_address.clone(),
            is_leader: leader_id.as_ref() == Some(peer_id),
            is_active: true,
        });
    }

    Json(ListPeersResponse {
        peers,
        leader_id: leader_id.unwrap_or_default(),
    })
}

pub fn create_router(node: Arc<RaftNode>, kv_store: Arc<RwLock<HashMap<String, String>>>) -> Router {
    let app_state = AppState { node, kv_store };

    Router::new()
        .route("/kv/:key", post(put_handler))
        .route("/kv/:key", get(get_handler))
        .route("/kv/:key", delete(delete_handler))
        .route("/status", get(status_handler))
        .route("/peers", post(add_peer_handler))
        .route("/peers", delete(remove_peer_handler))
        .route("/peers", get(list_peers_handler))
        .with_state(app_state)
}

pub async fn start_http_server(
    node: Arc<RaftNode>,
    kv_store: Arc<RwLock<HashMap<String, String>>>,
    addr: std::net::SocketAddr,
) -> Result<(), Box<dyn std::error::Error>> {
    let app = create_router(node, kv_store);
    
    info!("Starting HTTP server on {}", addr);

    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}
