use std::path::PathBuf;
use std::process::Command;
use tracing::{info, warn, debug, error};
use crate::types::*;
use crate::AppResult;

pub struct CalibreConfig {
    pub calibre_path: Option<PathBuf>,
    pub ebook_convert_path: Option<PathBuf>,
    pub dedrm_plugin_path: Option<PathBuf>,
    pub adobe_key_path: Option<PathBuf>,
    pub kindle_key_path: Option<PathBuf>,
}

impl Default for CalibreConfig {
    fn default() -> Self {
        CalibreConfig {
            calibre_path: None,
            ebook_convert_path: None,
            dedrm_plugin_path: None,
            adobe_key_path: None,
            kindle_key_path: None,
        }
    }
}

pub struct CalibreIntegration {
    config: CalibreConfig,
}

impl CalibreIntegration {
    pub fn new(config: CalibreConfig) -> Self {
        CalibreIntegration { config }
    }
    
    pub fn detect_calibre(&mut self) -> bool {
        let ebook_convert = if cfg!(target_os = "windows") {
            "ebook-convert.exe"
        } else {
            "ebook-convert"
        };
        
        if let Ok(path) = which::which(ebook_convert) {
            self.config.ebook_convert_path = Some(path);
            return true;
        }
        
        let common_paths: Vec<PathBuf> = if cfg!(target_os = "windows") {
            vec![
                PathBuf::from(r"C:\Program Files\Calibre2\ebook-convert.exe"),
                PathBuf::from(r"C:\Program Files (x86)\Calibre2\ebook-convert.exe"),
            ]
        } else if cfg!(target_os = "macos") {
            vec![
                PathBuf::from("/Applications/calibre.app/Contents/MacOS/ebook-convert"),
            ]
        } else {
            vec![
                PathBuf::from("/usr/bin/ebook-convert"),
                PathBuf::from("/usr/local/bin/ebook-convert"),
            ]
        };
        
        for path in common_paths {
            if path.exists() {
                self.config.ebook_convert_path = Some(path);
                return true;
            }
        }
        
        false
    }
    
    pub fn is_available(&self) -> bool {
        self.config.ebook_convert_path.as_ref().map_or(false, |p| p.exists())
    }
    
    pub fn convert_book(
        &self,
        input: &PathBuf,
        output: &PathBuf,
        options: &[String],
    ) -> AppResult<()> {
        let ebook_convert = self.config.ebook_convert_path.as_ref()
            .ok_or_else(|| AppError::ExternalToolError("Calibre ebook-convert not found".to_string()))?;
        
        info!("Converting book: {:?} -> {:?}", input, output);
        
        let mut cmd = Command::new(ebook_convert);
        cmd.arg(input);
        cmd.arg(output);
        cmd.args(options);
        
        debug!("Running command: {:?}", cmd);
        
        let output = cmd.output()
            .map_err(|e| AppError::ExternalToolError(format!("Failed to execute ebook-convert: {}", e)))?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("ebook-convert failed: {}", stderr);
            return Err(AppError::ExternalToolError(format!("Conversion failed: {}", stderr)));
        }
        
        Ok(())
    }
    
    pub fn get_book_metadata(&self, input: &PathBuf) -> AppResult<String> {
        let ebook_convert = self.config.ebook_convert_path.as_ref()
            .ok_or_else(|| AppError::ExternalToolError("Calibre ebook-convert not found".to_string()))?;
        
        let mut temp_output = std::env::temp_dir();
        temp_output.push(format!("metadata_{}.txt", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()));
        
        let output = Command::new(ebook_convert)
            .arg(input)
            .arg(&temp_output)
            .arg("--get-metadata")
            .output()
            .map_err(|e| AppError::ExternalToolError(format!("Failed to get metadata: {}", e)))?;
        
        if output.status.success() {
            let metadata = std::fs::read_to_string(&temp_output)
                .unwrap_or_default();
            let _ = std::fs::remove_file(&temp_output);
            Ok(metadata)
        } else {
            let _ = std::fs::remove_file(&temp_output);
            Err(AppError::ExternalToolError(
                String::from_utf8_lossy(&output.stderr).to_string()
            ))
        }
    }
    
    pub fn list_plugins(&self) -> AppResult<Vec<String>> {
        let calibre_debug = if cfg!(target_os = "windows") {
            "calibre-debug.exe"
        } else {
            "calibre-debug"
        };
        
        let output = Command::new(calibre_debug)
            .arg("--list-plugins")
            .output()
            .map_err(|e| AppError::ExternalToolError(format!("Failed to list plugins: {}", e)))?;
        
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let plugins: Vec<String> = stdout.lines()
                .filter(|l| l.contains("DeDRM") || l.contains("dedrm"))
                .map(|l| l.trim().to_string())
                .collect();
            Ok(plugins)
        } else {
            Err(AppError::ExternalToolError(
                String::from_utf8_lossy(&output.stderr).to_string()
            ))
        }
    }
    
    pub fn add_plugin(&self, plugin_path: &PathBuf) -> AppResult<()> {
        let calibre_debug = if cfg!(target_os = "windows") {
            "calibre-customize.exe"
        } else {
            "calibre-customize"
        };
        
        let output = Command::new(calibre_debug)
            .arg("--add-plugin")
            .arg(plugin_path)
            .output()
            .map_err(|e| AppError::ExternalToolError(format!("Failed to add plugin: {}", e)))?;
        
        if output.status.success() {
            Ok(())
        } else {
            Err(AppError::ExternalToolError(
                String::from_utf8_lossy(&output.stderr).to_string()
            ))
        }
    }
}

pub fn which(command: &str) -> Result<PathBuf, which::Error> {
    which::which(command)
}
