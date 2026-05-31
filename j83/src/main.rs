mod crypto;
mod discovery;
mod transfer;

use anyhow::{Result, Context};
use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use clap::{Parser, Subcommand};
use sha2::Digest;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Parser)]
#[command(name = "p2p-file-transfer")]
#[command(about = "LAN peer-to-peer encrypted file transfer via mDNS discovery")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Send {
        #[arg(help = "File path to send")]
        file: PathBuf,

        #[arg(short, long, default_value = "0.0.0.0", help = "Listen address")]
        listen: String,

        #[arg(short, long, default_value_t = 0, help = "Listen port (0 = auto)")]
        port: u16,

        #[arg(long, default_value_t = 30, help = "Discovery timeout in seconds")]
        timeout: u64,
    },

    Recv {
        #[arg(help = "Secret key provided by the sender")]
        key: String,

        #[arg(short, long, default_value = ".", help = "Output directory")]
        output: PathBuf,

        #[arg(long, default_value_t = 60, help = "Discovery timeout in seconds")]
        timeout: u64,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Send {
            file,
            listen,
            port,
            timeout,
        } => run_sender(file, listen, port, timeout).await,
        Commands::Recv {
            key,
            output,
            timeout,
        } => run_receiver(key, output, timeout).await,
    }
}

async fn run_sender(file: PathBuf, listen: String, port: u16, timeout_secs: u64) -> Result<()> {
    if !file.exists() {
        anyhow::bail!("file not found: {:?}", file);
    }

    let key_material = crypto::generate_key_material();
    let secret_key = BASE64.encode(&key_material.secret_bytes);

    println!("========================================");
    println!("  P2P File Transfer - Sender");
    println!("========================================");
    println!("File to send: {:?}", file);
    println!();
    println!("Share this secret key with the receiver:");
    println!("  {}", secret_key);
    println!();
    println!("Waiting for receiver to connect...");
    println!();

    let listener = tokio::net::TcpListener::bind((listen.as_str(), port)).await
        .context("failed to bind TCP listener")?;
    let local_port = listener.local_addr()?.port();

    let discovery = discovery::DiscoveryService::new()?;
    discovery.register(local_port, &key_material.key_hint)?;

    println!("Listening on {}:{}...", listen, local_port);

    let (mut stream, addr) = tokio::time::timeout(
        Duration::from_secs(timeout_secs),
        listener.accept(),
    )
    .await
    .context("timed out waiting for receiver connection")?
    .context("accept failed")?;

    println!("Connection from {}", addr);

    discovery.unregister()?;

    let handshake = crypto::handshake_sender(&mut stream, &key_material).await?;
    println!("Encrypted handshake completed (session: {})", &handshake.shared_secret_hash[..16]);

    transfer::send_file(&mut stream, &handshake.cipher, &file).await?;

    Ok(())
}

async fn run_receiver(key: String, output: PathBuf, timeout_secs: u64) -> Result<()> {
    let secret_bytes: [u8; 32] = BASE64.decode(&key)
        .context("invalid base64 key")?
        .try_into()
        .map_err(|_| anyhow::anyhow!("key must be exactly 32 bytes"))?;

    let key_material = crypto::KeyMaterial {
        key_hint: {
            let mut hasher = sha2::Sha256::new();
            hasher.update(&secret_bytes);
            let hash = hasher.finalize();
            base64::engine::general_purpose::STANDARD.encode(&hash[..8])
        },
        secret_bytes,
    };

    println!("========================================");
    println!("  P2P File Transfer - Receiver");
    println!("========================================");
    println!();
    println!("Searching for sender on local network...");

    let discovery = discovery::DiscoveryService::new()?;
    let peer = discovery.browse(
        &key_material.key_hint,
        Duration::from_secs(timeout_secs),
    )
    .await?;

    println!("Found sender: {}:{}", peer.host, peer.port);

    let addr = format!("{}:{}", peer.host.trim_end_matches('.'), peer.port);
    let mut stream = tokio::net::TcpStream::connect(&addr)
        .await
        .context("failed to connect to sender")?;

    println!("Connected to {}", addr);

    let handshake = crypto::handshake_receiver(&mut stream, &key_material).await?;
    println!("Encrypted handshake completed (session: {})", &handshake.shared_secret_hash[..16]);

    tokio::fs::create_dir_all(&output).await?;
    transfer::recv_file(&mut stream, &handshake.cipher, &output).await?;

    Ok(())
}
