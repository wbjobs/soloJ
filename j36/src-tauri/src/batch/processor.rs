use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::task;
use tracing::{info, debug, warn, error};

use crate::types::*;
use crate::commands::AppState;
use crate::AppResult;
use super::directory_scanner::DirectoryScanner;

pub async fn process_batch(
    mut job: BatchJob,
    state: &AppState,
) -> AppResult<BatchJob> {
    info!("Starting batch processing: {}", job.name);
    
    job.status = ProcessState::Parsing;
    job.total_files = job.files.len() as u32;
    job.completed_files = 0;
    job.failed_files = 0;
    
    let input_dir = PathBuf::from(&job.input_directory);
    let output_dir = PathBuf::from(&job.output_directory);
    
    if job.files.is_empty() {
        let scanner = DirectoryScanner::new();
        job.files = scanner.create_batch_files(
            &input_dir,
            &output_dir,
            job.options.preserve_directory_structure,
            true,
        )?;
        job.total_files = job.files.len() as u32;
    }
    
    let semaphore = Arc::new(Semaphore::new(4));
    let mut handles = Vec::new();
    
    for file in &mut job.files {
        let permit = semaphore.clone().acquire_owned().await.unwrap();
        let file_clone = file.clone();
        let options_clone = job.options.clone();
        let style_config_clone = job.style_config.clone();
        
        let parser_registry = state.parser_registry.lock().unwrap().clone();
        let drm_remover = state.drm_remover.lock().unwrap().clone();
        let layout_engine = state.layout_engine.lock().unwrap().clone();
        let mut search_engine = state.search_engine.lock().unwrap().clone();
        
        let handle = task::spawn(async move {
            let _permit = permit;
            process_single_file(
                file_clone,
                &options_clone,
                &style_config_clone,
                &parser_registry,
                drm_remover.as_ref(),
                &layout_engine,
                search_engine.as_mut(),
            ).await
        });
        
        handles.push((file.id.clone(), handle));
    }
    
    for (file_id, handle) in handles {
        match handle.await {
            Ok(Ok(updated_file)) => {
                if let Some(file) = job.files.iter_mut().find(|f| f.id == file_id) {
                    *file = updated_file;
                    if file.status == ProcessState::Completed {
                        job.completed_files += 1;
                    } else if file.status == ProcessState::Failed {
                        job.failed_files += 1;
                    }
                }
            }
            Ok(Err(e)) => {
                error!("File processing error: {}", e);
                if let Some(file) = job.files.iter_mut().find(|f| f.id == file_id) {
                    file.status = ProcessState::Failed;
                    file.error = Some(e.to_string());
                    job.failed_files += 1;
                }
            }
            Err(e) => {
                error!("Task join error: {}", e);
                if let Some(file) = job.files.iter_mut().find(|f| f.id == file_id) {
                    file.status = ProcessState::Failed;
                    file.error = Some(e.to_string());
                    job.failed_files += 1;
                }
            }
        }
    }
    
    job.status = if job.failed_files == 0 {
        ProcessState::Completed
    } else if job.completed_files == 0 {
        ProcessState::Failed
    } else {
        ProcessState::Completed
    };
    
    info!(
        "Batch processing completed: {} success, {} failed",
        job.completed_files,
        job.failed_files
    );
    
    Ok(job)
}

