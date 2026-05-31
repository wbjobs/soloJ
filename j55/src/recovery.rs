use crate::hasher;
use crate::metrics;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct RecoveryManager {
    backup_dir: PathBuf,
    enabled: bool,
}

impl RecoveryManager {
    pub fn new(backup_dir: Option<PathBuf>) -> Self {
        match backup_dir {
            Some(dir) => {
                let enabled = dir.exists() && dir.is_dir();
                if enabled {
                    log::info!("Auto-recovery enabled, backup directory: {}", dir.display());
                } else {
                    log::warn!(
                        "Backup directory not found or invalid: {}, auto-recovery disabled",
                        dir.display()
                    );
                }
                Self {
                    backup_dir: dir,
                    enabled,
                }
            }
            None => Self {
                backup_dir: PathBuf::new(),
                enabled: false,
            },
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn backup_dir(&self) -> &Path {
        &self.backup_dir
    }

    pub fn find_backup_file(&self, original_path: &Path, watch_dir: &Path) -> Option<PathBuf> {
        if !self.enabled {
            return None;
        }

        let rel_path = original_path.strip_prefix(watch_dir).ok()?;
        let backup_path = self.backup_dir.join(rel_path);

        if backup_path.exists() && backup_path.is_file() {
            Some(backup_path)
        } else {
            None
        }
    }

    pub fn recover_file(&self, original_path: &Path, watch_dir: &Path) -> Result<(), String> {
        if !self.enabled {
            return Err("Auto-recovery is disabled".to_string());
        }

        let backup_path = self
            .find_backup_file(original_path, watch_dir)
            .ok_or_else(|| format!("Backup file not found for {}", original_path.display()))?;

        if let Some(parent) = original_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directory: {}", e))?;
        }

        std::fs::copy(&backup_path, original_path).map_err(|e| {
            format!(
                "Failed to copy from {} to {}: {}",
                backup_path.display(),
                original_path.display(),
                e
            )
        })?;

        metrics::record_recovery();
        log::info!(
            "File recovered from backup: {} -> {}",
            backup_path.display(),
            original_path.display()
        );

        Ok(())
    }

    pub fn verify_recovery(&self, original_path: &Path, watch_dir: &Path) -> Result<bool, String> {
        let backup_path = self
            .find_backup_file(original_path, watch_dir)
            .ok_or_else(|| "Backup file not found".to_string())?;

        let backup_hash = hasher::compute_hash(&backup_path)?;
        let restored_hash = hasher::compute_hash(original_path)?;

        Ok(backup_hash == restored_hash)
    }

    pub fn create_backup(&self, source_path: &Path, watch_dir: &Path) -> Result<(), String> {
        if !self.enabled {
            return Err("Auto-recovery is disabled".to_string());
        }

        if !source_path.exists() || !source_path.is_file() {
            return Err(format!("Source file not found: {}", source_path.display()));
        }

        let rel_path = source_path
            .strip_prefix(watch_dir)
            .map_err(|_| "Source file is outside watch directory".to_string())?;
        let backup_path = self.backup_dir.join(rel_path);

        if let Some(parent) = backup_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create backup directory: {}", e))?;
        }

        std::fs::copy(source_path, &backup_path).map_err(|e| {
            format!(
                "Failed to copy from {} to {}: {}",
                source_path.display(),
                backup_path.display(),
                e
            )
        })?;

        log::info!("Backup created: {} -> {}", source_path.display(), backup_path.display());
        Ok(())
    }
}
