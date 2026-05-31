use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::ptr;

use crate::types::*;
use crate::AppResult;

#[link(name = "style_rearranger")]
extern "C" {
    fn style_rearranger_create() -> *mut std::ffi::c_void;
    fn style_rearranger_destroy(rearranger: *mut std::ffi::c_void);
    
    fn style_config_create() -> *mut std::ffi::c_void;
    fn style_config_destroy(config: *mut std::ffi::c_void);
    
    fn style_config_set_text_font(config: *mut std::ffi::c_void, font_family: *const c_char);
    fn style_config_set_text_size(config: *mut std::ffi::c_void, font_size: f32);
    fn style_config_set_text_color(config: *mut std::ffi::c_void, color: *const c_char);
    fn style_config_set_line_height(config: *mut std::ffi::c_void, line_height: f32);
    fn style_config_set_text_align(config: *mut std::ffi::c_void, text_align: *const c_char);
    fn style_config_set_margins(
        config: *mut std::ffi::c_void,
        top: f32,
        bottom: f32,
        left: f32,
        right: f32,
    );
    fn style_config_set_background_color(config: *mut std::ffi::c_void, color: *const c_char);
    fn style_config_set_columns(config: *mut std::ffi::c_void, count: i32, gap: f32);
    fn style_config_set_custom_css(config: *mut std::ffi::c_void, css: *const c_char);
    
    fn rearrange_book(
        rearranger: *mut std::ffi::c_void,
        chapters_json: *const c_char,
        style_config: *mut std::ffi::c_void,
        original_css_json: *const c_char,
    ) -> *mut c_char;
    
    fn free_string(str: *mut c_char);
}

pub struct StyleRearranger {
    handle: *mut std::ffi::c_void,
}

unsafe impl Send for StyleRearranger {}
unsafe impl Sync for StyleRearranger {}

impl StyleRearranger {
    pub fn new() -> Self {
        StyleRearranger {
            handle: unsafe { style_rearranger_create() },
        }
    }

    pub fn rearrange(
        &self,
        chapters: &[BookChapter],
        config: &StyleConfig,
        original_css: &[String],
    ) -> AppResult<RearrangedBook> {
        let config_handle = unsafe { style_config_create() };

        let c_font = CString::new(config.text.font_family.clone())?;
        unsafe {
            style_config_set_text_font(config_handle, c_font.as_ptr());
        }

        unsafe {
            style_config_set_text_size(config_handle, config.text.font_size);
        }

        let c_color = CString::new(config.text.color.clone())?;
        unsafe {
            style_config_set_text_color(config_handle, c_color.as_ptr());
        }

        unsafe {
            style_config_set_line_height(config_handle, config.text.line_height);
        }

        let c_align = CString::new(config.text.text_align.clone())?;
        unsafe {
            style_config_set_text_align(config_handle, c_align.as_ptr());
        }

        unsafe {
            style_config_set_margins(
                config_handle,
                config.layout.margin_top,
                config.layout.margin_bottom,
                config.layout.margin_left,
                config.layout.margin_right,
            );
        }

        let c_bg = CString::new(config.layout.background_color.clone())?;
        unsafe {
            style_config_set_background_color(config_handle, c_bg.as_ptr());
        }

        unsafe {
            style_config_set_columns(
                config_handle,
                config.layout.column_count as i32,
                config.layout.column_gap,
            );
        }

        if let Some(custom_css) = &config.custom_css {
            let c_css = CString::new(custom_css.clone())?;
            unsafe {
                style_config_set_custom_css(config_handle, c_css.as_ptr());
            }
        }

        let chapters_json = serde_json::to_string(chapters)?;
        let c_chapters = CString::new(chapters_json)?;

        let css_json = serde_json::to_string(original_css)?;
        let c_css = CString::new(css_json)?;

        let result_ptr = unsafe {
            rearrange_book(
                self.handle,
                c_chapters.as_ptr(),
                config_handle,
                c_css.as_ptr(),
            )
        };

        unsafe {
            style_config_destroy(config_handle);
        }

        if result_ptr.is_null() {
            return Err(AppError::LayoutError("Style rearrangement returned null".to_string()));
        }

        let c_str = unsafe { CStr::from_ptr(result_ptr) };
        let result_str = c_str.to_str()?.to_string();

        unsafe {
            free_string(result_ptr);
        }

        let result: serde_json::Value = serde_json::from_str(&result_str)?;

        if let Some(error) = result.get("error") {
            return Err(AppError::LayoutError(error.as_str().unwrap_or("Unknown error").to_string()));
        }

        let mut book = RearrangedBook {
            metadata: BookMetadata::default(),
            html_content: result
                .get("html_content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            css_content: result
                .get("css_content")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            style_config: config.clone(),
            searchable_text: result
                .get("searchable_text")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            chapter_navigation: result
                .get("chapter_navigation")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|item| item.as_array())
                        .filter_map(|pair| {
                            if pair.len() >= 2 {
                            Some((
                                pair[0].as_str().unwrap_or("").to_string(),
                                pair[1].as_str().unwrap_or("").to_string(),
                            ))
                        } else {
                            None
                        }
                        })
                        .collect()
                })
                .unwrap_or_default(),
        };

        Ok(book)
    }
}

impl Default for StyleRearranger {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for StyleRearranger {
    fn drop(&mut self) {
        if !self.handle.is_null() {
            unsafe {
                style_rearranger_destroy(self.handle);
            }
        }
    }
}
