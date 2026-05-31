use clap::Parser;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use udp_reliable_transport::{Cli, Config, Mode, Receiver, Sender, MultiPathSender, MultiPathReceiver};

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    let mut config = if cli.config.exists() {
        Config::load(&cli.config)?
    } else {
        println!("Config file not found, using default settings");
        Config::default()
    };
    
    config.multipath.enabled = cli.multipath;

    println!("Network configuration:");
    println!("  Loss rate: {:.2}%", config.network.loss_rate * 100.0);
    println!("  Base delay: {}ms", config.network.base_delay_ms);
    println!("  Jitter: {}ms", config.network.jitter_ms);
    
    if config.multipath.enabled {
        println!("  Multi-path: Enabled");
        println!("  Paths: {}", config.multipath.paths.len());
        println!("  Scheduler: {}", config.multipath.scheduler);
    }
    println!();

    if config.multipath.enabled {
        match cli.mode {
            Mode::Sender { file, .. } => {
                println!("=== Multi-Path Sender Mode ===");
                println!("Sending file: {}", file.display());
                println!();

                let mut sender = MultiPathSender::new(config, cli.ui)?;
                let stats = sender.send_file(&file)?;
                stats.print_summary();
            }
            Mode::Receiver { output, .. } => {
                println!("=== Multi-Path Receiver Mode ===");
                println!("Output file: {}", output.display());
                println!();

                let mut receiver = MultiPathReceiver::new(config, cli.ui)?;
                let stats = receiver.receive_file(&output)?;
                stats.print_summary();
            }
        }
    } else {
        match cli.mode {
            Mode::Sender { file, host, port } => {
                let remote_addr = SocketAddr::new(host.parse()?, port);
                let local_addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)), 0);

                println!("=== Sender Mode ===");
                println!("Sending file: {}", file.display());
                println!("Remote address: {}", remote_addr);
                println!();

                let mut sender = Sender::new(local_addr, remote_addr, config)?;
                sender.connect(remote_addr)?;
                
                let stats = sender.send_file(&file)?;
                sender.close()?;
                
                stats.print_summary();
            }
            Mode::Receiver { output, bind, port } => {
                let bind_addr = SocketAddr::new(bind.parse()?, port);

                println!("=== Receiver Mode ===");
                println!("Output file: {}", output.display());
                println!("Binding to: {}", bind_addr);
                println!();

                let mut receiver = Receiver::new(bind_addr, config)?;
                receiver.accept()?;
                
                let stats = receiver.receive_file(&output)?;
                stats.print_summary();
            }
        }
    }

    Ok(())
}
