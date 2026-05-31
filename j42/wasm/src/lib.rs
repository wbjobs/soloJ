use wasm_bindgen::prelude::*;

const MAGIC_HEADER: &[u8] = b"LSB\x01";

fn xor_cipher(data: &[u8], password: &str) -> Vec<u8> {
    let password_bytes = password.as_bytes();
    if password_bytes.is_empty() {
        return data.to_vec();
    }
    data.iter()
        .enumerate()
        .map(|(i, &byte)| byte ^ password_bytes[i % password_bytes.len()])
        .collect()
}

#[wasm_bindgen]
pub fn encode_image(
    pixels: &[u8],
    width: u32,
    height: u32,
    message: &str,
    password: &str,
) -> Result<Uint8Array, JsValue> {
    let mut payload = Vec::with_capacity(MAGIC_HEADER.len() + message.as_bytes().len());
    payload.extend_from_slice(MAGIC_HEADER);
    payload.extend_from_slice(message.as_bytes());
    
    let encrypted_bytes = xor_cipher(&payload, password);
    let message_len = encrypted_bytes.len();

    let max_capacity = ((width * height * 3) / 8) - 4;
    if message_len > max_capacity as usize {
        return Err(JsValue::from_str(&format!(
            "Message too long! Max capacity: {} bytes, message size: {} bytes",
            max_capacity, message_len
        )));
    }

    let mut result = pixels.to_vec();
    let len_bytes = (message_len as u32).to_be_bytes();
    let mut bit_index = 0;

    for &byte in len_bytes.iter() {
        for bit in 0..8 {
            let pixel_offset = (bit_index / 3) * 4;
            let channel_offset = bit_index % 3;
            let pixel_byte = pixel_offset + channel_offset;

            if pixel_byte >= result.len() {
                return Err(JsValue::from_str("Image too small"));
            }

            let bit_value = (byte >> (7 - bit)) & 1;
            result[pixel_byte] = (result[pixel_byte] & 0xFE) | bit_value;
            bit_index += 1;
        }
    }

    for &byte in encrypted_bytes.iter() {
        for bit in 0..8 {
            let pixel_offset = (bit_index / 3) * 4;
            let channel_offset = bit_index % 3;
            let pixel_byte = pixel_offset + channel_offset;

            if pixel_byte >= result.len() {
                return Err(JsValue::from_str("Image too small for message"));
            }

            let bit_value = (byte >> (7 - bit)) & 1;
            result[pixel_byte] = (result[pixel_byte] & 0xFE) | bit_value;
            bit_index += 1;
        }
    }

    Ok(Uint8Array::from(&result[..]))
}

#[wasm_bindgen]
pub fn decode_image(
    pixels: &[u8],
    width: u32,
    height: u32,
    password: &str,
) -> Result<String, JsValue> {
    let mut bit_index = 0;
    let mut len_bytes = [0u8; 4];

    for byte in len_bytes.iter_mut() {
        for bit in 0..8 {
            let pixel_offset = (bit_index / 3) * 4;
            let channel_offset = bit_index % 3;
            let pixel_byte = pixel_offset + channel_offset;

            if pixel_byte >= pixels.len() {
                return Err(JsValue::from_str("Image too small to extract length"));
            }

            let lsb = pixels[pixel_byte] & 1;
            *byte = (*byte << 1) | lsb;
            bit_index += 1;
        }
    }

    let message_len = u32::from_be_bytes(len_bytes) as usize;
    let max_capacity = ((width * height * 3) / 8) as usize - 4;

    if message_len == 0 || message_len > max_capacity {
        return Err(JsValue::from_str(&format!(
            "Invalid message length: {} bytes (max: {} bytes). No hidden message found.",
            message_len, max_capacity
        )));
    }

    let mut encrypted_bytes = Vec::with_capacity(message_len);

    for _ in 0..message_len {
        let mut byte = 0u8;
        for bit in 0..8 {
            let pixel_offset = (bit_index / 3) * 4;
            let channel_offset = bit_index % 3;
            let pixel_byte = pixel_offset + channel_offset;

            if pixel_byte >= pixels.len() {
                return Err(JsValue::from_str("Image too small to extract message"));
            }

            let lsb = pixels[pixel_byte] & 1;
            byte = (byte << 1) | lsb;
            bit_index += 1;
        }
        encrypted_bytes.push(byte);
    }

    let decrypted_bytes = xor_cipher(&encrypted_bytes, password);

    if decrypted_bytes.len() < MAGIC_HEADER.len() || &decrypted_bytes[..MAGIC_HEADER.len()] != MAGIC_HEADER {
        return Err(JsValue::from_str(
            "Invalid magic header - wrong password or not a valid steganography image",
        ));
    }

    let message_bytes = &decrypted_bytes[MAGIC_HEADER.len()..];

    match String::from_utf8(message_bytes.to_vec()) {
        Ok(s) => Ok(s),
        Err(e) => {
            let bytes = e.into_bytes();
            match String::from_utf8_lossy(&bytes).into_owned() {
                s if !s.is_empty() => Ok(s),
                _ => Err(JsValue::from_str("Failed to decode UTF-8 message (wrong password?)")),
            }
        }
    }
}

#[wasm_bindgen]
pub fn calculate_psnr(original: &[u8], modified: &[u8]) -> f64 {
    if original.len() != modified.len() || original.is_empty() {
        return 0.0;
    }

    let mut mse: f64 = original
        .iter()
        .zip(modified.iter())
        .map(|(&a, &b)| {
            let diff = a as i32 - b as i32;
            (diff * diff) as f64
        })
        .sum::<f64>()
        / original.len() as f64;

    if mse == 0.0 {
        return f64::INFINITY;
    }

    let max_pixel_value = 255.0;
    10.0 * (max_pixel_value * max_pixel_value / mse).log10()
}

#[wasm_bindgen]
pub fn get_utf8_byte_length(message: &str) -> u32 {
    message.as_bytes().len() as u32
}

#[wasm_bindgen]
pub fn get_max_capacity(width: u32, height: u32) -> u32 {
    ((width * height * 3) / 8) - 4
}
