use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use tracing_subscriber::{self, EnvFilter};
use clap::Parser;

mod raft;
mod storage;
mod server;
mod http_api;

use raft::{RaftNode, RaftConfig};
use storage::WalLog;
use server::{start_grpc_server, apply_command};
use http_api::start_http_server;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long)]
    id: String,

    #[arg(long, value_delimiter = ',')]
    peer_ids: Vec<String>,

    #[arg(long, value_delimiter = ',')]
    peer_addresses: Vec<String>,

    #[arg(long, default_value = "50051")]
    grpc_port: u16,

    #[arg(long, default_value = "8080")]
    http_port: u16,

    #[arg(long, default_value = "./data")]
    data_dir: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let args = Args::parse();

    let id = args.id;
    
    let mut peer_addresses_map = HashMap::new();
    for (i, peer_id) in args.peer_ids.iter().enumerate() {
        if let Some(addr) = args.peer_addresses.get(i) {
            peer_addresses_map.insert(peer_id.clone(), addr.clone());
        }
    }
    
    let grpc_addr = format!("0.0.0.0:{}", args.grpc_port).parse()?;
    let http_addr = format!("0.0.0.0:{}", args.http_port).parse()?;

    let data_dir = format!("{}/{}", args.data_dir, id);

    let storage = Arc::new(WalLog::new(&data_dir)?);

    let kv_store = Arc::new(RwLock::new(HashMap::new()));

    if let Some(loaded_kv) = storage::Snapshot::load_snapshot(storage.as_ref())? {
        *kv_store.write().await.extend(loaded_kv);
    }

    let (apply_tx, mut apply_rx) = mpsc::channel(1000);

    let config = RaftConfig {
        id: id.clone(),
        peer_addresses: peer_addresses_map.clone(),
        election_timeout_min: 150,
        election_timeout_max: 300,
        heartbeat_interval: 50,
    };

    let node = Arc::new(RaftNode::new(config, storage.clone(), apply_tx));

    let kv_store_clone = kv_store.clone();
    tokio::spawn(async move {
        while let Some(entry) = apply_rx.recv().await {
            apply_command(entry, kv_store_clone.clone()).await;
        }
    });

    let (election_stop_tx, election_stop_rx) = mpsc::channel(1);
    let node_clone = node.clone();
    tokio::spawn(async move {
        raft::run_election_timeout(node_clone, election_stop_rx).await;
    });

    let (heartbeat_stop_tx, heartbeat_stop_rx) = mpsc::channel(1);
    let node_clone = node.clone();
    tokio::spawn(async move {
        raft::run_heartbeat(node_clone, heartbeat_stop_rx).await;
    });

    let node_clone = node.clone();
    let kv_store_clone = kv_store.clone();
    let grpc_handle = tokio::spawn(async move {
        if let Err(e) = start_grpc_server(node_clone, kv_store_clone, grpc_addr).await {
            eprintln!("gRPC server error: {}", e);
        }
    });

    let node_clone = node.clone();
    let kv_store_clone = kv_store.clone();
    let http_handle = tokio::spawn(async move {
        if let Err(e) = start_http_server(node_clone, kv_store_clone, http_addr).await {
            eprintln!("HTTP server error: {}", e);
        }
    });

    println!("Raft node started:");
    println!("  ID: {}", id);
    println!("  Peers: {:?}", peers);
    println!("  gRPC: {}", grpc_addr);
    println!("  HTTP: {}", http_addr);
    println!("  Data dir: {}", data_dir);

    tokio::try_join!(grpc_handle, http_handle)?;

    Ok(())
}
