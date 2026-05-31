use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use tracing::{info, debug, error};

use crate::types::*;
use crate::core::parser::ParserRegistry;
use crate::drm::drm_remover::DrmRemover;
use crate::layout::layout_engine::LayoutEngine;
use crate::search::search_engine::SearchEngine;
use crate::ocr::ocr_engine::OcrEngine;
use crate::ocr::markdown_exporter::MarkdownExporter;
use crate::diff::diff_engine::DiffEngine;

pub struct AppState {
    pub parser_registry: Mutex<ParserRegistry>,
    pub drm_remover: Mutex<Option<DrmRemover>>,
    pub layout_engine: Mutex<LayoutEngine>,
    pub search_engine: Mutex<Option<SearchEngine>>,
}

impl AppState {
    pub fn new() -> Self {
        AppState {
            parser_registry: Mutex::new(ParserRegistry::new()),
            drm_remover: Mutex::new(None),
            layout_engine: Mutex::new(LayoutEngine::new()),
            search_engine: Mutex::new(None),
        }
    }
    
    pub fn init_drm(&self) -> crate::AppResult<()> {
        let mut drm_guard = self.drm_remover.lock().unwrap();
        if drm_guard.is_none() {
            *drm_guard = Some(DrmRemover::default());
        }
        Ok(())
    }
    
