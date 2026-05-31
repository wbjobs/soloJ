use std::path::PathBuf;
use std::fs;
use tracing::{info, debug};
use crate::types::*;
use crate::AppResult;
use super::ffi::StyleRearranger;

pub struct LayoutEngine {
    rearranger: StyleRearranger,
    default_style: StyleConfig,
}

impl LayoutEngine {
    pub fn new() -> Self {
        LayoutEngine {
            rearranger: StyleRearranger::new(),
            default_style: StyleConfig::default(),
        }
    }

    pub fn with_default_style(style: StyleConfig) -> Self {
        LayoutEngine {
            rearranger: StyleRearranger::new(),
            default_style: style,
        }
    }

    pub fn rearrange_book(
        &self,
        parsed_book: &ParsedBook,
        style_config: Option<&StyleConfig>,
    ) -> AppResult<RearrangedBook> {
        info!("Rearranging book: {}", parsed_book.metadata.title);

        let style = style_config.unwrap_or(&self.default_style);

        let mut result = self.rearranger.rearrange(
            &parsed_book.chapters,
            style,
            &parsed_book.css_styles,
        )?;

        result.metadata = parsed_book.metadata.clone();

        debug!("Rearranged book has {} navigation entries", result.chapter_navigation.len());

        Ok(result)
    }

    pub fn export_to_html(
        &self,
        book: &RearrangedBook,
        output_path: &PathBuf,
    ) -> AppResult<()> {
        info!("Exporting rearranged book to HTML: {:?}", output_path);

        let mut html = String::new();

        html.push_str("<!DOCTYPE html>\n");
        html.push_str("<html>\n");
        html.push_str("<head>\n");
        html.push_str("  <meta charset=\"UTF-8\">\n");
        html.push_str(&format!("  <title>{}</title>\n", book.metadata.title);
        html.push_str("  <style>\n");
        html.push_str(&book.css_content);
        html.push_str("  </style>\n");
        html.push_str("</head>\n");
        html.push_str("<body>\n");

        if let Some(cover) = &book.metadata.cover_image {
            let base64 = base64_encode(cover);
            html.push_str(&format!(
                "  <div style=\"text-align: center; margin-bottom: 2em;\">\n"
            ));
            html.push_str(&format!(
                "    <img src=\"data:image/jpeg;base64,{}\" alt=\"Cover\" style=\"max-width: 50%; height: auto;\"/>\n",
                base64
            ));
            html.push_str("  </div>\n");
        }

        html.push_str(&book.html_content);

        html.push_str("</body>\n");
        html.push_str("</html>\n");

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(output_path, html)?;

        Ok(())
    }

    pub fn export_searchable_text(
        &self,
        book: &RearrangedBook,
        output_path: &PathBuf,
    ) -> AppResult<()> {
        let mut content = String::new();

        content.push_str(&format!("Title: {}\n", book.metadata.title));
        content.push_str(&format!(
            "Authors: {}\n\n",
            book.metadata.authors.join(", ")
        ));

        if let Some(publisher) = &book.metadata.publisher {
            content.push_str(&format!("Publisher: {}\n", publisher));
        }

        if let Some(date) = &book.metadata.publish_date {
            content.push_str(&format!("Published: {}\n", date));
        }

        content.push_str("\n---\n\n");
        content.push_str(&book.searchable_text);

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(output_path, content)?;

        Ok(())
    }

    pub fn get_default_style(&self) -> &StyleConfig {
        &self.default_style
    }

    pub fn set_default_style(&mut self, style: StyleConfig) {
        self.default_style = style;
    }

    pub fn create_reader_style(
        &self,
        font_family: &str,
        font_size: f32,
        line_height: f32,
        theme: &str,
    ) -> StyleConfig {
        let mut config = match theme {
            "dark" => {
                let mut cfg = StyleConfig::default();
                cfg.text.color = "#e0e0e0".to_string();
                cfg.layout.background_color = "#1a1a1a".to_string();
                cfg
            }
            "sepia" => {
                let mut cfg = StyleConfig::default();
                cfg.text.color = "#5c4b37".to_string();
                cfg.layout.background_color = "#f4ecd8".to_string();
                cfg
            }
            _ => StyleConfig::default(),
        };

        let text = &mut config.text;
        text.font_family = font_family.to_string();
        text.font_size = font_size;
        text.line_height = line_height;

        config
    }
}

impl Default for LayoutEngine {
    fn default() -> Self {
        Self::new()
    }
}

fn base64_encode(data: &[u8]) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = Vec::new();
    let mut i = 0;

    while i < data.len() {
        let b1 = data[i];
        let b2 = if i + 1 < data.len() { data[i + 1] } else { 0 };
        let b3 = if i + 2 < data.len() { data[i + 2] } else { 0 };

        let enc1 = (b1 >> 2;
        let enc2 = ((b1 & 0x03) << 4) | (b2 >> 4);
        let enc3 = ((b2 & 0x0f) << 2) | (b3 >> 6);
        let enc4 = b3 & 0x3f;

        result.push(CHARSET[enc1 as usize]);
        result.push(CHARSET[enc2 as usize]);

        if i + 1 < data.len() {
            result.push(CHARSET[enc3 as usize]);
        } else {
            result.push(b'=');
        }

        if i + 2 < data.len() {
            result.push(CHARSET[enc4 as usize]);
        } else {
            result.push(b'=');
        }

        i += 3;
    }

    String::from_utf8(result).unwrap_or_default()
}
