#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    ebook_styler_core::init_logging();
    
    tauri::Builder::default()
        .manage(ebook_styler_core::commands::AppState::new())
        .invoke_handler(tauri::generate_handler![
            ebook_styler_core::commands::parse_ebook,
            ebook_styler_core::commands::remove_drm,
            ebook_styler_core::commands::rearrange_style,
            ebook_styler_core::commands::search_text,
            ebook_styler_core::commands::batch_process,
            ebook_styler_core::commands::get_book_metadata,
            ebook_styler_core::commands::export_to_html,
            ebook_styler_core::commands::save_search_index,
            ebook_styler_core::commands::load_search_index,
            ebook_styler_core::commands::list_indexed_books,
            ebook_styler_core::commands::optimize_search_index,
            ebook_styler_core::commands::clear_search_index,
            ebook_styler_core::commands::get_default_style,
            ebook_styler_core::commands::get_reader_style,
            ebook_styler_core::commands::scan_directory,
            ebook_styler_core::commands::check_drm,
            ebook_styler_core::commands::check_ocr_available,
            ebook_styler_core::commands::run_ocr,
            ebook_styler_core::commands::export_ocr_to_markdown,
            ebook_styler_core::commands::export_book_to_markdown,
            ebook_styler_core::commands::compare_book_versions,
            ebook_styler_core::commands::export_diff_report,
            ebook_styler_core::commands::get_default_ocr_config,
            ebook_styler_core::commands::get_default_diff_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
