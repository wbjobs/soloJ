use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlamaConfig {
    pub api_endpoint: String,
    pub model: Option<String>,
    pub temperature: f32,
    pub max_tokens: usize,
    pub top_p: f32,
    pub timeout_secs: u64,
}

impl Default for LlamaConfig {
    fn default() -> Self {
        Self {
            api_endpoint: "http://localhost:8080".to_string(),
            model: None,
            temperature: 0.7,
            max_tokens: 2048,
            top_p: 0.95,
            timeout_secs: 120,
        }
    }
}

#[derive(Debug, Serialize)]
struct CompletionRequest {
    prompt: String,
    temperature: f32,
    max_tokens: usize,
    top_p: f32,
    stream: bool,
}

#[derive(Debug, Deserialize)]
struct CompletionResponse {
    content: Option<String>,
    choices: Option<Vec<Choice>>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    text: Option<String>,
    message: Option<Message>,
}

#[derive(Debug, Deserialize)]
struct Message {
    content: String,
}

pub struct LlamaSeedGenerator {
    config: LlamaConfig,
    client: reqwest::blocking::Client,
}

impl LlamaSeedGenerator {
    pub fn new(config: LlamaConfig) -> Result<Self> {
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(config.timeout_secs))
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self { config, client })
    }

    pub fn check_connection(&self) -> Result<bool> {
        let health_url = format!("{}/health", self.config.api_endpoint);
        match self.client.get(&health_url).send() {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(_) => {
                let models_url = format!("{}/v1/models", self.config.api_endpoint);
                Ok(self.client.get(&models_url).send().is_ok())
            }
        }
    }

    pub fn generate_seeds(
        &self,
        protocol_description: &str,
        protocol_name: &str,
        num_seeds: usize,
    ) -> Result<Vec<Vec<u8>>> {
        println!("[LLaMA] Generating {} initial seeds for {} protocol...", num_seeds, protocol_name);
        
        let mut seeds = Vec::new();
        let mut attempts = 0;
        let max_attempts = num_seeds * 3;

        while seeds.len() < num_seeds && attempts < max_attempts {
            attempts += 1;
            
            let prompt = self.build_prompt(protocol_description, protocol_name, seeds.len());
            
            match self.send_completion_request(&prompt) {
                Ok(response) => {
                    if let Some(content) = self.extract_content(&response) {
                        let parsed = self.parse_protocol_data(&content, protocol_name);
                        for seed in parsed {
                            if !seeds.contains(&seed) && !seed.is_empty() {
                                seeds.push(seed);
                                if seeds.len() >= num_seeds {
                                    break;
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[LLaMA] Warning: Request failed: {}", e);
                    std::thread::sleep(Duration::from_secs(1));
                }
            }
        }

        println!("[LLaMA] Successfully generated {} valid seeds", seeds.len());
        Ok(seeds)
    }

    fn build_prompt(&self, protocol_description: &str, protocol_name: &str, seed_index: usize) -> String {
        format!(
            r#"You are a network protocol security expert. Generate valid network protocol packets for fuzzing.

Protocol: {protocol_name}
Protocol Description:
{protocol_description}

Generate ONE valid {protocol_name} packet/request as hex bytes.

Requirements:
1. Output ONLY the hex bytes, no explanation
2. The packet must be syntactically valid according to the protocol specification
3. Include interesting edge cases (boundary values, optional fields, rare flags)
4. Ensure correct checksums, lengths, and field ordering if applicable
5. Use hex format: 485454502f312e31...

This is seed #{seed_index}. Generate a different packet than previous ones.

Hex bytes:"#
        )
    }

    fn send_completion_request(&self, prompt: &str) -> Result<CompletionResponse> {
        let request = CompletionRequest {
            prompt: prompt.to_string(),
            temperature: self.config.temperature,
            max_tokens: self.config.max_tokens,
            top_p: self.config.top_p,
            stream: false,
        };

        let urls = [
            format!("{}/completion", self.config.api_endpoint),
            format!("{}/v1/completions", self.config.api_endpoint),
        ];

        for url in &urls {
            match self.client.post(url).json(&request).send() {
                Ok(resp) => {
                    if resp.status().is_success() {
                        match resp.json::<CompletionResponse>() {
                            Ok(data) => return Ok(data),
                            Err(_) => continue,
                        }
                    }
                }
                Err(_) => continue,
            }
        }

        anyhow::bail!("Failed to get completion from LLaMA API")
    }

    fn extract_content(&self, response: &CompletionResponse) -> Option<String> {
        if let Some(content) = &response.content {
            return Some(content.clone());
        }

        if let Some(choices) = &response.choices {
            for choice in choices {
                if let Some(text) = &choice.text {
                    return Some(text.clone());
                }
                if let Some(msg) = &choice.message {
                    return Some(msg.content.clone());
                }
            }
        }

        None
    }

    fn parse_protocol_data(&self, content: &str, _protocol_name: &str) -> Vec<Vec<u8>> {
        let mut results = Vec::new();
        let cleaned = content
            .trim()
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| line.trim().trim_matches(|c: char| !c.is_ascii_hexdigit()))
            .collect::<String>();

        let hex_strings: Vec<&str> = cleaned
            .split_whitespace()
            .filter(|s| s.len() >= 2)
            .collect();

        for hex_str in hex_strings {
            if let Ok(bytes) = hex::decode(hex_str) {
                if !bytes.is_empty() && bytes.len() <= 8192 {
                    results.push(bytes);
                }
            }
        }

        if results.is_empty() {
            if let Ok(bytes) = hex::decode(&cleaned.replace(char::is_whitespace, "")) {
                if !bytes.is_empty() {
                    results.push(bytes);
                }
            }
        }

        results
    }

    pub fn save_seeds(&self, seeds: &[Vec<u8>], output_dir: &Path) -> Result<()> {
        fs::create_dir_all(output_dir).context("Failed to create seed output directory")?;

        for (i, seed) in seeds.iter().enumerate() {
            let filename = format!("seed_{:04}.bin", i);
            let filepath = output_dir.join(&filename);
            fs::write(&filepath, seed).with_context(|| format!("Failed to write {}", filename))?;
        }

        println!("[LLaMA] Saved {} seeds to {:?}", seeds.len(), output_dir);
        Ok(())
    }
}

pub fn get_protocol_description(protocol: &str) -> &'static str {
    match protocol.to_lowercase().as_str() {
        "http" | "https" => {
            r#"HTTP (Hypertext Transfer Protocol) is a text-based request-response protocol.
Request format: METHOD <path> HTTP/1.1\r\nHost: <host>\r\nHeader: value\r\n\r\n[body]
Common methods: GET, POST, PUT, DELETE, HEAD, OPTIONS, PATCH
Common headers: Host, Content-Length, Content-Type, User-Agent, Cookie
Response format: HTTP/1.1 <code> <message>\r\nHeaders\r\n\r\n[body]"#
        }
        "dns" => {
            r#"DNS (Domain Name System) is a binary protocol for domain name resolution.
Header format (12 bytes):
  - Transaction ID (2 bytes)
  - Flags (2 bytes): QR(1), Opcode(4), AA(1), TC(1), RD(1), RA(1), Z(3), RCODE(4)
  - QDCOUNT (2 bytes): number of questions
  - ANCOUNT (2 bytes): number of answers
  - NSCOUNT (2 bytes): authority records
  - ARCOUNT (2 bytes): additional records
Question format: <length-prefixed labels>\x00 + QTYPE(2) + QCLASS(2)
Labels: each prefixed with length byte (0xC0 indicates pointer to prior name)"#
        }
        "tcp" => {
            r#"TCP (Transmission Control Protocol) header format:
  - Source Port (2 bytes)
  - Destination Port (2 bytes)
  - Sequence Number (4 bytes)
  - Acknowledgment Number (4 bytes)
  - Data Offset (4 bits): header length in 32-bit words
  - Reserved (3 bits)
  - Flags (9 bits): NS, CWR, ECE, URG, ACK, PSH, RST, SYN, FIN
  - Window Size (2 bytes)
  - Checksum (2 bytes)
  - Urgent Pointer (2 bytes)
  - Options (variable, 0-40 bytes)
  - Data (variable)"#
        }
        "ftp" => {
            r#"FTP (File Transfer Protocol) uses two channels: command (port 21) and data.
Command format: <COMMAND> <arguments>\r\n
Common commands: USER, PASS, LIST, RETR, STOR, CWD, PWD, QUIT, PASV, PORT
Response format: <3-digit code> <text>\r\n"#
        }
        "smtp" => {
            r#"SMTP (Simple Mail Transfer Protocol) is text-based email protocol.
Commands: HELO, EHLO, MAIL FROM:, RCPT TO:, DATA, RSET, NOOP, QUIT
Data ends with \r\n.\r\n
Response codes: 2xx success, 3xx intermediate, 4xx transient, 5xx permanent"#
        }
        _ => {
            r#"Generate valid network protocol packets. Ensure correct structure, field ordering,
and include interesting values for fuzzing. Output as hex bytes."#
        }
    }
}
