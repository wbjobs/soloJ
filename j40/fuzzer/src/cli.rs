use clap::{Parser, Subcommand};
use anyhow::Result;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Parser, Debug)]
#[command(name = "fuzz_cmd", version = "0.1.0", about = "Coverage-guided network protocol fuzzer")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    #[command(about = "Start fuzzing")]
    Run {
        #[arg(long, help = "Target binary path")]
        target: PathBuf,

        #[arg(long, help = "Protocol name or template path")]
        protocol: String,

        #[arg(long, default_value_t = 1, help = "Number of worker processes")]
        workers: usize,

        #[arg(long, help = "Fuzzing duration (e.g., 1h, 30m, 60s)")]
        duration: Option<String>,

        #[arg(long, help = "Output directory for crashes and corpus")]
        output: Option<PathBuf>,

        #[arg(long, help = "Input corpus directory")]
        corpus: Option<PathBuf>,

        #[arg(long, help = "Dictionary file path")]
        dictionary: Option<PathBuf>,

        #[arg(long, help = "Resume from previous session")]
        resume: Option<PathBuf>,

        #[arg(long, help = "Path to custom protocol description file")]
        protocol_desc: Option<PathBuf>,

        #[arg(long, default_value_t = true, help = "Enable taint tracking")]
        taint: bool,

        #[arg(long, default_value_t = 0.6, help = "Taint guidance weight (0.0-1.0)")]
        taint_weight: f64,

        #[arg(long, help = "Use LLaMA to generate initial seeds")]
        llama: bool,

        #[arg(long, default_value = "http://localhost:8080", help = "LLaMA API endpoint")]
        llama_endpoint: String,

        #[arg(long, default_value_t = 20, help = "Number of seeds to generate with LLaMA")]
        llama_seeds: usize,
    },

    #[command(about = "Resume previous fuzzing session")]
    Resume {
        #[arg(help = "Session directory")]
        session: PathBuf,
    },

    #[command(about = "Analyze crashes")]
    Triage {
        #[arg(help = "Crash directory or database")]
        input: PathBuf,

        #[arg(long, help = "Triage output")]
        output: Option<PathBuf>,
    },

    #[command(about = "Generate initial seeds using LLaMA")]
    GenerateSeeds {
        #[arg(long, help = "Protocol name")]
        protocol: String,

        #[arg(long, help = "Output directory for generated seeds")]
        output: PathBuf,

        #[arg(long, help = "Path to custom protocol description file")]
        protocol_desc: Option<PathBuf>,

        #[arg(long, default_value = "http://localhost:8080", help = "LLaMA API endpoint")]
        llama_endpoint: String,

        #[arg(long, default_value_t = 20, help = "Number of seeds to generate")]
        count: usize,
    },
}

impl Cli {
    pub fn run(&self) -> Result<()> {
        match &self.command {
            Commands::Run { .. } => self.run_fuzzer(),
            Commands::Resume { session } => self.resume_session(session),
            Commands::Triage { input, output } => self.triage_crashes(input, output),
            Commands::GenerateSeeds { .. } => self.generate_llama_seeds(),
        }
    }

    fn run_fuzzer(&self) -> Result<()> {
        if let Commands::Run {
            target,
            protocol,
            workers,
            duration,
            output,
            corpus,
            dictionary,
            resume,
            protocol_desc,
            taint,
            taint_weight,
            llama,
            llama_endpoint,
            llama_seeds,
        } = &self.command
        {
            let duration = duration.as_ref().map(|d| parse_duration(d)).transpose()?;
            
            let mut config = crate::fuzzer::FuzzerConfig {
                target: target.clone(),
                protocol: protocol.clone(),
                workers: *workers,
                duration,
                output_dir: output.clone().unwrap_or_else(|| PathBuf::from("./output")),
                corpus_dir: corpus.clone(),
                dictionary: dictionary.clone(),
                resume_session: resume.clone(),
                ..Default::default()
            };
            
            if *llama {
                println!("[LLaMA] Generating initial seeds...");
                let llama_config = crate::llama::LlamaConfig {
                    api_endpoint: llama_endpoint.clone(),
                    ..Default::default()
                };
                
                let generator = crate::llama::LlamaSeedGenerator::new(llama_config)?;
                
                if generator.check_connection().unwrap_or(false) {
                    let desc = if let Some(desc_path) = protocol_desc {
                        std::fs::read_to_string(desc_path)?
                    } else {
                        crate::llama::get_protocol_description(protocol).to_string()
                    };
                    
                    let seeds = generator.generate_seeds(&desc, protocol, *llama_seeds)?;
                    
                    let seed_dir = config.output_dir.join("corpus");
                    generator.save_seeds(&seeds, &seed_dir)?;
                    
                    if config.corpus_dir.is_none() {
                        config.corpus_dir = Some(seed_dir);
                    }
                } else {
                    eprintln!("[LLaMA] Warning: Could not connect to LLaMA API, using default seeds");
                }
            }
            
            let mut fuzzer = crate::fuzzer::Fuzzer::new(config)?;
            fuzzer.run()?;
        }
        Ok(())
    }

    fn generate_llama_seeds(&self) -> Result<()> {
        if let Commands::GenerateSeeds {
            protocol,
            output,
            protocol_desc,
            llama_endpoint,
            count,
        } = &self.command
        {
            let llama_config = crate::llama::LlamaConfig {
                api_endpoint: llama_endpoint.clone(),
                ..Default::default()
            };
            
            let generator = crate::llama::LlamaSeedGenerator::new(llama_config)?;
            
            println!("[LLaMA] Connecting to {}...", llama_endpoint);
            if !generator.check_connection().unwrap_or(false) {
                anyhow::bail!("Could not connect to LLaMA API at {}", llama_endpoint);
            }
            
            let desc = if let Some(desc_path) = protocol_desc {
                std::fs::read_to_string(desc_path)?
            } else {
                crate::llama::get_protocol_description(protocol).to_string()
            };
            
            println!("[LLaMA] Generating {} seeds for {} protocol...", count, protocol);
            let seeds = generator.generate_seeds(&desc, protocol, *count)?;
            
            std::fs::create_dir_all(output)?;
            generator.save_seeds(&seeds, output)?;
            
            println!("[LLaMA] Done! Generated {} seeds in {:?}", seeds.len(), output);
        }
        Ok(())
    }

    fn resume_session(&self, session: &std::path::Path) -> Result<()> {
        let mut fuzzer = crate::fuzzer::Fuzzer::from_session(session)?;
        fuzzer.run()
    }

    fn triage_crashes(&self, input: &std::path::Path, output: &Option<PathBuf>) -> Result<()> {
        let triage = crate::crash::CrashTriage::new(input, output.clone())?;
        triage.analyze()
    }
}

fn parse_duration(s: &str) -> Result<Duration> {
    let mut chars = s.chars().peekable();
    let mut num = String::new();
    
    while let Some(&c) = chars.peek() {
        if c.is_ascii_digit() || c == '.' {
            num.push(c);
            chars.next();
        } else {
            break;
        }
    }
    
    let num: f64 = num.parse()?;
    let unit: String = chars.collect();
    
    let seconds = match unit.as_str() {
        "s" | "sec" | "secs" => num,
        "m" | "min" | "mins" => num * 60.0,
        "h" | "hr" | "hrs" => num * 3600.0,
        "d" | "day" | "days" => num * 86400.0,
        _ => anyhow::bail!("Unknown duration unit: {}", unit),
    };
    
    Ok(Duration::from_secs_f64(seconds))
}
