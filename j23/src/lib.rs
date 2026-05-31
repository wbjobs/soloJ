pub mod config;
pub mod network;
pub mod packet;
pub mod connection;
pub mod window;
pub mod cubic;
pub mod rto;
pub mod sender;
pub mod receiver;
pub mod stats;
pub mod path_manager;
pub mod ui;
pub mod multipath_sender;
pub mod multipath_receiver;

use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "udp_transport")]
#[command(about = "Reliable UDP file transfer protocol", version)]
pub struct Cli {
    #[command(subcommand)]
    pub mode: Mode,

    #[arg(short, long, default_value = "config.toml")]
    pub config: PathBuf,
    
    #[arg(short, long, default_value_t = false)]
    pub multipath: bool,
    
    #[arg(short, long, default_value_t = false)]
    pub ui: bool,
}

#[derive(Subcommand)]
pub enum Mode {
    Sender {
        #[arg(short, long)]
        file: PathBuf,
        #[arg(short, long, default_value = "127.0.0.1")]
        host: String,
        #[arg(short, long, default_value_t = 8080)]
        port: u16,
    },
    Receiver {
        #[arg(short, long, default_value = "received_file")]
        output: PathBuf,
        #[arg(short, long, default_value = "127.0.0.1")]
        bind: String,
        #[arg(short, long, default_value_t = 8080)]
        port: u16,
    },
}
