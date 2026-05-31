use dicom::object::{FileDicomObject, InMemDicomObject, StandardDataDictionary};
use dicom::pixeldata::PixelDecoder;
use serde::Serialize;
use wasm_bindgen::prelude::*;
use dicom::core::Tag;
use js_sys::Uint8Array;
use web_sys::ImageData;
use std::io::Write;

const MAX_DICOM_FILE_SIZE: usize = 512 * 1024 * 1024;
const MAX_PIXEL_DIMENSION: u32 = 4096;
const CHUNK_ROW_COUNT: u32 = 64;

#[derive(Serialize)]
pub struct DicomMetadata {
    pub patient_name: String,
    pub patient_id: String,
    pub patient_birth_date: String,
    pub patient_sex: String,
    pub study_date: String,
    pub study_time: String,
    pub accession_number: String,
    pub institution_name: String,
    pub referring_physician: String,
    pub study_description: String,
    pub series_description: String,
    pub modality: String,
    pub manufacturer: String,
    pub rows: u32,
    pub columns: u32,
    pub bits_allocated: u16,
    pub bits_stored: u16,
    pub samples_per_pixel: u16,
    pub photometric_interpretation: String,
}

#[derive(Serialize)]
pub struct DicomParseResult {
    pub metadata: DicomMetadata,
    pub pixel_data: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

fn read_tag_string(obj: &FileDicomObject<InMemDicomObject<StandardDataDictionary>>, tag: Tag) -> String {
    obj.element(tag)
        .and_then(|e| e.to_str().map(|s| s.to_string()))
        .unwrap_or_default()
}

fn read_tag_u32(obj: &FileDicomObject<InMemDicomObject<StandardDataDictionary>>, tag: Tag) -> u32 {
    obj.element(tag)
        .and_then(|e| e.to_int::<u32>())
        .unwrap_or(0)
}

fn read_tag_u16(obj: &FileDicomObject<InMemDicomObject<StandardDataDictionary>>, tag: Tag) -> u16 {
    obj.element(tag)
        .and_then(|e| e.to_int::<u16>())
        .unwrap_or(0)
}

fn extract_metadata_from_obj(obj: &FileDicomObject<InMemDicomObject<StandardDataDictionary>>) -> DicomMetadata {
    DicomMetadata {
        patient_name: read_tag_string(obj, Tag(0x0010, 0x0010)),
        patient_id: read_tag_string(obj, Tag(0x0010, 0x0020)),
        patient_birth_date: read_tag_string(obj, Tag(0x0010, 0x0030)),
        patient_sex: read_tag_string(obj, Tag(0x0010, 0x0040)),
        study_date: read_tag_string(obj, Tag(0x0008, 0x0020)),
        study_time: read_tag_string(obj, Tag(0x0008, 0x0030)),
        accession_number: read_tag_string(obj, Tag(0x0008, 0x0050)),
        institution_name: read_tag_string(obj, Tag(0x0008, 0x0080)),
        referring_physician: read_tag_string(obj, Tag(0x0008, 0x0090)),
        study_description: read_tag_string(obj, Tag(0x0008, 0x1030)),
        series_description: read_tag_string(obj, Tag(0x0008, 0x103E)),
        modality: read_tag_string(obj, Tag(0x0008, 0x0060)),
        manufacturer: read_tag_string(obj, Tag(0x0008, 0x0070)),
        rows: read_tag_u32(obj, Tag(0x0028, 0x0010)),
        columns: read_tag_u32(obj, Tag(0x0028, 0x0011)),
        bits_allocated: read_tag_u16(obj, Tag(0x0028, 0x0100)),
        bits_stored: read_tag_u16(obj, Tag(0x0028, 0x0101)),
        samples_per_pixel: read_tag_u16(obj, Tag(0x0028, 0x0002)),
        photometric_interpretation: read_tag_string(obj, Tag(0x0028, 0x0004)),
    }
}

fn normalize_pixel_data(
    pixel_data: &[u8],
    rows: u32,
    columns: u32,
    bits_stored: u16,
    photometric_interpretation: &str,
) -> Vec<u8> {
    let pixel_count = (rows * columns) as usize;
    
    if photometric_interpretation.contains("RGB") || photometric_interpretation.contains("COLOR") {
        let mut rgba = Vec::with_capacity(pixel_count * 4);
        for i in (0..pixel_data.len()).step_by(3) {
            if i + 2 < pixel_data.len() {
                rgba.push(pixel_data[i]);
                rgba.push(pixel_data[i + 1]);
                rgba.push(pixel_data[i + 2]);
                rgba.push(255);
            }
        }
        return rgba;
    }

    let mut rgba = Vec::with_capacity(pixel_count * 4);
    
    if bits_stored <= 8 {
        for &pixel in pixel_data.iter().take(pixel_count) {
            rgba.push(pixel);
            rgba.push(pixel);
            rgba.push(pixel);
            rgba.push(255);
        }
    } else {
        for i in (0..pixel_count * 2).step_by(2) {
            if i + 1 < pixel_data.len() {
                let pixel = ((pixel_data[i + 1] as u16) << 8) | (pixel_data[i] as u16);
                let normalized = ((pixel as f32 / ((1 << bits_stored) - 1) as f32) * 255.0) as u8;
                rgba.push(normalized);
                rgba.push(normalized);
                rgba.push(normalized);
                rgba.push(255);
            }
        }
    }
    
    rgba
}

fn normalize_pixel_rows(
    pixel_data: &[u8],
    start_row: u32,
    row_count: u32,
    columns: u32,
    bits_stored: u16,
    samples_per_pixel: u16,
    photometric_interpretation: &str,
) -> Vec<u8> {
    let pixel_count = (row_count * columns) as usize;
    
    if photometric_interpretation.contains("RGB") || photometric_interpretation.contains("COLOR") {
        let bytes_per_pixel = samples_per_pixel as usize;
        let row_bytes = columns as usize * bytes_per_pixel;
        let offset = start_row as usize * row_bytes;
        let end = offset + pixel_count * bytes_per_pixel;
        let slice = &pixel_data[offset.min(pixel_data.len())..end.min(pixel_data.len())];
        
        let mut rgba = Vec::with_capacity(pixel_count * 4);
        for i in (0..slice.len()).step_by(3) {
            if i + 2 < slice.len() {
                rgba.push(slice[i]);
                rgba.push(slice[i + 1]);
                rgba.push(slice[i + 2]);
                rgba.push(255);
            }
        }
        return rgba;
    }

    let mut rgba = Vec::with_capacity(pixel_count * 4);
    
    if bits_stored <= 8 {
        let row_bytes = columns as usize;
        let offset = start_row as usize * row_bytes;
        let end = offset + pixel_count;
        for &pixel in pixel_data.iter().skip(offset).take(pixel_count.min(end.saturating_sub(offset))) {
            rgba.push(pixel);
            rgba.push(pixel);
            rgba.push(pixel);
            rgba.push(255);
        }
    } else {
        let row_bytes = columns as usize * 2;
        let offset = start_row as usize * row_bytes;
        let end = offset + pixel_count * 2;
        let slice = &pixel_data[offset.min(pixel_data.len())..end.min(pixel_data.len())];
        
        for i in (0..slice.len()).step_by(2) {
            if i + 1 < slice.len() {
                let pixel = ((slice[i + 1] as u16) << 8) | (slice[i] as u16);
                let normalized = ((pixel as f32 / ((1 << bits_stored) - 1) as f32) * 255.0) as u8;
                rgba.push(normalized);
                rgba.push(normalized);
                rgba.push(normalized);
                rgba.push(255);
            }
        }
    }
    
    rgba
}

fn validate_dimensions(rows: u32, columns: u32) -> Result<(), JsValue> {
    if rows == 0 || columns == 0 {
        return Err(JsValue::from_str("Invalid DICOM image dimensions: rows or columns is zero"));
    }
    if rows > MAX_PIXEL_DIMENSION || columns > MAX_PIXEL_DIMENSION {
        return Err(JsValue::from_str(&format!(
            "DICOM image too large: {}x{} exceeds maximum allowed {}x{}",
            columns, rows, MAX_PIXEL_DIMENSION, MAX_PIXEL_DIMENSION
        )));
    }
    let total_pixels = rows as u64 * columns as u64;
    let rgba_size = total_pixels * 4;
    if rgba_size > 2u64 * 1024 * 1024 * 1024 {
        return Err(JsValue::from_str(&format!(
            "Pixel data too large: {} bytes would be needed for RGBA buffer",
            rgba_size
        )));
    }
    Ok(())
}

#[wasm_bindgen]
pub fn parse_dicom(data: &[u8]) -> Result<JsValue, JsValue> {
    if data.len() > MAX_DICOM_FILE_SIZE {
        return Err(JsValue::from_str(&format!(
            "File too large: {} bytes exceeds maximum {} bytes. Use parse_metadata + parse_pixel_data_direct for large files.",
            data.len(), MAX_DICOM_FILE_SIZE
        )));
    }

    let obj = FileDicomObject::<InMemDicomObject<StandardDataDictionary>>::from_reader(data)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse DICOM: {}", e)))?;

    let metadata = extract_metadata_from_obj(&obj);
    validate_dimensions(metadata.rows, metadata.columns)?;

    let photometric = metadata.photometric_interpretation.clone();
    let bits_stored = metadata.bits_stored;
    let rows = metadata.rows;
    let columns = metadata.columns;

    let pixel_data: Vec<u8> = match obj.decode_pixel_data() {
        Ok(decoded) => {
            let raw_data = decoded.to_pixel_vec()
                .map_err(|e| JsValue::from_str(&format!("Failed to get pixel data: {}", e)))?;
            normalize_pixel_data(&raw_data, rows, columns, bits_stored, &photometric)
        }
        Err(_) => {
            let pixel_data_element = obj.element(Tag(0x7FE0, 0x0010))
                .map_err(|e| JsValue::from_str(&format!("No pixel data found: {}", e)))?;
            let raw_bytes = pixel_data_element.to_bytes()
                .map_err(|e| JsValue::from_str(&format!("Failed to read pixel bytes: {}", e)))?;
            normalize_pixel_data(raw_bytes, rows, columns, bits_stored, &photometric)
        }
    };

    let result = DicomParseResult {
        metadata,
        pixel_data,
        width: columns,
        height: rows,
    };

    serde_json::to_string(&result)
        .map(|s| JsValue::from_str(&s))
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
}

#[wasm_bindgen]
pub fn extract_metadata(data: &[u8]) -> Result<JsValue, JsValue> {
    let obj = FileDicomObject::<InMemDicomObject<StandardDataDictionary>>::from_reader(data)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse DICOM: {}", e)))?;

    let metadata = extract_metadata_from_obj(&obj);

    serde_json::to_string(&metadata)
        .map(|s| JsValue::from_str(&s))
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize metadata: {}", e)))
}

#[wasm_bindgen]
pub struct DicomPixelParser {
    raw_pixel_data: Vec<u8>,
    rows: u32,
    columns: u32,
    bits_stored: u16,
    samples_per_pixel: u16,
    photometric_interpretation: String,
    current_row: u32,
}

#[wasm_bindgen]
impl DicomPixelParser {
    #[wasm_bindgen(constructor)]
    pub fn new(data: &[u8]) -> Result<DicomPixelParser, JsValue> {
        let obj = FileDicomObject::<InMemDicomObject<StandardDataDictionary>>::from_reader(data)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse DICOM: {}", e)))?;

        let rows = read_tag_u32(&obj, Tag(0x0028, 0x0010));
        let columns = read_tag_u32(&obj, Tag(0x0028, 0x0011));
        let bits_stored = read_tag_u16(&obj, Tag(0x0028, 0x0101));
        let samples_per_pixel = read_tag_u16(&obj, Tag(0x0028, 0x0002));
        let photometric_interpretation = read_tag_string(&obj, Tag(0x0028, 0x0004));

        validate_dimensions(rows, columns)?;

        let raw_pixel_data = match obj.decode_pixel_data() {
            Ok(decoded) => {
                decoded.to_pixel_vec()
                    .map_err(|e| JsValue::from_str(&format!("Failed to get pixel data: {}", e)))?
            }
            Err(_) => {
                let pixel_data_element = obj.element(Tag(0x7FE0, 0x0010))
                    .map_err(|e| JsValue::from_str(&format!("No pixel data found: {}", e)))?;
                let raw_bytes = pixel_data_element.to_bytes()
                    .map_err(|e| JsValue::from_str(&format!("Failed to read pixel bytes: {}", e)))?;
                raw_bytes.to_vec()
            }
        };

        Ok(DicomPixelParser {
            raw_pixel_data,
            rows,
            columns,
            bits_stored,
            samples_per_pixel,
            photometric_interpretation,
            current_row: 0,
        })
    }