    pub fn init_search(&self, index_path: &PathBuf) -> crate::AppResult<()> {
        let mut search_guard = self.search_engine.lock().unwrap();
        if search_guard.is_none() {
            *search_guard = Some(SearchEngine::new(index_path)?);
        }
        Ok(())
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

#[tauri::command]
pub async fn parse_ebook(
    path: String,
    state: State<'_, AppState>,
) -> Result<ParsedBook, String> {
    info!("Parsing ebook: {}", path);
    
    let path_buf = PathBuf::from(&path);
    let registry = state.parser_registry.lock().unwrap();
    
    registry.parse_book(&path_buf)
        .map_err(|e| {
            error!("Parse error: {}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn get_book_metadata(
    path: String,
    state: State<'_, AppState>,
) -> Result<BookMetadata, String> {
    debug!("Getting metadata for: {}", path);
    
    let path_buf = PathBuf::from(&path);
    let registry = state.parser_registry.lock().unwrap();
    
    registry.parse_metadata(&path_buf)
        .map_err(|e| {
            error!("Metadata error: {}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn remove_drm(
    input_path: String,
    output_dir: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    info!("Removing DRM from: {}", input_path);
    
    let _ = state.init_drm().map_err(|e| e.to_string())?;
    
    let drm_guard = state.drm_remover.lock().unwrap();
    let drm = drm_guard.as_ref()
        .ok_or_else(|| "DRM remover not initialized".to_string())?;
    
    let input = PathBuf::from(&input_path);
    let output = output_dir.map(PathBuf::from);
    
    let result = drm.remove_drm(&input, output.as_ref())
        .map_err(|e| {
            error!("DRM removal error: {}", e);
            e.to_string()
        })?;
    
    Ok(result.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn rearrange_style(
    chapters: Vec<BookChapter>,
    style_config: StyleConfig,
    original_css: Vec<String>,
    state: State<'_, AppState>,
) -> Result<RearrangedBook, String> {
    debug!("Rearranging style for {} chapters", chapters.len());
    
    let layout_engine = state.layout_engine.lock().unwrap();
    
    let mut parsed_book = ParsedBook {
        metadata: BookMetadata::default(),
        chapters,
        css_styles: original_css,
        images: std::collections::HashMap::new(),
        fonts: std::collections::HashMap::new(),
        original_format: BookFormat::Unknown,
        drm_removed: false,
        source_path: String::new(),
    };
    
    layout_engine.rearrange_book(&parsed_book, Some(&style_config))
        .map_err(|e| {
            error!("Style rearrangement error: {}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn search_text(
    query: String,
    book_id: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
    index_path: String,
    state: State<'_, AppState>,
) -> Result<SearchResult, String> {
    debug!("Searching for: {}", query);
    
    let index_path_buf = PathBuf::from(&index_path);
    let _ = state.init_search(&index_path_buf).map_err(|e| e.to_string())?;
    
    let search_guard = state.search_engine.lock().unwrap();
    let search = search_guard.as_ref()
        .ok_or_else(|| "Search engine not initialized".to_string())?;
    
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);
    
    let result = if let Some(bid) = book_id {
        search.search_in_book(&bid, &query, limit)
    } else {
        search.search(&query, limit, offset, true)
    }.map_err(|e| {
        error!("Search error: {}", e);
        e.to_string()
    })?;
    
    Ok(result)
}

#[tauri::command]
pub async fn save_search_index(
    book: ParsedBook,
    index_path: String,
    state: State<'_, AppState>,
) -> Result<u32, String> {
    debug!("Saving search index for: {}", book.metadata.title);
    
    let index_path_buf = PathBuf::from(&index_path);
    let _ = state.init_search(&index_path_buf).map_err(|e| e.to_string())?;
    
    let mut search_guard = state.search_engine.lock().unwrap();
    let search = search_guard.as_mut()
        .ok_or_else(|| "Search engine not initialized".to_string())?;
    
    search.index_book(&book)
        .map_err(|e| {
            error!("Indexing error: {}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn load_search_index(
    index_path: String,
    state: State<'_, AppState>,
) -> Result<(u32, u32), String> {
    debug!("Loading search index from: {}", index_path);
    
    let index_path_buf = PathBuf::from(&index_path);
    let _ = state.init_search(&index_path_buf).map_err(|e| e.to_string())?;
    
    let search_guard = state.search_engine.lock().unwrap();
    let search = search_guard.as_ref()
        .ok_or_else(|| "Search engine not initialized".to_string())?;
    
    search.get_stats()
        .map_err(|e| {
            error!("Load index error: {}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn export_to_html(
    book: RearrangedBook,
    output_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    info!("Exporting to HTML: {}", output_path);
    
    let output = PathBuf::from(&output_path);
    let layout_engine = state.layout_engine.lock().unwrap();
    
    layout_engine.export_to_html(&book, &output)
        .map_err(|e| {
            error!("Export error: {}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn batch_process(
    job: BatchJob,
    state: State<'_, AppState>,
) -> Result<BatchJob, String> {
    info!("Starting batch job: {}", job.name);
    
    let result = crate::batch::processor::process_batch(job, &state)
        .await
        .map_err(|e| {
            error!("Batch processing error: {}", e);
            e.to_string()
        })?;
    
    Ok(result)
}

#[tauri::command]
pub async fn check_drm(
    path: String,
    state: State<'_, AppState>,
) -> Result<DrmInfo, String> {
    debug!("Checking DRM for: {}", path);
    
    let _ = state.init_drm().map_err(|e| e.to_string())?;
    
    let drm_guard = state.drm_remover.lock().unwrap();
    let drm = drm_guard.as_ref()
        .ok_or_else(|| "DRM remover not initialized".to_string())?;
    
    let path_buf = PathBuf::from(&path);
    
    drm.check_drm(&path_buf)
        .map_err(|e| {
            error!("DRM check error: {}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn get_default_style() -> Result<StyleConfig, String> {
    Ok(StyleConfig::default())
}

#[tauri::command]
pub async fn get_reader_style(
    font_family: String,
    font_size: f32,
    line_height: f32,
    theme: String,
    state: State<'_, AppState>,
) -> Result<StyleConfig, String> {
    let layout_engine = state.layout_engine.lock().unwrap();
    Ok(layout_engine.create_reader_style(&font_family, font_size, line_height, &theme))
}

#[tauri::command]
pub async fn scan_directory(
    dir_path: String,
    recursive: bool,
) -> Result<Vec<String>, String> {
    use walkdir::WalkDir;
    
    debug!("Scanning directory: {}", dir_path);
    
    let mut files = Vec::new();
    let extensions = ["pdf", "epub", "azw3", "azw", "mobi"];
    
    let mut walker = WalkDir::new(&dir_path);
    if !recursive {
        walker = walker.max_depth(1);
    }
    
    for entry in walker.into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
                if extensions.contains(&ext.to_lowercase().as_str()) {
                    files.push(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }
    
    debug!("Found {} ebook files", files.len());
    
    Ok(files)
}

#[tauri::command]
pub async fn list_indexed_books(
    index_path: String,
    limit: Option<u32>,
    offset: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<(String, BookMetadata)>, String> {
    let index_path_buf = PathBuf::from(&index_path);
    let _ = state.init_search(&index_path_buf).map_err(|e| e.to_string())?;
    
    let search_guard = state.search_engine.lock().unwrap();
    let search = search_guard.as_ref()
        .ok_or_else(|| "Search engine not initialized".to_string())?;
    
    search.list_books(limit.unwrap_or(100), offset.unwrap_or(0))
        .map_err(|e| {
            error!("List books error: {}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn optimize_search_index(
    index_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let index_path_buf = PathBuf::from(&index_path);
    let _ = state.init_search(&index_path_buf).map_err(|e| e.to_string())?;
    
    let search_guard = state.search_engine.lock().unwrap();
    let search = search_guard.as_ref()
        .ok_or_else(|| "Search engine not initialized".to_string())?;
    
    search.optimize_index()
        .map_err(|e| {
            error!("Optimize index error: {}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn clear_search_index(
    index_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let index_path_buf = PathBuf::from(&index_path);
    let _ = state.init_search(&index_path_buf).map_err(|e| e.to_string())?;
    
    let mut search_guard = state.search_engine.lock().unwrap();
    let search = search_guard.as_mut()
        .ok_or_else(|| "Search engine not initialized".to_string())?;
    
    search.clear_index()
        .map_err(|e| {
            error!("Clear index error: {}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn check_ocr_available(
    config: Option<OcrConfig>,
) -> Result<bool, String> {
    debug!("Checking OCR availability");
    
    let config = config.unwrap_or_default();
    let engine = OcrEngine::new(config);
    
    Ok(engine.is_available())
}

#[tauri::command]
pub async fn run_ocr(
    pdf_path: String,
    config: Option<OcrConfig>,
) -> Result<OcrResult, String> {
    info!("Running OCR on: {}", pdf_path);
    
    let config = config.unwrap_or_default();
    let engine = OcrEngine::new(config);
    
    if !engine.is_available() {
        return Err("Tesseract OCR is not available. Please install Tesseract with Chinese language support.".to_string());
    }
    
    let path_buf = PathBuf::from(&pdf_path);
    
    engine.process_pdf(&path_buf)
        .map_err(|e| {
            error!("OCR error: {}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn export_ocr_to_markdown(
    ocr_result: OcrResult,
    output_path: String,
) -> Result<(), String> {
    info!("Exporting OCR result to Markdown: {}", output_path);
    
    let exporter = MarkdownExporter::new();
    let path_buf = PathBuf::from(&output_path);
    
    if let Some(markdown) = ocr_result.markdown_content {
        exporter.save_markdown(&markdown, &path_buf)
            .map_err(|e| {
                error!("Export markdown error: {}", e);
                e.to_string()
            })
    } else {
        Err("No markdown content available".to_string())
    }
}

#[tauri::command]
pub async fn export_book_to_markdown(
    book: ParsedBook,
    output_path: String,
) -> Result<(), String> {
    info!("Exporting book to Markdown: {}", output_path);
    
    let exporter = MarkdownExporter::new();
    let path_buf = PathBuf::from(&output_path);
    
    let markdown = exporter.export_book_to_markdown(&book)
        .map_err(|e| {
            error!("Export book to markdown error: {}", e);
            e.to_string()
        })?;
    
    exporter.save_markdown(&markdown, &path_buf)
        .map_err(|e| {
            error!("Save markdown error: {}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn compare_book_versions(
    old_book: ParsedBook,
    new_book: ParsedBook,
    old_version_label: String,
    new_version_label: String,
    config: Option<DiffConfig>,
) -> Result<DiffReport, String> {
    info!(
        "Comparing book versions: {} vs {}",
        old_version_label, new_version_label
    );
    
    let config = config.unwrap_or_default();
    let engine = DiffEngine::new(config);
    
    engine.compare_books(&old_book, &new_book, &old_version_label, &new_version_label)
        .map_err(|e| {
            error!("Book comparison error: {}", e);
            e.to_string()
        })
}

#[tauri::command]
pub async fn export_diff_report(
    report: DiffReport,
    output_path: String,
    format: String,
) -> Result<(), String> {
    info!("Exporting diff report to: {} ({})", output_path, format);
    
    let path_buf = PathBuf::from(&output_path);
    
    match format.to_lowercase().as_str() {
        "html" => {
            if let Some(html) = report.html_report {
                std::fs::write(&path_buf, html)
                    .map_err(|e| {
                        error!("Export HTML report error: {}", e);
                        e.to_string()
                    })
            } else {
                Err("No HTML report available".to_string())
            }
        }
        "markdown" | "md" => {
            use crate::diff::diff_report::DiffReportGenerator;
            
            let generator = DiffReportGenerator::new();
            let markdown = generator.generate_markdown_report(&report)
                .map_err(|e| {
                    error!("Generate markdown report error: {}", e);
                    e.to_string()
                })?;
            
            generator.save_report(&markdown, &path_buf)
                .map_err(|e| {
                    error!("Export markdown report error: {}", e);
                    e.to_string()
                })
        }
        "json" => {
            let json = serde_json::to_string_pretty(&report)
                .map_err(|e| {
                    error!("Serialize diff report error: {}", e);
                    e.to_string()
                })?;
            
            std::fs::write(&path_buf, json)
                .map_err(|e| {
                    error!("Export JSON report error: {}", e);
                    e.to_string()
                })
        }
        _ => {
            Err(format!("Unsupported export format: {}", format))
        }
    }
}

#[tauri::command]
pub async fn get_default_ocr_config() -> Result<OcrConfig, String> {
    Ok(OcrConfig::default())
}

#[tauri::command]
pub async fn get_default_diff_config() -> Result<DiffConfig, String> {
    Ok(DiffConfig::default())
}
