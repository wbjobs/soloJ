use dicom_core::{dictionary_std::tags, DataElement, Tag, VR};
use dicom_object::{mem::InMemDicomObject, DefaultDicomObject, RootDicomObject};
use dicom_value::PrimitiveValue;
use js_sys::Uint8Array;
use regex::Regex;
use serde::Serialize;
use std::io::Cursor;
use std::sync::OnceLock;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
pub struct DicomInfo {
    pub original_patient_name: String,
    pub original_patient_id: String,
    pub masked_patient_name: String,
    pub masked_patient_id: String,
}

#[derive(Serialize)]
pub struct ProcessResult {
    pub data: Uint8Array,
    pub info: DicomInfo,
}

static MASK_REGEX: OnceLock<Regex> = OnceLock::new();

fn get_mask_regex() -> &'static Regex {
    MASK_REGEX.get_or_init(|| Regex::new(r"[a-zA-Z0-9]").unwrap())
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn free_memory() {
    std::mem::drop(js_sys::Math::random());
    web_sys::window()
        .and_then(|w| w.performance())
        .map(|p| p.memory());
}

#[wasm_bindgen]
pub fn process_dicom_stream(data: &[u8]) -> Result<JsValue, JsValue> {
    let cursor = Cursor::new(data);
    
    let obj: RootDicomObject<InMemDicomObject> = 
        DefaultDicomObject::read_dataset_from(cursor, dicom_object::ReadOptions::default())
            .map_err(|e| JsValue::from_str(&format!("Failed to parse DICOM: {}", e)))?;

    let patient_name = get_element_str(&obj, tags::PATIENT_NAME).unwrap_or_default();
    let patient_id = get_element_str(&obj, tags::PATIENT_ID).unwrap_or_default();

    let masked_name = mask_text(&patient_name);
    let masked_id = mask_text(&patient_id);

    let info = DicomInfo {
        original_patient_name: patient_name.clone(),
        original_patient_id: patient_id.clone(),
        masked_patient_name: masked_name.clone(),
        masked_patient_id: masked_id.clone(),
    };

    let patient_name_bytes = patient_name.into_bytes();
    let patient_id_bytes = patient_id.into_bytes();
    drop(patient_name);
    drop(patient_id);

    let mut output = Vec::with_capacity(data.len());
    
    let mut modified_obj = InMemDicomObject::new_empty();
    
    for elem in obj {
        let elem = elem.map_err(|e| JsValue::from_str(&format!("Element error: {}", e)))?;
        let tag = elem.tag();
        
        if tag == tags::PATIENT_NAME {
            let new_elem = DataElement::new(tag, VR::PN, PrimitiveValue::from(masked_name.clone()));
            modified_obj.put(new_elem);
        } else if tag == tags::PATIENT_ID {
            let new_elem = DataElement::new(tag, VR::LO, PrimitiveValue::from(masked_id.clone()));
            modified_obj.put(new_elem);
        } else {
            modified_obj.put(elem);
        }
    }

    drop(masked_name);
    drop(masked_id);
    drop(patient_name_bytes);
    drop(patient_id_bytes);

    modified_obj
        .write_all(&mut output)
        .map_err(|e| JsValue::from_str(&format!("Failed to write DICOM: {}", e)))?;

    drop(modified_obj);

    let array = Uint8Array::new_with_length(output.len() as u32);
    array.copy_from(&output);
    drop(output);

    let result = ProcessResult { data: array, info };
    
    serde_wasm_bindgen::to_value(&result)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn process_dicom_info_only(data: &[u8]) -> Result<JsValue, JsValue> {
    let cursor = Cursor::new(data);
    
    let obj = DefaultDicomObject::read_dataset_from(cursor, dicom_object::ReadOptions::default())
        .map_err(|e| JsValue::from_str(&format!("Failed to parse DICOM: {}", e)))?;

    let patient_name = get_element_str(&obj, tags::PATIENT_NAME).unwrap_or_default();
    let patient_id = get_element_str(&obj, tags::PATIENT_ID).unwrap_or_default();

    drop(obj);

    let info = DicomInfo {
        original_patient_name: patient_name.clone(),
        original_patient_id: patient_id.clone(),
        masked_patient_name: mask_text(&patient_name),
        masked_patient_id: mask_text(&patient_id),
    };

    serde_wasm_bindgen::to_value(&info)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn estimate_memory_usage(file_size: f64) -> f64 {
    file_size * 3.5
}

fn get_element_str(obj: &RootDicomObject<InMemDicomObject>, tag: Tag) -> Option<String> {
    obj.element(tag).ok().and_then(|e| e.to_str().ok().map(|s| s.to_string()))
}

fn mask_text(text: &str) -> String {
    if text.is_empty() {
        return text.to_string();
    }
    
    let re = get_mask_regex();
    let result: String = text
        .chars()
        .map(|c| if re.is_match(&c.to_string()) { '*' } else { c })
        .collect();
    
    if result == text {
        "*".repeat(text.len())
    } else {
        result
    }
}
