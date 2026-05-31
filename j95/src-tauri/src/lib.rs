mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_file,
            commands::read_file_chunk,
            commands::write_file,
            commands::get_file_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
