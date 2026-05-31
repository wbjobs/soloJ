use wasm_bindgen::prelude::*;

const MAX_MESSAGE_BYTES: usize = 1_048_576;
const MAX_IMAGE_PIXELS: usize = 4096 * 4096;

fn xor_with_password(data: &mut [u8], password: &[u8]) {
    if password.is_empty() {
        return;
    }
    for (i, byte) in data.iter_mut().enumerate() {
        *byte ^= password[i % password.len()];
    }
}

#[wasm_bindgen]
pub fn encode_lsb(image_data: &[u8], message: &str, password: &str) -> Result<Vec<u8>, JsValue> {
    let mut msg_bytes = message.as_bytes().to_vec();
    let pwd_bytes = password.as_bytes();

    xor_with_password(&mut msg_bytes, pwd_bytes);

    let total_pixels = image_data.len() / 4;

    if total_pixels > MAX_IMAGE_PIXELS {
        return Err(JsValue::from_str("Image too large: maximum 4096x4096 pixels"));
    }

    if msg_bytes.len() > MAX_MESSAGE_BYTES {
        return Err(JsValue::from_str("Message too large: maximum 1MB"));
    }

    if total_pixels == 0 {
        return Err(JsValue::from_str("Invalid image data"));
    }

    let msg_len = msg_bytes.len() as u32;
    let needed_bits = 32 + msg_bytes.len() * 8;
    let max_bits = total_pixels * 3;

    if needed_bits > max_bits {
        return Err(JsValue::from_str(&format!(
            "Insufficient image capacity: need {} pixels, have {}",
            (needed_bits + 2) / 3,
            total_pixels
        )));
    }

    let mut result = image_data.to_vec();

    let mut bit_idx = 0;

    for i in (0..32).rev() {
        let bit = ((msg_len >> i) & 1) as u8;
        let px = bit_idx / 3;
        let ch = bit_idx % 3;
        let base = px * 4;
        result[base + ch] = (result[base + ch] & 0xFE) | bit;
        bit_idx += 1;
    }

    for &byte in &msg_bytes {
        for i in (0..8).rev() {
            let bit = (byte >> i) & 1;
            let px = bit_idx / 3;
            let ch = bit_idx % 3;
            let base = px * 4;
            result[base + ch] = (result[base + ch] & 0xFE) | bit;
            bit_idx += 1;
        }
    }

    Ok(result)
}

#[wasm_bindgen]
pub fn decode_lsb(image_data: &[u8], password: &str) -> Result<String, JsValue> {
    let total_pixels = image_data.len() / 4;

    if total_pixels > MAX_IMAGE_PIXELS {
        return Err(JsValue::from_str("Image too large: maximum 4096x4096 pixels"));
    }

    if total_pixels < 11 {
        return Err(JsValue::from_str("Image too small to contain hidden data"));
    }

    let get_bit = |idx: usize| -> u8 {
        let px = idx / 3;
        let ch = idx % 3;
        let base = px * 4;
        image_data[base + ch] & 1
    };

    let mut msg_len: u32 = 0;
    for i in 0..32 {
        msg_len = (msg_len << 1) | get_bit(i) as u32;
    }

    if msg_len == 0 {
        return Ok(String::new());
    }

    if msg_len > MAX_MESSAGE_BYTES as u32 {
        return Err(JsValue::from_str(&format!(
            "Invalid message length: {} bytes exceeds maximum {}",
            msg_len, MAX_MESSAGE_BYTES
        )));
    }

    let total_bits_needed = 32 + msg_len as usize * 8;
    let total_bits_available = total_pixels * 3;

    if total_bits_needed > total_bits_available {
        return Err(JsValue::from_str("Corrupted or incomplete hidden data"));
    }

    let mut msg_bytes = Vec::with_capacity(msg_len as usize);
    for i in 0..msg_len as usize {
        let offset = 32 + i * 8;
        let mut byte: u8 = 0;
        for j in 0..8 {
            byte = (byte << 1) | get_bit(offset + j);
        }
        msg_bytes.push(byte);
    }

    let pwd_bytes = password.as_bytes();
    xor_with_password(&mut msg_bytes, pwd_bytes);

    String::from_utf8(msg_bytes).map_err(|_| JsValue::from_str("Wrong password or corrupted data"))
}
