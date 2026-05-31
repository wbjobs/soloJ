use std::path::PathBuf;
use std::fs;
use tracing::{info, warn, debug, error};
use crate::types::*;
use crate::AppResult;
use super::calibre_integration::{CalibreIntegration, CalibreConfig};
use super::dedrm_plugin::{DeDrmPlugin, DeDrmConfig, DrmType};

pub struct DrmRemover {
    calibre: CalibreIntegration,
    dedrm: DeDrmPlugin,
    temp_dir: PathBuf,
}

impl DrmRemover {
    pub fn new(
        calibre_config: CalibreConfig,
        dedrm_config: DeDrmConfig,
    ) -> Self {
        let mut temp_dir = std::env::temp_dir();
        temp_dir.push("ebook_drm_styler");
        let _ = fs::create_dir_all(&temp_dir);
        
        DrmRemover {
            calibre: CalibreIntegration::new(calibre_config),
            dedrm: DeDrmPlugin::new(dedrm_config),
            temp_dir,
        }
    }
    
    pub fn init(&mut self) -> AppResult<()> {
        info!("Initializing DRM remover...");
        
        if !self.calibre.detect_calibre() {
            warn!("Calibre not found. DRM removal may not work correctly.");
        }
        
        if !self.dedrm.detect_plugin() {
            warn!("DeDRM plugin not found. DRM removal will not be possible.");
        }
        
        Ok(())
    }
    
    pub fn check_drm(&self, file: &PathBuf) -> AppResult<DrmInfo> {
        debug!("Checking DRM for file: {:?}", file);
        
        let drm_type = self.dedrm.check_drm_type(file)?;
        
        let is_protected = !matches!(drm_type, DrmType::None);
        
        let can_remove = is_protected 
            && self.calibre.is_available() 
            && self.dedrm.detect_plugin();
        
        let required_tools = if is_protected {
            self.dedrm.get_required_tools(drm_type)
        } else {
            Vec::new()
        };
        
        Ok(DrmInfo {
            drm_type: if is_protected { Some(drm_type.to_string()) } else { None },
            is_protected,
            can_remove,
            required_tools,
        })
    }
    
    pub fn remove_drm(
        &self,
        input: &PathBuf,
        output_dir: Option<&PathBuf>,
    ) -> AppResult<PathBuf> {
        info!("Attempting to remove DRM from: {:?}", input);
        
        let drm_info = self.check_drm(input)?;
        
        if !drm_info.is_protected {
            debug!("File is not DRM protected, returning original path");
            return Ok(input.clone());
        }
        
        if !drm_info.can_remove {
            return Err(AppError::DrmError(format!(
                "Cannot remove DRM. Required tools: {}",
                drm_info.required_tools.join(", ")
            )));
        }
        
        let drm_type = self.dedrm.check_drm_type(input)?;
        
        let output = match output_dir {
            Some(dir) => {
                let file_name = input.file_stem()
                    .and_then(|f| f.to_str())
                    .unwrap_or("output");
                
                let extension = input.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("epub");
                
                let mut output_path = dir.to_path_buf();
                fs::create_dir_all(&output_path)?;
                output_path.push(format!("{}_nodrm.{}", file_name, extension));
                output_path
            }
            None => {
                let mut output_path = self.temp_dir.clone();
                let file_name = input.file_name()
                    .and_then(|f| f.to_str())
                    .unwrap_or("output.epub");
                output_path.push(file_name);
                output_path
            }
        };
        
        debug!("DRM-free output path: {:?}", output);
        
        if output.exists() {
            let _ = fs::remove_file(&output);
        }
        
        self.perform_drm_removal(input, &output, drm_type)?;
        
        if !output.exists() {
            return Err(AppError::DrmError("DRM removal failed: output file not created".to_string()));
        }
        
        let output_size = fs::metadata(&output)?.len();
        if output_size == 0 {
            let _ = fs::remove_file(&output);
            return Err(AppError::DrmError("DRM removal failed: output file is empty".to_string()));
        }
        
        info!("DRM successfully removed. Output: {:?}", output);
        
        Ok(output)
    }
    
    fn perform_drm_removal(
        &self,
        input: &PathBuf,
        output: &PathBuf,
        drm_type: DrmType,
    ) -> AppResult<()> {
        debug!("Performing DRM removal for type: {:?}", drm_type);
        
        match drm_type {
            DrmType::Amazon => {
                self.remove_kindle_drm(input, output)
            }
            DrmType::Adobe => {
                self.remove_adobe_drm(input, output)
            }
            DrmType::None => {
                fs::copy(input, output)?;
                Ok(())
            }
            DrmType::Unknown => {
                Err(AppError::DrmError("Unknown DRM type".to_string()))
            }
        }
    }
    
    fn remove_kindle_drm(&self, input: &PathBuf, output: &PathBuf) -> AppResult<()> {
        debug!("Removing Amazon DRM from Kindle book");
        
        let options = self.dedrm.build_decrypt_options(DrmType::Amazon, "azw3");
        
        match self.calibre.convert_book(input, output, &options) {
            Ok(_) => Ok(()),
            Err(e) => {
                warn!("Calibre conversion failed, trying alternative method: {}", e);
                self.fallback_kindle_drm_removal(input, output)
            }
        }
    }
    
    fn remove_adobe_drm(&self, input: &PathBuf, output: &PathBuf) -> AppResult<()> {
        debug!("Removing Adobe DRM from book");
        
        let extension = input.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("epub");
        
        let options = self.dedrm.build_decrypt_options(DrmType::Adobe, extension);
        
        match self.calibre.convert_book(input, output, &options) {
            Ok(_) => Ok(()),
            Err(e) => {
                warn!("Calibre conversion failed: {}", e);
                Err(e)
            }
        }
    }
    
    fn fallback_kindle_drm_removal(&self, input: &PathBuf, output: &PathBuf) -> AppResult<()> {
        debug!("Using fallback Kindle DRM removal method");
        
        let script_content = self.dedrm.generate_deDRM_python_script(
            input,
            output,
            DrmType::Amazon,
        );
        
        let mut script_path = self.temp_dir.clone();
        script_path.push(format!("dedrm_{}.py", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()));
        
        fs::write(&script_path, &script_content)?;
        
        let result = std::process::Command::new("calibre-debug")
            .arg(&script_path)
            .output();
        
        let _ = fs::remove_file(&script_path);
        
        match result {
            Ok(output) if output.status.success() => Ok(()),
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr);
                Err(AppError::DrmError(format!("Fallback DRM removal failed: {}", stderr)))
            }
            Err(e) => Err(AppError::DrmError(format!("Failed to execute DeDRM script: {}", e))),
        }
    }
    
    pub fn is_available(&self) -> bool {
        self.calibre.is_available() && self.dedrm.detect_plugin()
    }
    
    pub fn get_temp_dir(&self) -> &PathBuf {
        &self.temp_dir
    }
    
    pub fn cleanup_temp_files(&self) {
        if let Ok(entries) = fs::read_dir(&self.temp_dir) {
            for entry in entries.flatten() {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}

impl Default for DrmRemover {
    fn default() -> Self {
        let mut remover = Self::new(CalibreConfig::default(), DeDrmConfig::default());
        let _ = remover.init();
        remover
    }
}

impl Drop for DrmRemover {
    fn drop(&mut self) {
        self.cleanup_temp_files();
    }
}