    pub fn metadata_json(&self) -> Result<JsValue, JsValue> {
        let obj = FileDicomObject::<InMemDicomObject<StandardDataDictionary>>::from_reader(&self.raw_pixel_data)
            .ok();
        
        let meta = DicomMetadata {
            patient_name: String::new(),
            patient_id: String::new(),
            patient_birth_date: String::new(),
            patient_sex: String::new(),
            study_date: String::new(),
            study_time: String::new(),
            accession_number: String::new(),
            institution_name: String::new(),
            referring_physician: String::new(),
            study_description: String::new(),
            series_description: String::new(),
            modality: String::new(),
            manufacturer: String::new(),
            rows: self.rows,
            columns: self.columns,
            bits_allocated: 0,
            bits_stored: self.bits_stored,
            samples_per_pixel: self.samples_per_pixel,
            photometric_interpretation: self.photometric_interpretation.clone(),
        };

        serde_json::to_string(&meta)
            .map(|s| JsValue::from_str(&s))
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize metadata: {}", e)))
    }

    pub fn rows(&self) -> u32 {
        self.rows
    }

    pub fn columns(&self) -> u32 {
        self.columns
    }

    pub fn has_more_chunks(&self) -> bool {
        self.current_row < self.rows
    }

    pub fn next_chunk_rgba(&mut self) -> Result<JsValue, JsValue> {
        if self.current_row >= self.rows {
            return Err(JsValue::from_str("No more chunks available"));
        }

        let end_row = (self.current_row + CHUNK_ROW_COUNT).min(self.rows);
        let row_count = end_row - self.current_row;

        let rgba = normalize_pixel_rows(
            &self.raw_pixel_data,
            self.current_row,
            row_count,
            self.columns,
            self.bits_stored,
            self.samples_per_pixel,
            &self.photometric_interpretation,
        );

        self.current_row = end_row;

        let chunk_info = serde_json::json!({
            "data": rgba,
            "start_row": self.current_row - row_count,
            "row_count": row_count,
            "columns": self.columns,
        });

        serde_json::to_string(&chunk_info)
            .map(|s| JsValue::from_str(&s))
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize chunk: {}", e)))
    }

