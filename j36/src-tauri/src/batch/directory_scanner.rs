use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use tracing::{info, debug};
use crate::types::*;
use crate::AppResult;

pub struct DirectoryScanner;

impl DirectoryScanner {
    pub fn new() -> Self {
        DirectoryScanner
    }
    
    pub fn scan(
        &self,
        input_dir: &PathBuf,
        recursive: bool,
    ) -> AppResult<Vec<PathBuf>> {
        info!("Scanning directory: {:?}", input_dir);
        
        let mut files = Vec::new();
        let supported_extensions = ["pdf", "epub", "azw3", "azw", "mobi"];
        
        let max_depth = if recursive { usize::MAX } else { 1 };
        
        for entry in WalkDir::new(input_dir)
            .max_depth(max_depth)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() {
                if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
                    if supported_extensions.contains(&ext.to_lowercase().as_str()) {
                        files.push(entry.path().to_path_buf());
                    }
                }
            }
        }
        
        debug!("Found {} ebook files", files.len());
        
        files.sort();
        
        Ok(files)
    }
    
    pub fn create_batch_files(
        &self,
        input_dir: &PathBuf,
        output_dir: &PathBuf,
        preserve_structure: bool,
        recursive: bool,
    ) -> AppResult<Vec<BatchFile>> {
        let files = self.scan(input_dir, recursive)?;
        
        let mut batch_files = Vec::new();
        
        for input_path in files {
            let output_path = if preserve_structure {
                self.compute_output_path(input_dir, output_dir, &input_path)
            } else {
                let file_name = input_path.file_name()
                    .unwrap_or_default()
                    .to_os_string();
                Some(output_dir.join(file_name))
            };
            
            batch_files.push(BatchFile {
                id: uuid::Uuid::new_v4().to_string(),
                input_path: input_path.to_string_lossy().to_string(),
                output_path: output_path.map(|p| p.to_string_lossy().to_string()),
                status: ProcessState::Pending,
                error: None,
                progress: 0.0,
            });
        }
        
        Ok(batch_files)
    }
    
    fn compute_output_path(
        &self,
        input_dir: &Path,
        output_dir: &Path,
        input_file: &Path,
    ) -> Option<PathBuf> {
        let relative = input_file.strip_prefix(input_dir).ok()?;
        let mut output = output_dir.to_path_buf();
        
        for component in relative.components() {
            output.push(component);
        }
        
        if let Some(parent) = output.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        
        Some(output)
    }
    
    pub fn copy_metadata(
        &self,
        source: &PathBuf,
        target: &PathBuf,
    ) -> AppResult<()> {
        if let (Ok(source_meta), Ok(mut target_file)) = (
            std::fs::metadata(source),
            std::fs::File::options().write(true).open(target)
        ) {
            let _ = target_file.set_len(source_meta.len());
        }
        
        Ok(())
    }
    
    pub fn preserve_file_times(
        &self,
        source: &PathBuf,
        target: &PathBuf,
    ) -> AppResult<()> {
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            
            if let (Ok(source_meta), Ok(target_meta)) = (
                std::fs::metadata(source),
                std::fs::metadata(target)
            ) {
                let atime = filetime::FileTime::from_unix_time(
                    source_meta.atime(),
                    source_meta.atime_nsec() as u32
                );
                let mtime = filetime::FileTime::from_unix_time(
                    source_meta.mtime(),
                    source_meta.mtime_nsec() as u32
                );
                let _ = filetime::set_file_times(target, atime, mtime);
            }
        }
        
        #[cfg(windows)]
        {
            if let (Ok(source_meta), Ok(target_meta)) = (
                std::fs::metadata(source),
                std::fs::metadata(target)
            ) {
                if let (Ok(created), Ok(modified)) = (
                    source_meta.created(),
                    source_meta.modified()
                ) {
                    let created = filetime::FileTime::from_system_time(created);
                    let modified = filetime::FileTime::from_system_time(modified);
                    let _ = filetime::set_file_mtime(target, modified);
                }
            }
        }
        
        Ok(())
    }
}

impl Default for DirectoryScanner {
    fn default() -> Self {
        Self::new()
    }
}