async fn process_single_file(
    mut file: BatchFile,
    options: &BatchOptions,
    style_config: &StyleConfig,
    parser_registry: &crate::core::parser::ParserRegistry,
    drm_remover: Option<&crate::drm::drm_remover::DrmRemover>,
    layout_engine: &crate::layout::layout_engine::LayoutEngine,
    search_engine: Option<&mut crate::search::search_engine::SearchEngine>,
) -> AppResult<BatchFile> {
    file.status = ProcessState::Parsing;
    file.progress = 0.1;
    
    let input_path = PathBuf::from(&file.input_path);
    
    debug!("Processing file: {:?}", input_path);
    
    let mut parsed = parser_registry.parse_book(&input_path)?;
    file.progress = 0.25;
    
    if options.remove_drm && parsed.metadata.drm_protected.unwrap_or(false) {
        file.status = ProcessState::RemovingDrm;
        
        if let Some(drm) = drm_remover {
            let temp_output = drm.remove_drm(&input_path, None)?;
            parsed = parser_registry.parse_book(&temp_output)?;
            parsed.drm_removed = true;
        } else {
            return Err(AppError::DrmError("DRM remover not available".to_string()));
        }
    }
    file.progress = 0.5;
    
    if options.rearrange_style {
        file.status = ProcessState::Rearranging;
        
        let rearranged = layout_engine.rearrange_book(&parsed, Some(style_config))?;
        
        if let Some(output_path) = &file.output_path {
            let mut output = PathBuf::from(output_path);
            match options.export_format {
                ExportFormat::Html => {
                    output.set_extension("html");
                    layout_engine.export_to_html(&rearranged, &output)?;
                }
                ExportFormat::Epub => {
                    output.set_extension("epub");
                    export_to_epub(&rearranged, &output)?;
                }
                _ => {
                    output.set_extension("html");
                    layout_engine.export_to_html(&rearranged, &output)?;
                }
            }
            
            if options.preserve_metadata {
                let scanner = crate::batch::directory_scanner::DirectoryScanner::new();
                let _ = scanner.preserve_file_times(&input_path, &output);
            }
        }
    }
    file.progress = 0.75;
    
    if options.create_search_index {
        file.status = ProcessState::Indexing;
        
        if let Some(search) = search_engine {
            let _ = search.index_book(&parsed)?;
        }
    }
    file.progress = 1.0;
    
    file.status = ProcessState::Completed;
    
    debug!("Completed processing: {:?}", input_path);
    
    Ok(file)
}

fn export_to_epub(book: &RearrangedBook, output: &PathBuf) -> AppResult<()> {
    use zip::write::FileOptions;
    use std::io::Write;
    
    let file = std::fs::File::create(output)?;
    let mut zip = zip::ZipWriter::new(file);
    
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);
    
    zip.start_file("mimetype", options.compression_method(zip::CompressionMethod::Stored))?;
    zip.write_all(b"application/epub+zip")?;
    
    zip.start_file("META-INF/container.xml", options)?;
    zip.write_all(br#"<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"#)?;
    
    zip.start_file("OEBPS/content.opf", options)?;
    let opf_content = generate_opf(book);
    zip.write_all(opf_content.as_bytes())?;
    
    zip.start_file("OEBPS/toc.ncx", options)?;
    let toc_content = generate_toc(book);
    zip.write_all(toc_content.as_bytes())?;
    
    zip.start_file("OEBPS/styles.css", options)?;
    zip.write_all(book.css_content.as_bytes())?;
    
    zip.start_file("OEBPS/chapter001.html", options)?;
    zip.write_all(book.html_content.as_bytes())?;
    
    zip.finish()?;
    
    Ok(())
}

fn generate_opf(book: &RearrangedBook) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:{}</dc:identifier>
    <dc:title>{}</dc:title>
    {}
    <dc:language>{}</dc:language>
  </metadata>
  <manifest>
    <item id="nav" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="style" href="styles.css" media-type="text/css"/>
    <item id="chapter1" href="chapter001.html" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="nav">
    <itemref idref="chapter1"/>
  </spine>
</package>"#,
        uuid::Uuid::new_v4(),
        book.metadata.title,
        book.metadata.authors.iter()
            .map(|a| format!("<dc:creator>{}</dc:creator>", a))
            .collect::<Vec<_>>()
            .join("\n    "),
        book.metadata.language.as_deref().unwrap_or("zh")
    )
}

fn generate_toc(book: &RearrangedBook) -> String {
    let nav_points: Vec<String> = book.chapter_navigation.iter()
        .enumerate()
        .map(|(i, (title, anchor))| format!(
            r#"    <navPoint id="navPoint-{}" playOrder="{}">
      <navLabel>
        <text>{}</text>
      </navLabel>
      <content src="chapter001.html#{}"/>
    </navPoint>"#,
            i + 1,
            i + 1,
            title,
            anchor
        ))
        .collect();
    
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="{}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>{}</text>
  </docTitle>
  <navMap>
{}
  </navMap>
</ncx>"#,
        uuid::Uuid::new_v4(),
        book.metadata.title,
        nav_points.join("\n")
    )
}
