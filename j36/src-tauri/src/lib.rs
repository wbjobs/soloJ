pub mod commands;
pub mod core;
pub mod drm;
pub mod layout;
pub mod search;
pub mod batch;
pub mod ocr;
pub mod diff;
pub mod types;

pub use types::*;

use tracing_subscriber::{fmt, EnvFilter};

pub fn init_logging() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,ebook_styler_core=debug"));
    
    fmt()
        .with_env_filter(filter)
        .with_target(true)
        .with_thread_ids(false)
        .with_file(true)
        .with_line_number(true)
        .init();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use crate::core::parser::{create_element, create_chapter, generate_id};
    use crate::core::metadata::*;
    use crate::search::tokenizer::*;

    #[test]
    fn test_book_format_from_path() {
        let pdf_path = PathBuf::from("test.pdf");
        assert_eq!(BookFormat::from_path(&pdf_path), BookFormat::Pdf);
        
        let epub_path = PathBuf::from("test.epub");
        assert_eq!(BookFormat::from_path(&epub_path), BookFormat::Epub);
        
        let azw3_path = PathBuf::from("test.azw3");
        assert_eq!(BookFormat::from_path(&azw3_path), BookFormat::Azw3);
        
        let mobi_path = PathBuf::from("test.mobi");
        assert_eq!(BookFormat::from_path(&mobi_path), BookFormat::Mobi);
        
        let unknown_path = PathBuf::from("test.txt");
        assert_eq!(BookFormat::from_path(&unknown_path), BookFormat::Unknown);
    }

    #[test]
    fn test_generate_id() {
        let id1 = generate_id();
        let id2 = generate_id();
        assert_ne!(id1, id2);
        assert_eq!(id1.len(), 36);
    }

    #[test]
    fn test_create_element() {
        let elem = create_element("p", "Hello World");
        assert_eq!(elem.element_type, "p");
        assert_eq!(elem.content, "Hello World");
        assert!(elem.children.is_empty());
    }

    #[test]
    fn test_create_chapter() {
        let chapter = create_chapter("Chapter 1", 0);
        assert_eq!(chapter.title, "Chapter 1");
        assert_eq!(chapter.order, 0);
        assert!(chapter.elements.is_empty());
    }

    #[test]
    fn test_text_style_default() {
        let style = TextStyle::default();
        assert_eq!(style.font_size, 16.0);
        assert_eq!(style.line_height, 1.8);
        assert_eq!(style.color, "#000000");
    }

    #[test]
    fn test_layout_style_default() {
        let layout = LayoutStyle::default();
        assert_eq!(layout.margin_top, 40.0);
        assert_eq!(layout.column_count, 1);
        assert_eq!(layout.background_color, "#ffffff");
    }

    #[test]
    fn test_style_config_default() {
        let config = StyleConfig::default();
        assert!(config.heading_styles.contains_key("h1"));
        assert!(config.heading_styles.contains_key("h2"));
        assert!(config.heading_styles.contains_key("h3"));
        
        let h1 = &config.heading_styles["h1"];
        assert_eq!(h1.font_size, 28.0);
        assert_eq!(h1.font_weight, "bold");
    }

    #[test]
    fn test_is_chinese() {
        assert!(is_chinese('中'));
        assert!(is_chinese('文'));
        assert!(!is_chinese('A'));
        assert!(!is_chinese('1'));
        assert!(!is_chinese(' '));
    }

    #[test]
    fn test_contains_chinese() {
        assert!(contains_chinese("Hello 世界"));
        assert!(contains_chinese("中文"));
        assert!(!contains_chinese("Hello World"));
        assert!(!contains_chinese("12345"));
    }

    #[test]
    fn test_chinese_tokenizer() {
        let tokenizer = ChineseTokenizer::new();
        let tokens = tokenizer.tokenize("我爱北京天安门", false);
        assert!(!tokens.is_empty());
    }

    #[test]
    fn test_highlight_matches() {
        let text = "我爱北京天安门，天安门上太阳升";
        let highlighted = highlight_matches(text, "北京", "#ffff00");
        assert!(highlighted.contains("<span class=\"highlight\""));
        assert!(highlighted.contains("北京"));
    }

    #[test]
    fn test_highlight_matches_no_match() {
        let text = "Hello World";
        let highlighted = highlight_matches(text, "test", "#ffff00");
        assert_eq!(highlighted, text);
    }

    #[test]
    fn test_merge_ranges() {
        use crate::search::tokenizer::merge_ranges;
        
        let ranges = vec![(0, 5), (3, 8), (10, 15)];
        let merged = merge_ranges(&ranges);
        assert_eq!(merged, vec![(0, 8), (10, 15)]);
    }

    #[test]
    fn test_format_metadata() {
        let mut metadata = BookMetadata::default();
        metadata.title = "Test Book".to_string();
        metadata.authors = vec!["Author One".to_string(), "Author Two".to_string()];
        
        let formatted = format_metadata(&metadata);
        assert!(formatted.contains("Test Book"));
        assert!(formatted.contains("Author One"));
        assert!(formatted.contains("Author Two"));
    }

    #[test]
    fn test_merge_metadata() {
        let mut base = BookMetadata::default();
        base.title = "Base Title".to_string();
        
        let mut other = BookMetadata::default();
        other.authors = vec!["Test Author".to_string()];
        other.publisher = Some("Test Publisher".to_string());
        
        merge_metadata(&mut base, &other);
        
        assert_eq!(base.title, "Base Title");
        assert_eq!(base.authors, vec!["Test Author"]);
        assert_eq!(base.publisher, Some("Test Publisher".to_string()));
    }

    #[test]
    fn test_process_state_display() {
        assert_eq!(get_state_label_test("Pending"), "等待中");
        assert_eq!(get_state_label_test("Completed"), "已完成");
        assert_eq!(get_state_label_test("Failed"), "失败");
    }

    fn get_state_label_test(state: &str) -> &'static str {
        match state {
            "Pending" => "等待中",
            "Parsing" => "解析中",
            "Completed" => "已完成",
            "Failed" => "失败",
            _ => state,
        }
    }

    #[test]
    fn test_drm_type_display() {
        use crate::drm::dedrm_plugin::DrmType;
        
        assert_eq!(DrmType::None.to_string(), "None");
        assert_eq!(DrmType::Adobe.to_string(), "Adobe DRM");
        assert_eq!(DrmType::Amazon.to_string(), "Amazon DRM");
        assert_eq!(DrmType::Unknown.to_string(), "Unknown DRM");
    }

    #[test]
    fn test_export_format() {
        assert_eq!(format!("{:?}", ExportFormat::Html), "Html");
        assert_eq!(format!("{:?}", ExportFormat::Epub), "Epub");
    }
}
