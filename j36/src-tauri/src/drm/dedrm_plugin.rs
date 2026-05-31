use std::path::PathBuf;
use std::fs;
use tracing::{info, warn, debug};
use crate::types::*;
use crate::AppResult;

pub struct DeDrmConfig {
    pub plugin_version: String,
    pub adobe_dedrm_key: Option<PathBuf>,
    pub kindle_serial_number: Option<String>,
    pub kindle_key_file: Option<PathBuf>,
    pub custom_plugin_path: Option<PathBuf>,
}

impl Default for DeDrmConfig {
    fn default() -> Self {
        DeDrmConfig {
            plugin_version: "10.0.3".to_string(),
            adobe_dedrm_key: None,
            kindle_serial_number: None,
            kindle_key_file: None,
            custom_plugin_path: None,
        }
    }
}

pub struct DeDrmPlugin {
    config: DeDrmConfig,
}

impl DeDrmPlugin {
    pub fn new(config: DeDrmConfig) -> Self {
        DeDrmPlugin { config }
    }
    
    pub fn detect_plugin(&self) -> bool {
        if let Some(path) = &self.config.custom_plugin_path {
            if path.exists() {
                return true;
            }
        }
        
        let plugin_dirs = self.get_plugin_directories();
        
        for dir in plugin_dirs {
            let plugin_path = dir.join("DeDRM.zip");
            if plugin_path.exists() {
                debug!("Found DeDRM plugin at: {:?}", plugin_path);
                return true;
            }
            
            let dedrm_dir = dir.join("DeDRM");
            if dedrm_dir.exists() {
                debug!("Found DeDRM plugin directory at: {:?}", dedrm_dir);
                return true;
            }
        }
        
        false
    }
    
    fn get_plugin_directories(&self) -> Vec<PathBuf> {
        let mut dirs = Vec::new();
        
        if let Some(home) = dirs_next::home_dir() {
            if cfg!(target_os = "windows") {
                dirs.push(home.join(r"AppData\Roaming\calibre\plugins"));
            } else if cfg!(target_os = "macos") {
                dirs.push(home.join("Library/Preferences/calibre/plugins"));
            } else {
                dirs.push(home.join(".config/calibre/plugins"));
            }
        }
        
        if let Ok(cwd) = std::env::current_dir() {
            dirs.push(cwd.join("plugins"));
            dirs.push(cwd.join("resources/plugins"));
        }
        
        dirs
    }
    
    pub fn check_drm_type(&self, file: &PathBuf) -> AppResult<DrmType> {
        let extension = file.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        
        match extension.as_str() {
            "epub" => {
                if self.has_adobe_drm(file)? {
                    Ok(DrmType::Adobe)
                } else {
                    Ok(DrmType::None)
                }
            }
            "azw" | "azw1" | "azw2" | "azw3" | "azw4" | "mobi" => {
                if self.has_kindle_drm(file)? {
                    Ok(DrmType::Amazon)
                } else {
                    Ok(DrmType::None)
                }
            }
            "pdf" => {
                if self.has_adobe_drm(file)? {
                    Ok(DrmType::Adobe)
                } else {
                    Ok(DrmType::None)
                }
            }
            _ => Ok(DrmType::Unknown),
        }
    }
    
    fn has_adobe_drm(&self, file: &PathBuf) -> AppResult<bool> {
        if let Ok(data) = fs::read(file) {
            if data.windows(4).any(|w| w == b"DRMID") {
                return Ok(true);
            }
            if data.windows(8).any(|w| w == b"<rights>") {
                return Ok(true);
            }
            if data.windows(12).any(|w| w == b"encryption") {
                return Ok(true);
            }
        }
        
        if let Ok(archive) = zip::ZipArchive::new(fs::File::open(file)?) {
            for i in 0..archive.len() {
                if let Ok(file) = archive.by_index(i) {
                    let name = file.name().to_lowercase();
                    if name.contains("rights.xml") 
                        || name.contains("encryption.xml")
                        || name.contains("drm") {
                        return Ok(true);
                    }
                }
            }
        }
        
        Ok(false)
    }
    
    fn has_kindle_drm(&self, file: &PathBuf) -> AppResult<bool> {
        if let Ok(data) = fs::read(file) {
            if data.len() >= 78 {
                let drm_bytes = &data[28..32];
                let drm_flag = u32::from_be_bytes([drm_bytes[0], drm_bytes[1], drm_bytes[2], drm_bytes[3]]);
                if drm_flag != 0 {
                    return Ok(true);
                }
            }
        }
        
        Ok(false)
    }
    
