use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BookFormat {
    Pdf,
    Epub,
    Azw3,
    Mobi,
    Unknown,
}

impl BookFormat {
    pub fn from_path(path: &PathBuf) -> Self {
        match path.extension().and_then(|e| e.to_str()) {
            Some(ext) => match ext.to_lowercase().as_str() {
                "pdf" => BookFormat::Pdf,
                "epub" => BookFormat::Epub,
                "azw3" => BookFormat::Azw3,
                "mobi" => BookFormat::Mobi,
                _ => BookFormat::Unknown,
            },
            None => BookFormat::Unknown,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookMetadata {
    pub title: String,
    pub authors: Vec<String>,
    pub publisher: Option<String>,
    pub publish_date: Option<String>,
    pub isbn: Option<String>,
    pub language: Option<String>,
    pub description: Option<String>,
    pub cover_image: Option<Vec<u8>>,
    pub tags: Vec<String>,
    pub page_count: Option<u32>,
    pub file_size: u64,
    pub format: BookFormat,
    pub drm_protected: Option<bool>,
}

impl Default for BookMetadata {
    fn default() -> Self {
        BookMetadata {
            title: String::new(),
            authors: Vec::new(),
            publisher: None,
            publish_date: None,
            isbn: None,
            language: None,
            description: None,
            cover_image: None,
            tags: Vec::new(),
            page_count: None,
            file_size: 0,
            format: BookFormat::Unknown,
            drm_protected: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextStyle {
    pub font_family: String,
    pub font_size: f32,
    pub font_weight: String,
    pub font_style: String,
    pub color: String,
    pub text_align: String,
    pub line_height: f32,
    pub letter_spacing: f32,
    pub text_indent: f32,
}

impl Default for TextStyle {
    fn default() -> Self {
        TextStyle {
            font_family: "Georgia, serif".to_string(),
            font_size: 16.0,
            font_weight: "normal".to_string(),
            font_style: "normal".to_string(),
            color: "#000000".to_string(),
            text_align: "justify".to_string(),
            line_height: 1.8,
            letter_spacing: 0.0,
            text_indent: 2.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutStyle {
    pub page_width: f32,
    pub page_height: f32,
    pub margin_top: f32,
    pub margin_bottom: f32,
    pub margin_left: f32,
    pub margin_right: f32,
    pub background_color: String,
    pub column_count: u32,
    pub column_gap: f32,
}

impl Default for LayoutStyle {
    fn default() -> Self {
        LayoutStyle {
            page_width: 0.0,
            page_height: 0.0,
            margin_top: 40.0,
            margin_bottom: 40.0,
            margin_left: 50.0,
            margin_right: 50.0,
            background_color: "#ffffff".to_string(),
            column_count: 1,
            column_gap: 20.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StyleConfig {
    pub text: TextStyle,
    pub layout: LayoutStyle,
    pub heading_styles: HashMap<String, TextStyle>,
    pub custom_css: Option<String>,
}

impl Default for StyleConfig {
    fn default() -> Self {
        let mut heading_styles = HashMap::new();
        
        let mut h1 = TextStyle::default();
        h1.font_size = 28.0;
        h1.font_weight = "bold".to_string();
        h1.line_height = 1.4;
        heading_styles.insert("h1".to_string(), h1);
        
        let mut h2 = TextStyle::default();
        h2.font_size = 24.0;
        h2.font_weight = "bold".to_string();
        h2.line_height = 1.4;
        heading_styles.insert("h2".to_string(), h2);
        
        let mut h3 = TextStyle::default();
        h3.font_size = 20.0;
        h3.font_weight = "bold".to_string();
        h3.line_height = 1.4;
        heading_styles.insert("h3".to_string(), h3);
        
        StyleConfig {
            text: TextStyle::default(),
            layout: LayoutStyle::default(),
            heading_styles,
            custom_css: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentElement {
    pub id: String,
    pub element_type: String,
    pub content: String,
    pub style: Option<TextStyle>,
    pub attributes: HashMap<String, String>,
    pub children: Vec<ContentElement>,
    pub raw_html: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookChapter {
    pub id: String,
    pub title: String,
    pub order: u32,
    pub elements: Vec<ContentElement>,
    pub raw_html: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedBook {
    pub metadata: BookMetadata,
    pub chapters: Vec<BookChapter>,
    pub css_styles: Vec<String>,
    pub images: HashMap<String, Vec<u8>>,
    pub fonts: HashMap<String, Vec<u8>>,
    pub original_format: BookFormat,
    pub drm_removed: bool,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RearrangedBook {
    pub metadata: BookMetadata,
    pub html_content: String,
    pub css_content: String,
    pub style_config: StyleConfig,
    pub searchable_text: String,
    pub chapter_navigation: Vec<(String, String)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub term: String,
    pub total_results: u32,
    pub results: Vec<SearchMatch>,
    pub search_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchMatch {
    pub book_id: String,
    pub chapter_id: String,
    pub chapter_title: String,
    pub element_id: String,
    pub snippet: String,
    pub start_pos: u32,
    pub end_pos: u32,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrmInfo {
    pub drm_type: Option<String>,
    pub is_protected: bool,
    pub can_remove: bool,
    pub required_tools: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessStatus {
    pub book_id: String,
    pub status: ProcessState,
    pub progress: f32,
    pub message: String,
    pub error: Option<String>,
    pub current_step: String,
    pub total_steps: u32,
    pub completed_steps: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ProcessState {
    Pending,
    Parsing,
    RemovingDrm,
    Rearranging,
    Indexing,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchJob {
    pub id: String,
    pub name: String,
    pub input_directory: String,
    pub output_directory: String,
    pub style_config: StyleConfig,
    pub options: BatchOptions,
    pub files: Vec<BatchFile>,
    pub status: ProcessState,
    pub total_files: u32,
    pub completed_files: u32,
    pub failed_files: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchOptions {
    pub remove_drm: bool,
    pub rearrange_style: bool,
    pub create_search_index: bool,
    pub preserve_directory_structure: bool,
    pub preserve_metadata: bool,
    pub export_format: ExportFormat,
    pub overwrite_existing: bool,
}

impl Default for BatchOptions {
    fn default() -> Self {
        BatchOptions {
            remove_drm: true,
            rearrange_style: true,
            create_search_index: true,
            preserve_directory_structure: true,
            preserve_metadata: true,
            export_format: ExportFormat::Html,
            overwrite_existing: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ExportFormat {
    Html,
    Epub,
    Pdf,
    Mobipocket,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchFile {
    pub id: String,
    pub input_path: String,
    pub output_path: Option<String>,
    pub status: ProcessState,
    pub error: Option<String>,
    pub progress: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HighlightRange {
    pub start: u32,
    pub end: u32,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrConfig {
    pub languages: Vec<String>,
    pub tesseract_path: Option<String>,
    pub trained_data_path: Option<String>,
    pub dpi: u32,
    pub enable_table_detection: bool,
    pub enable_layout_analysis: bool,
    pub preserve_formatting: bool,
}

impl Default for OcrConfig {
    fn default() -> Self {
        OcrConfig {
            languages: vec!["chi_sim".to_string(), "eng".to_string()],
            tesseract_path: None,
            trained_data_path: None,
            dpi: 300,
            enable_table_detection: true,
            enable_layout_analysis: true,
            preserve_formatting: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrPageResult {
    pub page_number: u32,
    pub text: String,
    pub confidence: f32,
    pub layout_blocks: Vec<LayoutBlock>,
    pub processing_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutBlock {
    pub block_type: LayoutBlockType,
    pub text: String,
    pub bounding_box: (i32, i32, i32, i32),
    pub confidence: f32,
    pub order: u32,
    pub level: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LayoutBlockType {
    Title,
    Heading1,
    Heading2,
    Heading3,
    Paragraph,
    Table,
    TableRow,
    TableCell,
    List,
    ListItem,
    Image,
    Footnote,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrResult {
    pub pages: Vec<OcrPageResult>,
    pub total_pages: u32,
    pub average_confidence: f32,
    pub total_processing_time_ms: u64,
    pub markdown_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BookVersion {
    pub id: String,
    pub version_label: String,
    pub book: ParsedBook,
    pub imported_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffConfig {
    pub ignore_whitespace: bool,
    pub ignore_case: bool,
    pub context_lines: u32,
    pub min_diff_length: u32,
}

impl Default for DiffConfig {
    fn default() -> Self {
        DiffConfig {
            ignore_whitespace: true,
            ignore_case: false,
            context_lines: 2,
            min_diff_length: 3,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DiffType {
    Added,
    Removed,
    Modified,
    Unchanged,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffSegment {
    pub diff_type: DiffType,
    pub content: String,
    pub old_start: u32,
    pub old_end: u32,
    pub new_start: u32,
    pub new_end: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterDiff {
    pub chapter_id: String,
    pub chapter_title: String,
    pub segments: Vec<DiffSegment>,
    pub has_changes: bool,
    pub similarity_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffReport {
    pub old_version_id: String,
    pub new_version_id: String,
    pub old_version_label: String,
    pub new_version_label: String,
    pub chapter_diffs: Vec<ChapterDiff>,
    pub total_added: u32,
    pub total_removed: u32,
    pub total_modified: u32,
    pub overall_similarity: f32,
    pub generated_at: u64,
    pub html_report: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Parse error: {0}")]
    ParseError(String),
    
    #[error("DRM error: {0}")]
    DrmError(String),
    
    #[error("Layout error: {0}")]
    LayoutError(String),
    
    #[error("Search error: {0}")]
    SearchError(String),
    
    #[error("OCR error: {0}")]
    OcrError(String),
    
    #[error("Diff error: {0}")]
    DiffError(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
    
    #[error("Database error: {0}")]
    DatabaseError(#[from] rusqlite::Error),
    
    #[error("External tool error: {0}")]
    ExternalToolError(String),
    
    #[error("Unsupported format: {0:?}")]
    UnsupportedFormat(BookFormat),
    
    #[error("Other error: {0}")]
    Other(String),
}

pub type AppResult<T> = Result<T, AppError>;
