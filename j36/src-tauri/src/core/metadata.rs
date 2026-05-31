use crate::types::BookMetadata;

pub fn format_metadata(metadata: &BookMetadata) -> String {
    let mut output = String::new();
    
    output.push_str(&format!("Title: {}\n", metadata.title));
    
    if !metadata.authors.is_empty() {
        output.push_str(&format!("Authors: {}\n", metadata.authors.join(", ")));
    }
    
    if let Some(publisher) = &metadata.publisher {
        output.push_str(&format!("Publisher: {}\n", publisher));
    }
    
    if let Some(date) = &metadata.publish_date {
        output.push_str(&format!("Publish Date: {}\n", date));
    }
    
    if let Some(isbn) = &metadata.isbn {
        output.push_str(&format!("ISBN: {}\n", isbn));
    }
    
    if let Some(lang) = &metadata.language {
        output.push_str(&format!("Language: {}\n", lang));
    }
    
    if let Some(pages) = metadata.page_count {
        output.push_str(&format!("Pages: {}\n", pages));
    }
    
    output.push_str(&format!("File Size: {} bytes\n", metadata.file_size));
    output.push_str(&format!("Format: {:?}\n", metadata.format));
    
    if !metadata.tags.is_empty() {
        output.push_str(&format!("Tags: {}\n", metadata.tags.join(", ")));
    }
    
    if let Some(drm) = metadata.drm_protected {
        output.push_str(&format!("DRM Protected: {}\n", if drm { "Yes" } else { "No" }));
    }
    
    output
}

pub fn metadata_to_json(metadata: &BookMetadata) -> Result<String, serde_json::Error> {
    serde_json::to_string_pretty(metadata)
}

pub fn merge_metadata(base: &mut BookMetadata, other: &BookMetadata) {
    if base.title.is_empty() && !other.title.is_empty() {
        base.title = other.title.clone();
    }
    
    if base.authors.is_empty() && !other.authors.is_empty() {
        base.authors = other.authors.clone();
    }
    
    if base.publisher.is_none() && other.publisher.is_some() {
        base.publisher = other.publisher.clone();
    }
    
    if base.publish_date.is_none() && other.publish_date.is_some() {
        base.publish_date = other.publish_date.clone();
    }
    
    if base.isbn.is_none() && other.isbn.is_some() {
        base.isbn = other.isbn.clone();
    }
    
    if base.language.is_none() && other.language.is_some() {
        base.language = other.language.clone();
    }
    
    if base.description.is_none() && other.description.is_some() {
        base.description = other.description.clone();
    }
    
    if base.cover_image.is_none() && other.cover_image.is_some() {
        base.cover_image = other.cover_image.clone();
    }
    
    for tag in &other.tags {
        if !base.tags.contains(tag) {
            base.tags.push(tag.clone());
        }
    }
    
    if base.page_count.is_none() && other.page_count.is_some() {
        base.page_count = other.page_count;
    }
    
    if base.drm_protected.is_none() && other.drm_protected.is_some() {
        base.drm_protected = other.drm_protected;
    }
}