    pub fn get_required_tools(&self, drm_type: DrmType) -> Vec<String> {
        let mut tools = vec!["calibre".to_string(), "DeDRM plugin".to_string()];
        
        match drm_type {
            DrmType::Adobe => {
                tools.push("Adobe Digital Editions key".to_string());
            }
            DrmType::Amazon => {
                tools.push("Kindle serial number or key file".to_string());
            }
            _ => {}
        }
        
        tools
    }
    
    pub fn build_decrypt_options(
        &self,
        drm_type: DrmType,
        output_format: &str,
    ) -> Vec<String> {
        let mut options = Vec::new();
        
        options.push("--output-profile".to_string());
        options.push("tablet".to_string());
        
        if let Some(serial) = &self.config.kindle_serial_number {
            options.push("--user-protected-key".to_string());
            options.push(format!("kindle_serial:{}", serial));
        }
        
        if let Some(key_file) = &self.config.kindle_key_file {
            options.push("--user-protected-key".to_string());
            options.push(format!("kindle_key:{}", key_file.to_string_lossy()));
        }
        
        if let Some(adobe_key) = &self.config.adobe_dedrm_key {
            options.push("--user-protected-key".to_string());
            options.push(format!("adobe_key:{}", adobe_key.to_string_lossy()));
        }
        
        if drm_type == DrmType::Amazon {
            options.push("--mobi-keep-asin".to_string());
        }
        
        options
    }
    
    pub fn generate_deDRM_python_script(
        &self,
        input_file: &PathBuf,
        output_file: &PathBuf,
        drm_type: DrmType,
    ) -> String {
        let input = input_file.to_string_lossy();
        let output = output_file.to_string_lossy();
        
        let mut script = String::new();
        
        script.push_str("#!/usr/bin/env python3\n");
        script.push_str("# Auto-generated DeDRM script\n");
        script.push_str("# For legal backup purposes only\n\n");
        
        script.push_str("import sys\n");
        script.push_str("import os\n\n");
        
        match drm_type {
            DrmType::Adobe => {
                script.push_str("# Adobe DRM removal\n");
                script.push_str("try:\n");
                script.push_str("    from calibre_plugins.dedrm import adobekey\n");
                script.push_str("    from calibre_plugins.dedrm import ineptpdf\n");
                script.push_str("    from calibre_plugins.dedrm import ineptepub\n");
                script.push_str("except ImportError:\n");
                script.push_str("    print(\"DeDRM plugin not found\", file=sys.stderr)\n");
                script.push_str("    sys.exit(1)\n\n");
            }
            DrmType::Amazon => {
                script.push_str("# Amazon DRM removal\n");
                script.push_str("try:\n");
                script.push_str("    from calibre_plugins.dedrm import mobidedrm\n");
                script.push_str("    from calibre_plugins.dedrm import kfxzip\n");
                script.push_str("except ImportError:\n");
                script.push_str("    print(\"DeDRM plugin not found\", file=sys.stderr)\n");
                script.push_str("    sys.exit(1)\n\n");
            }
            _ => {}
        }
        
        script.push_str(&format!("input_file = r'{}'\n", input));
        script.push_str(&format!("output_file = r'{}'\n\n", output));
        
        script.push_str("def decrypt_book(inpath, outpath):\n");
        script.push_str("    import shutil\n");
        script.push_str("    # DeDRM logic would be implemented here\n");
        script.push_str("    # This is a placeholder for the actual DeDRM implementation\n");
        script.push_str("    shutil.copy2(inpath, outpath)\n");
        script.push_str("    return True\n\n");
        
        script.push_str("if __name__ == '__main__':\n");
        script.push_str("    success = decrypt_book(input_file, output_file)\n");
        script.push_str("    sys.exit(0 if success else 1)\n");
        
        script
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DrmType {
    None,
    Adobe,
    Amazon,
    Unknown,
}

impl std::fmt::Display for DrmType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DrmType::None => write!(f, "None"),
            DrmType::Adobe => write!(f, "Adobe DRM"),
            DrmType::Amazon => write!(f, "Amazon DRM"),
            DrmType::Unknown => write!(f, "Unknown DRM"),
        }
    }
}
