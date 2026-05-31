mod mutator;
mod coverage;
mod fuzzer;
mod crash;
mod distributed;
mod session;
mod cli;
mod llama;
mod taint;

use cli::Cli;
use clap::Parser;
use anyhow::Result;

fn main() -> Result<()> {
    let cli = Cli::parse();
    cli.run()
}
