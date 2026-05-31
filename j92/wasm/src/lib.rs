use wasm_bindgen::prelude::*;
use std::cmp;

const HEADER_SIZE: usize = 4;
const MAX_PIXELS: usize = 50_000_000;
const MAX_MESSAGE_SIZE: usize = 5_000_000;

#[wasm_bindgen]
pub fn hide_message(pixels: &mut [u8], message: &str) -> Result<(), JsValue> {
    if pixels.is_empty() {
        return Err(JsValue::from_str("Pixel array is empty"));
    }

    if pixels.len() > MAX_PIXELS {
        return Err(JsValue::from_str(&format!(
            "Image too large! Max supported: {} pixels, Provided: {} pixels",
            MAX_PIXELS,
            pixels.len()
        )));
    }

    let message_bytes = message.as_bytes();
    let message_len = message_bytes.len();

    if message_len > MAX_MESSAGE_SIZE {
        return Err(JsValue::from_str(&format!(
            "Message too large! Max supported: {} bytes, Provided: {} bytes",
            MAX_MESSAGE_SIZE,
            message_len
        )));
    }

    let max_capacity = (pixels.len() / 8).saturating_sub(HEADER_SIZE);
    if message_len > max_capacity {
        return Err(JsValue::from_str(&format!(
            "Message too large! Image capacity: {} bytes, Message size: {} bytes",
            max_capacity,
            message_len
        )));
    }

    let total_bits_needed = (HEADER_SIZE + message_len) * 8;
    if total_bits_needed > pixels.len() {
        return Err(JsValue::from_str(&format!(
            "Insufficient pixel data! Need {} pixels, have {}",
            total_bits_needed,
            pixels.len()
        )));
    }

    let len_bytes = (message_len as u32).to_be_bytes();
    for (i, &byte) in len_bytes.iter().enumerate() {
        let start_idx = i * 8;
        if start_idx + 7 >= pixels.len() {
            return Err(JsValue::from_str("Pixel array too small for header"));
        }
        hide_byte(pixels, byte, start_idx);
    }

    for (i, &byte) in message_bytes.iter().enumerate() {
        let start_idx = (i + HEADER_SIZE) * 8;
        if start_idx + 7 >= pixels.len() {
            return Err(JsValue::from_str(&format!(
                "Pixel array too small at byte index {}",
                i
            )));
        }
        hide_byte(pixels, byte, start_idx);
    }

    Ok(())
}

#[inline(always)]
fn hide_byte(pixels: &mut [u8], byte: u8, start_idx: usize) {
    for bit in 0..8 {
        let pixel_idx = start_idx + bit;
        let bit_value = (byte >> (7 - bit)) & 1;
        pixels[pixel_idx] = (pixels[pixel_idx] & 0xFE) | bit_value;
    }
}

#[wasm_bindgen]
pub fn extract_message(pixels: &[u8]) -> Result<String, JsValue> {
    if pixels.is_empty() {
        return Err(JsValue::from_str("Pixel array is empty"));
    }

    if pixels.len() > MAX_PIXELS {
        return Err(JsValue::from_str(&format!(
            "Image too large! Max supported: {} pixels, Provided: {} pixels",
            MAX_PIXELS,
            pixels.len()
        )));
    }

    let header_bits = HEADER_SIZE * 8;
    if pixels.len() < header_bits {
        return Err(JsValue::from_str(
            "Image too small to contain a hidden message"
        ));
    }

    let mut len_bytes = [0u8; HEADER_SIZE];
    for i in 0..HEADER_SIZE {
        let start_idx = i * 8;
        if start_idx + 7 >= pixels.len() {
            return Err(JsValue::from_str("Pixel array too small for header"));
        }
        len_bytes[i] = extract_byte(pixels, start_idx);
    }
    
    let message_len = u32::from_be_bytes(len_bytes) as usize;

    if message_len == 0 {
        return Ok(String::new());
    }

    if message_len > MAX_MESSAGE_SIZE {
        return Err(JsValue::from_str(
            "No hidden message found or message corrupted (invalid length)"
        ));
    }

    let max_capacity = (pixels.len() / 8).saturating_sub(HEADER_SIZE);
    if message_len > max_capacity {
        return Err(JsValue::from_str(&format!(
            "Message length exceeds image capacity! Stored: {} bytes, Capacity: {} bytes",
            message_len,
            max_capacity
        )));
    }

    let total_bits_needed = (HEADER_SIZE + message_len) * 8;
    if total_bits_needed > pixels.len() {
        return Err(JsValue::from_str(
            "Pixel array too small for stored message length"
        ));
    }

    let mut message_bytes = Vec::with_capacity(message_len);
    for i in 0..message_len {
        let start_idx = (i + HEADER_SIZE) * 8;
        if start_idx + 7 >= pixels.len() {
            return Err(JsValue::from_str(&format!(
                "Pixel array too small at byte index {}",
                i
            )));
        }
        message_bytes.push(extract_byte(pixels, start_idx));
    }

    String::from_utf8(message_bytes).map_err(|_| JsValue::from_str("Failed to decode message (invalid UTF-8)"))
}

#[inline(always)]
fn extract_byte(pixels: &[u8], start_idx: usize) -> u8 {
    let mut byte = 0u8;
    for bit in 0..8 {
        let pixel_idx = start_idx + bit;
        let bit_value = pixels[pixel_idx] & 1;
        byte |= bit_value << (7 - bit);
    }
    byte
}

#[wasm_bindgen]
pub fn get_max_capacity(pixels_len: usize) -> usize {
    (pixels_len / 8).saturating_sub(HEADER_SIZE)
}

#[wasm_bindgen]
pub fn can_hide_message(pixels_len: usize, message_len: usize) -> bool {
    if pixels_len > MAX_PIXELS || message_len > MAX_MESSAGE_SIZE {
        return false;
    }
    message_len <= get_max_capacity(pixels_len)
}

#[wasm_bindgen]
pub fn get_max_supported_pixels() -> usize {
    MAX_PIXELS
}

#[wasm_bindgen]
pub fn get_max_supported_message() -> usize {
    MAX_MESSAGE_SIZE
}
