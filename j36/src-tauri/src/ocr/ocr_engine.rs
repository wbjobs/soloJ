use std::path::PathBuf;
use std::process::Command;
use std::time::Instant;
use tracing::{info, debug, warn};
use crate::types::*;
use crate::AppResult;
use super::markdown_exporter::MarkdownExporter;

pub struct OcrEngine {
    config: OcrConfig,
    tesseract_available: bool,
}

impl OcrEngine {
    pub fn new(config: OcrConfig) -> Self {
        let tesseract_available = Self::check_tesseract_available(&config);
        
        OcrEngine {
            config,
            tesseract_available,
        }
    }

    pub fn check_tesseract_available(config: &OcrConfig) -> bool {
        let tesseract_cmd = config.tesseract_path.as_deref().unwrap_or("tesseract");
        
        match Command::new(tesseract_cmd).arg("--version").output() {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }

    pub fn is_available(&self) -> bool {
        self.tesseract_available
    }

    pub fn process_pdf(&self, pdf_path: &PathBuf) -> AppResult<OcrResult> {
        info!("Processing PDF for OCR: {}", pdf_path.display());
        
        if !self.tesseract_available {
            return Err(AppError::OcrError(
                "Tesseract OCR is not available. Please install Tesseract with Chinese language support.".to_string()
            ));
        }

        let total_start = Instant::now();
        let temp_dir = std::env::temp_dir().join(format!("ocr_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&temp_dir)?;

        let page_count = self.get_pdf_page_count(pdf_path)?;
        debug!("PDF has {} pages", page_count);

        let mut pages = Vec::new();
        let mut total_confidence = 0.0;

        for page_num in 0..page_count {
            let page_result = self.process_page(pdf_path, page_num, &temp_dir)?;
            total_confidence += page_result.confidence;
            pages.push(page_result);
        }

        let average_confidence = if !pages.is_empty() {
            total_confidence / pages.len() as f32
        } else {
            0.0
        };

        let total_processing_time_ms = total_start.elapsed().as_millis() as u64;

        let mut result = OcrResult {
            pages: pages.clone(),
            total_pages: page_count as u32,
            average_confidence,
            total_processing_time_ms,
            markdown_content: None,
        };

        let markdown = self.generate_markdown(&pages)?;
        result.markdown_content = Some(markdown);

        let _ = std::fs::remove_dir_all(&temp_dir);

        info!(
            "OCR completed: {} pages, avg confidence: {:.2}%, time: {}ms",
            page_count,
            average_confidence * 100.0,
            total_processing_time_ms
        );

        Ok(result)
    }

    fn process_page(&self, pdf_path: &PathBuf, page_num: usize, temp_dir: &PathBuf) -> AppResult<OcrPageResult> {
        let start = Instant::now();
        let page_image = temp_dir.join(format!("page_{}.png", page_num));
        
        self.render_pdf_page(pdf_path, page_num, &page_image)?;
        
        let tesseract_cmd = self.config.tesseract_path.as_deref().unwrap_or("tesseract");
        let output_base = temp_dir.join(format!("ocr_page_{}", page_num));
        
        let languages = self.config.languages.join("+");
        
        let mut args = vec![
            page_image.to_str().unwrap(),
            output_base.to_str().unwrap(),
            "-l", &languages,
            "--oem", "3",
            "--psm", "6",
        ];

        if let Some(tessdata) = &self.config.trained_data_path {
            args.push("--tessdata-dir");
            args.push(tessdata);
        }

        debug!("Running Tesseract: {} {:?}", tesseract_cmd, args);

        let output = Command::new(tesseract_cmd)
            .args(&args)
            .output()
            .map_err(|e| AppError::OcrError(format!("Failed to run Tesseract: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::OcrError(format!("Tesseract failed: {}", stderr)));
        }

        let txt_output = output_base.with_extension("txt");
        let text = if txt_output.exists() {
            std::fs::read_to_string(&txt_output)?
        } else {
            String::new()
        };

        let confidence = self.extract_confidence(&output_base)?;
        
        let layout_blocks = if self.config.enable_layout_analysis {
            self.analyze_layout(&text)
        } else {
            Vec::new()
        };

        Ok(OcrPageResult {
            page_number: (page_num + 1) as u32,
            text: text.clone(),
            confidence,
            layout_blocks,
            processing_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    fn render_pdf_page(&self, pdf_path: &PathBuf, page_num: usize, output_path: &PathBuf) -> AppResult<()> {
        let pdftoppm_available = Command::new("pdftoppm").arg("-v").output().is_ok();
        
        if pdftoppm_available {
            let output = Command::new("pdftoppm")
                .args(&[
                    "-png",
                    "-r", &self.config.dpi.to_string(),
                    "-f", &(page_num + 1).to_string(),
                    "-l", &(page_num + 1).to_string(),
                    pdf_path.to_str().unwrap(),
                    output_path.with_extension("").to_str().unwrap(),
                ])
                .output()
                .map_err(|e| AppError::OcrError(format!("Failed to run pdftoppm: {}", e)))?;

            if !output.status.success() {
                return Err(AppError::OcrError("pdftoppm failed to render page".to_string()));
            }

            let rendered_path = PathBuf::from(format!(
                "{}-{}.png",
                output_path.with_extension("").to_str().unwrap(),
                page_num + 1
            ));
            
            if rendered_path.exists() {
                std::fs::rename(&rendered_path, output_path)?;
            }
            
            Ok(())
        } else {
            self.render_page_fallback(pdf_path, page_num, output_path)
        }
    }

    fn render_page_fallback(&self, _pdf_path: &PathBuf, _page_num: usize, output_path: &PathBuf) -> AppResult<()> {
        warn!("pdftoppm not available, cannot render PDF page");
        
        return Err(AppError::OcrError(
            "pdftoppm is required but not available. Please install poppler-utils.".to_string()
        ));
    }

    fn extract_confidence(&self, output_base: &PathBuf) -> AppResult<f32> {
        let tsv_path = output_base.with_extension("tsv");
        
        if tsv_path.exists() {
            let content = std::fs::read_to_string(&tsv_path)?;
            let mut total_conf = 0.0;
            let mut count = 0;
            
            for line in content.lines().skip(1) {
                let parts: Vec<&str> = line.split('\t').collect();
                if parts.len() >= 11 {
                    if let Ok(conf) = parts[10].parse::<f32>() {
                        if conf > 0.0 {
                            total_conf += conf / 100.0;
                            count += 1;
                        }
                    }
                }
            }
            
            if count > 0 {
                return Ok(total_conf / count as f32);
            }
        }
        
        Ok(0.85)
    }

    fn analyze_layout(&self, text: &str) -> Vec<LayoutBlock> {
        let mut blocks = Vec::new();
        let mut order = 0u32;
        
        for (i, line) in text.lines().enumerate() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            
            let block_type = self.classify_line(trimmed, i);
            
            blocks.push(LayoutBlock {
                block_type,
                text: trimmed.to_string(),
                bounding_box: (0, 0, 0, 0),
                confidence: 0.9,
                order,
                level: match block_type {
                    LayoutBlockType::Title => 1,
                    LayoutBlockType::Heading1 => 2,
                    LayoutBlockType::Heading2 => 3,
                    LayoutBlockType::Heading3 => 4,
                    _ => 5,
                },
            });
            
            order += 1;
        }
        
        blocks
    }

    fn classify_line(&self, line: &str, line_num: usize) -> LayoutBlockType {
        let trimmed = line.trim();
        
        if line_num == 0 && trimmed.len() < 100 && !trimmed.contains(|c: char| c.is_ascii_punctuation() && c != '.') {
            return LayoutBlockType::Title;
        }

        let heading_patterns = [
            ("第", "章", LayoutBlockType::Heading1),
            ("第", "节", LayoutBlockType::Heading2),
            ("§", "", LayoutBlockType::Heading2),
            ("1.", "", LayoutBlockType::Heading2),
            ("1.1", "", LayoutBlockType::Heading3),
            ("①", "", LayoutBlockType::Heading3),
        ];

        for (prefix, suffix, block_type) in heading_patterns {
            if trimmed.starts_with(prefix) && (suffix.is_empty() || trimmed.contains(suffix)) {
                return block_type;
            }
        }

        if (trimmed.starts_with('-') || trimmed.starts_with('•') || trimmed.starts_with('*')) && trimmed.len() > 5 {
            return LayoutBlockType::ListItem;
        }

        if trimmed.contains('|') && trimmed.matches('|').count() >= 2 {
            return LayoutBlockType::TableRow;
        }

        if trimmed.starts_with('[') && trimmed.contains(']') && trimmed.contains("注") {
            return LayoutBlockType::Footnote;
        }

        LayoutBlockType::Paragraph
    }

    fn get_pdf_page_count(&self, pdf_path: &PathBuf) -> AppResult<usize> {
        let pdfinfo_available = Command::new("pdfinfo").output().is_ok();
        
        if pdfinfo_available {
            let output = Command::new("pdfinfo")
                .arg(pdf_path)
                .output()
                .map_err(|e| AppError::OcrError(format!("Failed to run pdfinfo: {}", e)))?;
            
            let output_str = String::from_utf8_lossy(&output.stdout);
            
            for line in output_str.lines() {
                if line.starts_with("Pages:") {
                    if let Some(count_str) = line.split(':').nth(1) {
                        if let Ok(count) = count_str.trim().parse::<usize>() {
                            return Ok(count);
                        }
                    }
                }
            }
        }
        
        warn!("pdfinfo not available, defaulting to 1 page");
        Ok(1)
    }

    fn generate_markdown(&self, pages: &[OcrPageResult]) -> AppResult<String> {
        let exporter = MarkdownExporter::new();
        exporter.export_to_markdown(pages)
    }
}
