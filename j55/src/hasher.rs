use sha2::{Sha256, Digest};
use std::path::Path;
use walkdir::WalkDir;

pub const MONITORED_EXTENSIONS: &[&str] = &["html", "htm", "css", "js"];

pub fn is_monitored(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| MONITORED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

pub fn compute_hash(path: &Path) -> Result<String, String> {
    let data = std::fs::read(path).map_err(|e| format!("{}: {}", path.display(), e))?;
    let mut hasher = Sha256::new();
    hasher.update(&data);
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn scan_directory(dir: &Path) -> Vec<std::path::PathBuf> {
    WalkDir::new(dir)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
        .filter(|entry| is_monitored(entry.path()))
        .map(|entry| entry.path().to_path_buf())
        .collect()
}
