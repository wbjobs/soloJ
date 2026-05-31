use crate::serial_port::LogEntry;
use chrono::Local;
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

pub struct Logger {
    log_file: Option<File>,
    file_path: Option<PathBuf>,
}

impl Logger {
    pub fn new() -> Self {
        Logger {
            log_file: None,
            file_path: None,
        }
    }

    pub fn create_new_log(&mut self, log_dir: &str) -> Result<String, String> {
        let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
        let file_name = format!("serial_log_{}.log", timestamp);
        
        let dir_path = PathBuf::from(log_dir);
        std::fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
        
        let file_path = dir_path.join(file_name);
        let file = OpenOptions::new()
            .create(true)
            .write(true)
            .append(true)
            .open(&file_path)
            .map_err(|e| e.to_string())?;

        self.log_file = Some(file);
        self.file_path = Some(file_path.clone());

        let header = format!(
            "========================================\n\
             串口日志文件\n\
             创建时间: {}\n\
             格式: [时间戳] [方向] HEX: [十六进制数据] ASCII: [ASCII数据]\n\
             ========================================\n",
            Local::now().format("%Y-%m-%d %H:%M:%S")
        );
        
        if let Some(file) = &mut self.log_file {
            file.write_all(header.as_bytes()).map_err(|e| e.to_string())?;
        }

        Ok(file_path.to_string_lossy().to_string())
    }

    pub fn log_entry(&mut self, entry: &LogEntry) -> Result<(), String> {
        if let Some(file) = &mut self.log_file {
            let log_line = format!(
                "[{}] [{}] HEX: {} ASCII: {}\n",
                entry.timestamp,
                entry.direction,
                entry.hex_data,
                entry.ascii_data
            );
            file.write_all(log_line.as_bytes()).map_err(|e| e.to_string())?;
            file.flush().map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn close(&mut self) {
        self.log_file = None;
        self.file_path = None;
    }

    pub fn get_current_log_path(&self) -> Option<String> {
        self.file_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string())
    }
}