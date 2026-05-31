use anyhow::{Result, Context, bail};
use chacha20poly1305::ChaCha20Poly1305;
use std::collections::{HashMap, HashSet};
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::crypto;

const CHUNK_SIZE: usize = 64 * 1024;
const HEADER_LEN_SIZE: usize = 4;
const TAG_OVERHEAD: usize = 16;
const PROGRESS_BAR_WIDTH: usize = 40;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct FileHeader {
    filename_utf8: String,
    size: u64,
    chunk_size: usize,
    file_hash: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct ResumeRequest {
    file_hash: String,
    chunk_hashes: Vec<(u64, String)>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct ResumeAck {
    skip_indices: HashSet<u64>,
    total_chunks: u64,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct IndexedChunk {
    index: u64,
    data_len: usize,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct ChunkAck {
    index: u64,
    received: u64,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct ProgressMeta {
    filename_utf8: String,
    file_size: u64,
    chunk_size: usize,
    file_hash: String,
    received_chunks: HashMap<u64, String>,
}

fn chunk_hash(data: &[u8]) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex_encode(&hasher.finalize())
}

fn file_hash_for_header(file_path: &Path, file_size: u64) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(file_path.to_string_lossy().as_bytes());
    hasher.update(file_size.to_le_bytes());
    hex_encode(&hasher.finalize())[..32].to_string()
}

fn filename_to_utf8(file_path: &Path) -> Result<String> {
    let name = file_path.file_name().context("invalid file name")?;
    if let Some(utf8) = name.to_str() {
        Ok(utf8.to_string())
    } else {
        #[cfg(windows)]
        {
            use std::os::windows::ffi::OsStrExt;
            let wide: Vec<u16> = name.encode_wide().collect();
            String::from_utf16(&wide).context("failed to convert filename to UTF-8")
        }
        #[cfg(unix)]
        {
            use std::os::unix::ffi::OsStrExt;
            String::from_utf8(name.as_bytes().to_vec()).context("failed to convert filename to UTF-8")
        }
    }
}

fn utf8_to_osstr(utf8: &str) -> OsString {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStringExt;
        let wide: Vec<u16> = utf8.encode_utf16().collect();
        OsString::from_wide(&wide)
    }
    #[cfg(unix)]
    {
        OsString::from(utf8)
    }
}

fn progress_meta_path(output_dir: &Path, filename_utf8: &str) -> PathBuf {
    let meta_name = format!(".{}.p2p-progress", filename_utf8);
    output_dir.join(meta_name)
}

async fn save_progress(meta: &ProgressMeta, output_dir: &Path) -> Result<()> {
    let path = progress_meta_path(output_dir, &meta.filename_utf8);
    let json = serde_json::to_vec_pretty(meta).context("serialize progress")?;
    tokio::fs::write(&path, &json).await.context("write progress file")?;
    Ok(())
}

async fn load_progress(output_dir: &Path, filename_utf8: &str, file_hash: &str) -> Result<Option<ProgressMeta>> {
    let path = progress_meta_path(output_dir, filename_utf8);
    if !path.exists() {
        return Ok(None);
    }
    let data = tokio::fs::read(&path).await.context("read progress file")?;
    let meta: ProgressMeta = serde_json::from_slice(&data).context("parse progress file")?;
    if meta.file_hash != file_hash {
        return Ok(None);
    }
    Ok(Some(meta))
}

async fn remove_progress(output_dir: &Path, filename_utf8: &str) -> Result<()> {
    let path = progress_meta_path(output_dir, filename_utf8);
    if path.exists() {
        tokio::fs::remove_file(&path).await.context("remove progress file")?;
    }
    Ok(())
}

struct ProgressBar {
    total_bytes: u64,
    transferred_bytes: u64,
    start_time: Instant,
    last_print: Instant,
}

impl ProgressBar {
    fn new(total_bytes: u64, already_done: u64) -> Self {
        Self {
            total_bytes,
            transferred_bytes: already_done,
            start_time: Instant::now(),
            last_print: Instant::now() - std::time::Duration::from_millis(500),
        }
    }

    fn update(&mut self, delta: u64) {
        self.transferred_bytes += delta;
    }

    fn display(&mut self) {
        let now = Instant::now();
        if now.duration_since(self.last_print) < std::time::Duration::from_millis(200) && self.transferred_bytes < self.total_bytes {
            return;
        }
        self.last_print = now;

        let pct = if self.total_bytes > 0 {
            self.transferred_bytes as f64 / self.total_bytes as f64
        } else {
            1.0
        };
        let filled = (pct * PROGRESS_BAR_WIDTH as f64).round() as usize;
        let empty = PROGRESS_BAR_WIDTH.saturating_sub(filled);

        let bar: String = "=".repeat(filled) + if filled < PROGRESS_BAR_WIDTH { ">" } else { "" };
        let pad = " ".repeat(empty.saturating_sub(1).max(0));
        let pct_str = format!("{:5.1}%", pct * 100.0);

        let elapsed = now.duration_since(self.start_time).as_secs_f64();
        let speed = if elapsed > 0.0 {
            let transferred = self.transferred_bytes as f64;
            transferred / elapsed
        } else {
            0.0
        };

        let remaining_bytes = self.total_bytes.saturating_sub(self.transferred_bytes);
        let eta = if speed > 0.0 && remaining_bytes > 0 {
            format_duration(remaining_bytes as f64 / speed)
        } else {
            "--:--".to_string()
        };

        eprint!(
            "\r[{}{}] {} {}/{} Speed: {} ETA: {} ",
            bar,
            pad,
            pct_str,
            format_size(self.transferred_bytes),
            format_size(self.total_bytes),
            format_size(speed as u64),
            eta,
        );

        if self.transferred_bytes >= self.total_bytes {
            eprintln!();
        }
    }
}

fn format_duration(secs: f64) -> String {
    if secs.is_finite() && secs >= 0.0 {
        let total = secs as u64;
        let h = total / 3600;
        let m = (total % 3600) / 60;
        let s = total % 60;
        if h > 0 {
            format!("{:02}h{:02}m{:02}s", h, m, s)
        } else if m > 0 {
            format!("{:02}m{:02}s", m, s)
        } else {
            format!("{:02}s", s)
        }
    } else {
        "--:--".to_string()
    }
}

fn format_size(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;
    let b = bytes as f64;
    if b >= GB {
        format!("{:.1}GB", b / GB)
    } else if b >= MB {
        format!("{:.1}MB", b / MB)
    } else if b >= KB {
        format!("{:.1}KB", b / KB)
    } else {
        format!("{}B", bytes)
    }
}

pub async fn send_file(
    stream: &mut TcpStream,
    cipher: &ChaCha20Poly1305,
    file_path: &Path,
) -> Result<()> {
    let filename = filename_to_utf8(file_path)?;

    let metadata = tokio::fs::metadata(file_path).await.context("read file metadata")?;
    let file_size = metadata.len();
    let fhash = file_hash_for_header(file_path, file_size);
    let total_chunks = (file_size as usize + CHUNK_SIZE - 1) / CHUNK_SIZE.max(1);

    let header = FileHeader {
        filename_utf8: filename,
        size: file_size,
        chunk_size: CHUNK_SIZE,
        file_hash: fhash,
    };
    let header_json = serde_json::to_vec(&header).context("serialize header")?;

    let mut send_buf = Vec::with_capacity(CHUNK_SIZE + TAG_OVERHEAD + HEADER_LEN_SIZE);
    let mut recv_buf = Vec::with_capacity(4096);
    let mut crypt_buf = Vec::with_capacity(CHUNK_SIZE + TAG_OVERHEAD);
    let mut read_buf = vec![0u8; CHUNK_SIZE];

    let mut nonce: u64 = 0;
    send_frame(stream, cipher, nonce, &header_json, &mut send_buf).await?;
    nonce += 1;

    recv_frame(stream, cipher, nonce, &mut recv_buf, &mut crypt_buf).await?;
    nonce += 1;
    let resume_req: ResumeRequest = serde_json::from_slice(&recv_buf).context("parse resume request")?;

    let mut skip_set: HashSet<u64> = HashSet::new();
    let mut already_done: u64 = 0;

    if !resume_req.chunk_hashes.is_empty() && resume_req.file_hash == header.file_hash {
        let mut file = File::open(file_path).await.context("open file for hash check")?;
        for (idx, expected_hash) in &resume_req.chunk_hashes {
            let offset = *idx as u64 * CHUNK_SIZE as u64;
            file.seek(std::io::SeekFrom::Start(offset)).await.context("seek file")?;
            read_buf.clear();
            read_buf.resize(CHUNK_SIZE, 0);
            let n = file.read(&mut read_buf).await.context("read chunk for check")?;
            let actual_hash = chunk_hash(&read_buf[..n]);
            if actual_hash == *expected_hash {
                skip_set.insert(*idx);
                already_done += n as u64;
            }
        }
    }

    let resume_ack = ResumeAck {
        skip_indices: skip_set.clone(),
        total_chunks: total_chunks as u64,
    };
    let ack_json = serde_json::to_vec(&resume_ack).context("serialize resume ack")?;
    send_frame(stream, cipher, nonce, &ack_json, &mut send_buf).await?;
    nonce += 1;

    let mut file = File::open(file_path).await.context("open file")?;
    let mut progress = ProgressBar::new(file_size, already_done);

    if already_done > 0 {
        println!("Resuming: {} ({} already transferred, {} remaining)",
            header.filename_utf8,
            format_size(already_done),
            format_size(file_size - already_done),
        );
    } else {
        println!("Sending: {} ({} bytes)", header.filename_utf8, format_size(file_size));
    }

    for chunk_idx in 0..total_chunks as u64 {
        if skip_set.contains(&chunk_idx) {
            continue;
        }

        let offset = chunk_idx as u64 * CHUNK_SIZE as u64;
        file.seek(std::io::SeekFrom::Start(offset)).await.context("seek file")?;

        read_buf.clear();
        read_buf.resize(CHUNK_SIZE, 0);
        let n = file.read(&mut read_buf).await.context("read file chunk")?;
        if n == 0 {
            break;
        }

        let chunk_info = IndexedChunk {
            index: chunk_idx,
            data_len: n,
        };
        let chunk_header_json = serde_json::to_vec(&chunk_info).context("serialize chunk header")?;

        send_frame(stream, cipher, nonce, &chunk_header_json, &mut send_buf).await?;
        nonce += 1;

        send_frame(stream, cipher, nonce, &read_buf[..n], &mut send_buf).await?;
        nonce += 1;

        progress.update(n as u64);
        progress.display();

        recv_buf.clear();
        recv_frame(stream, cipher, nonce, &mut recv_buf, &mut crypt_buf).await?;
        nonce += 1;
        let _ack: ChunkAck = serde_json::from_slice(&recv_buf).context("parse ack")?;
    }

    progress.transferred_bytes = file_size;
    progress.display();

    println!("File sent successfully!");
    Ok(())
}

pub async fn recv_file(
    stream: &mut TcpStream,
    cipher: &ChaCha20Poly1305,
    output_dir: &Path,
) -> Result<PathBuf> {
    let mut recv_buf = Vec::with_capacity(512);
    let mut send_buf = Vec::with_capacity(4096);
    let mut crypt_buf = Vec::with_capacity(CHUNK_SIZE + TAG_OVERHEAD);
    let mut chunk_data_buf = Vec::with_capacity(CHUNK_SIZE + TAG_OVERHEAD);

    let mut nonce: u64 = 0;
    recv_frame(stream, cipher, nonce, &mut recv_buf, &mut crypt_buf).await?;
    nonce += 1;
    let header: FileHeader = serde_json::from_slice(&recv_buf).context("parse file header")?;

    let os_filename = utf8_to_osstr(&header.filename_utf8);
    let output_path = output_dir.join(&os_filename);

    let existing_meta = load_progress(output_dir, &header.filename_utf8, &header.file_hash).await?;
    let mut received_chunks: HashMap<u64, String> = HashMap::new();
    let mut already_done: u64 = 0;
    let mut is_resume = false;

    if let Some(meta) = &existing_meta {
        if output_path.exists() {
            received_chunks = meta.received_chunks.clone();
            already_done = received_chunks.keys().map(|&idx| {
                let is_last = idx == (header.size as usize / header.chunk_size) as u64;
                if is_last {
                    header.size as usize % header.chunk_size.max(1)
                } else {
                    header.chunk_size
                }
            }).sum::<usize>() as u64;
            is_resume = true;
        }
    }

    let chunk_hashes: Vec<(u64, String)> = received_chunks.iter()
        .map(|(&idx, hash)| (idx, hash.clone()))
        .collect();

    let resume_req = ResumeRequest {
        file_hash: header.file_hash.clone(),
        chunk_hashes,
    };
    let req_json = serde_json::to_vec(&resume_req).context("serialize resume request")?;
    send_frame(stream, cipher, nonce, &req_json, &mut send_buf).await?;
    nonce += 1;

    recv_buf.clear();
    recv_frame(stream, cipher, nonce, &mut recv_buf, &mut crypt_buf).await?;
    nonce += 1;
    let resume_ack: ResumeAck = serde_json::from_slice(&recv_buf).context("parse resume ack")?;
    let skip_set = resume_ack.skip_indices;

    if !output_path.exists() {
        let file = File::create(&output_path).await.context("create output file")?;
        if header.size > 0 {
            file.set_len(header.size).await.context("preallocate file")?;
        }
        drop(file);
    }

    let mut file = File::options()
        .read(true)
        .write(true)
        .open(&output_path)
        .await
        .context("open output file for writing")?;

    if is_resume {
        for &idx in &skip_set {
            received_chunks.remove(&idx);
        }
    }

    let total_chunks = (header.size as usize + header.chunk_size - 1) / header.chunk_size.max(1);
    let mut progress = ProgressBar::new(header.size, already_done);

    if is_resume && already_done > 0 {
        println!("Resuming: {} ({} already done, {} remaining)",
            header.filename_utf8,
            format_size(already_done),
            format_size(header.size.saturating_sub(already_done)),
        );
    } else {
        println!("Receiving: {} ({} bytes)", header.filename_utf8, format_size(header.size));
    }

    let mut save_counter: u64 = 0;

    loop {
        recv_buf.clear();
        recv_frame(stream, cipher, nonce, &mut recv_buf, &mut crypt_buf).await?;
        nonce += 1;
        let chunk_info: IndexedChunk = serde_json::from_slice(&recv_buf).context("parse chunk header")?;

        chunk_data_buf.clear();
        recv_frame(stream, cipher, nonce, &mut chunk_data_buf, &mut crypt_buf).await?;
        nonce += 1;

        let offset = chunk_info.index as u64 * header.chunk_size as u64;
        file.seek(std::io::SeekFrom::Start(offset)).await.context("seek output file")?;
        file.write_all(&chunk_data_buf).await.context("write chunk")?;

        let ck = chunk_hash(&chunk_data_buf);
        received_chunks.insert(chunk_info.index, ck);

        progress.update(chunk_data_buf.len() as u64);
        progress.display();

        let ack = ChunkAck {
            index: chunk_info.index,
            received: progress.transferred_bytes,
        };
        let ack_json = serde_json::to_vec(&ack).context("serialize ack")?;
        send_buf.clear();
        send_frame(stream, cipher, nonce, &ack_json, &mut send_buf).await?;
        nonce += 1;

        save_counter += 1;
        if save_counter % 16 == 0 {
            let meta = ProgressMeta {
                filename_utf8: header.filename_utf8.clone(),
                file_size: header.size,
                chunk_size: header.chunk_size,
                file_hash: header.file_hash.clone(),
                received_chunks: received_chunks.clone(),
            };
            let _ = save_progress(&meta, output_dir).await;
        }

        if received_chunks.len() >= total_chunks {
            break;
        }
    }

    file.flush().await.context("flush output file")?;
    drop(file);

    remove_progress(output_dir, &header.filename_utf8).await?;

    progress.transferred_bytes = header.size;
    progress.display();

    println!("File received successfully: {:?}", output_path);
    Ok(output_path)
}

async fn send_frame(
    stream: &mut TcpStream,
    cipher: &ChaCha20Poly1305,
    nonce_counter: u64,
    data: &[u8],
    send_buf: &mut Vec<u8>,
) -> Result<()> {
    let encrypted = crypto::encrypt(cipher, data, nonce_counter)?;
    let len = (encrypted.len() as u32).to_be_bytes();

    send_buf.clear();
    send_buf.extend_from_slice(&len);
    send_buf.extend_from_slice(&encrypted);

    stream.write_all(send_buf).await.context("send frame")?;
    stream.flush().await?;

    if send_buf.capacity() > CHUNK_SIZE * 4 {
        send_buf.shrink_to(CHUNK_SIZE * 2);
    }

    Ok(())
}

async fn recv_frame(
    stream: &mut TcpStream,
    cipher: &ChaCha20Poly1305,
    nonce_counter: u64,
    out_buf: &mut Vec<u8>,
    crypt_buf: &mut Vec<u8>,
) -> Result<()> {
    let mut len_buf = [0u8; HEADER_LEN_SIZE];
    stream.read_exact(&mut len_buf).await.context("recv frame length")?;
    let frame_len = u32::from_be_bytes(len_buf) as usize;

    if frame_len > CHUNK_SIZE * 2 + 256 {
        bail!("frame too large: {} bytes", frame_len);
    }

    crypt_buf.clear();
    crypt_buf.resize(frame_len, 0);
    stream.read_exact(crypt_buf).await.context("recv frame data")?;

    let plaintext = crypto::decrypt(cipher, crypt_buf, nonce_counter)?;

    out_buf.clear();
    out_buf.extend_from_slice(&plaintext);

    if out_buf.capacity() > CHUNK_SIZE * 4 {
        out_buf.shrink_to(CHUNK_SIZE * 2);
    }
    if crypt_buf.capacity() > CHUNK_SIZE * 4 {
        crypt_buf.shrink_to(CHUNK_SIZE * 2);
    }

    Ok(())
}

fn hex_encode(data: &[u8]) -> String {
    data.iter().map(|b| format!("{:02x}", b)).collect()
}