    pub fn full_rgba(&self) -> Result<Vec<u8>, JsValue> {
        normalize_pixel_rows(
            &self.raw_pixel_data,
            0,
            self.rows,
            self.columns,
            self.bits_stored,
            self.samples_per_pixel,
            &self.photometric_interpretation,
        )
    }

    pub fn reset(&mut self) {
        self.current_row = 0;
    }
}

const SENSITIVE_TAGS: &[Tag] = &[
    Tag(0x0010, 0x0010), // Patient's Name
    Tag(0x0010, 0x0020), // Patient ID
    Tag(0x0010, 0x0021), // Issuer of Patient ID
    Tag(0x0010, 0x0030), // Patient's Birth Date
    Tag(0x0010, 0x0032), // Patient's Birth Time
    Tag(0x0010, 0x0033), // Patient's Birth Date in Alternative Calendar
    Tag(0x0010, 0x0034), // Patient's Death Date in Alternative Calendar
    Tag(0x0010, 0x0035), // Patient's Alternative Calendar
    Tag(0x0010, 0x0040), // Patient's Sex
    Tag(0x0010, 0x0050), // Patient's Insurance Plan Code Sequence
    Tag(0x0010, 0x1000), // Other Patient IDs
    Tag(0x0010, 0x1001), // Other Patient Names
    Tag(0x0010, 0x1002), // Other Patient IDs Sequence
    Tag(0x0010, 0x1005), // Patient's Birth Name
    Tag(0x0010, 0x1010), // Patient's Address
    Tag(0x0010, 0x1020), // Patient's Phone Numbers
    Tag(0x0010, 0x1030), // Patient's Mother's Birth Name
    Tag(0x0010, 0x1040), // Patient's Address - needs loookup
    Tag(0x0010, 0x1050), // Patient's Insurance Plan Code Seq
    Tag(0x0010, 0x1060), // Patient's Military Rank
    Tag(0x0010, 0x1080), // Patient's Religious Preference
    Tag(0x0010, 0x2000), // Medical Alerts
    Tag(0x0010, 0x2110), // Allergies
    Tag(0x0010, 0x2150), // Country of Residence
    Tag(0x0010, 0x2152), // Region of Residence
    Tag(0x0010, 0x2154), // Patient's Telephone Numbers
    Tag(0x0010, 0x2155), // Patient's Telecom Information
    Tag(0x0010, 0x2160), // Ethnic Group
    Tag(0x0010, 0x2180), // Occupation
    Tag(0x0010, 0x21A0), // Smoking Status
    Tag(0x0010, 0x21B0), // Additional Patient History
    Tag(0x0010, 0x21C0), // Pregnancy Status
    Tag(0x0010, 0x21D0), // Last Menstrual Date
    Tag(0x0010, 0x21F0), // Patient's Religious Preference
    Tag(0x0010, 0x2201), // Patient Species Description
    Tag(0x0010, 0x2202), // Patient Species Code Sequence
    Tag(0x0010, 0x2203), // Patient's Sex Neutered
    Tag(0x0010, 0x2293), // Patient Breed Description
    Tag(0x0010, 0x2294), // Patient Breed Code Sequence
    Tag(0x0010, 0x2295), // Breed Registration Sequence
    Tag(0x0010, 0x2296), // Breed Registration Number
    Tag(0x0010, 0x2297), // Responsible Person
    Tag(0x0010, 0x2298), // Responsible Person Role
    Tag(0x0010, 0x2299), // Responsible Organization
    Tag(0x0008, 0x0050), // Accession Number
    Tag(0x0008, 0x0020), // Study Date
    Tag(0x0008, 0x0030), // Study Time
    Tag(0x0008, 0x0080), // Institution Name
    Tag(0x0008, 0x0081), // Institution Address
    Tag(0x0008, 0x0082), // Institution Code Sequence
    Tag(0x0008, 0x0090), // Referring Physician's Name
    Tag(0x0008, 0x0092), // Referring Physician's Address
    Tag(0x0008, 0x0094), // Referring Physician's Telephone Numbers
    Tag(0x0008, 0x0096), // Referring Physician Identification Sequence
    Tag(0x0008, 0x1010), // Station Name
    Tag(0x0008, 0x1040), // Institutional Department Name
    Tag(0x0008, 0x1048), // Physician(s) of Record
    Tag(0x0008, 0x1049), // Physician(s) of Record Identification Sequence
    Tag(0x0008, 0x1050), // Performing Physician's Name
    Tag(0x0008, 0x1052), // Performing Physician Identification Sequence
    Tag(0x0008, 0x1060), // Name of Physician(s) Reading Study
    Tag(0x0008, 0x1062), // Physician(s) Reading Study Identification Seq
    Tag(0x0008, 0x1070), // Operators' Name
    Tag(0x0008, 0x1080), // Admitting Diagnoses Description
    Tag(0x0008, 0x1084), // Admitting Diagnoses Code Sequence
    Tag(0x0032, 0x1032), // Requesting Physician
    Tag(0x0032, 0x1033), // Requesting Service
    Tag(0x0032, 0x1060), // Requested Procedure Description
];

#[wasm_bindgen]
pub fn anonymize_dicom(data: &[u8]) -> Result<Vec<u8>, JsValue> {
    if data.len() > MAX_DICOM_FILE_SIZE {
        return Err(JsValue::from_str(&format!(
            "File too large: {} bytes exceeds maximum {} bytes",
            data.len(), MAX_DICOM_FILE_SIZE
        )));
    }

    let file_obj = FileDicomObject::<InMemDicomObject<StandardDataDictionary>>::from_reader(data)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse DICOM: {}", e)))?;

    let preamble = *file_obj.preamble();
    let meta = file_obj.meta().clone();
    let mut inner = file_obj.into_inner();

    for tag in SENSITIVE_TAGS.iter() {
        let _ = inner.remove(*tag);
    }

    let modified = FileDicomObject::new(preamble, meta, inner);

    let mut result = Vec::with_capacity(data.len());
    modified.write_all(&mut result)
        .map_err(|e| JsValue::from_str(&format!("Failed to write anonymized DICOM: {}", e)))?;

    Ok(result)
}

#[wasm_bindgen]
pub fn parse_metadata_only(data: &[u8]) -> Result<JsValue, JsValue> {
    if data.len() > MAX_DICOM_FILE_SIZE {
        return Err(JsValue::from_str(&format!(
            "File too large: {} bytes exceeds maximum {} bytes",
            data.len(), MAX_DICOM_FILE_SIZE
        )));
    }

    let obj = FileDicomObject::<InMemDicomObject<StandardDataDictionary>>::from_reader(data)
        .map_err(|e| JsValue::from_str(&format!("Failed to parse DICOM: {}", e)))?;

    let metadata = extract_metadata_from_obj(&obj);

    serde_json::to_string(&metadata)
        .map(|s| JsValue::from_str(&s))
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize metadata: {}", e)))
}
