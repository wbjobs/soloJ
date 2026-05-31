use crate::error::{GatewayError, Result};
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use flate2::read::GzEncoder;
use flate2::Compression;
use rand::RngCore;
use std::io::Read;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CryptoConfig {
    pub encryption_key: String,
    pub enable_compression: bool,
    pub enable_encryption: bool,
    pub compression_level: u32,
}

impl Default for CryptoConfig {
    fn default() -> Self {
        Self {
            encryption_key: String::new(),
            enable_compression: true,
            enable_encryption: true,
            compression_level: 6,
        }
    }
}

pub struct CryptoHandler {
    cipher: Option<Aes256Gcm>,
    config: CryptoConfig,
}

impl CryptoHandler {
    pub fn new(config: CryptoConfig) -> Result<Self> {
        let cipher = if config.enable_encryption {
            let key = Self::parse_key(&config.encryption_key)?;
            Some(Aes256Gcm::new(&key.into()))
        } else {
            None
        };

        Ok(Self { cipher, config })
    }

    pub fn config(&self) -> &CryptoConfig {
        &self.config
    }

    fn parse_key(hex_key: &str) -> Result<[u8; 32]> {
        let key_bytes = hex::decode(hex_key).map_err(|e| {
            GatewayError::Config(format!("Invalid encryption key hex: {}", e))
        })?;

        if key_bytes.len() != 32 {
            return Err(GatewayError::Config(format!(
                "Encryption key must be 32 bytes (64 hex chars), got {} bytes",
                key_bytes.len()
            )));
        }

        let mut key = [0u8; 32];
        key.copy_from_slice(&key_bytes);
        Ok(key)
    }

    pub fn process(&self, data: &[u8]) -> Result<Vec<u8>> {
        let mut processed = data.to_vec();

        if self.config.enable_compression {
            processed = self.compress(&processed)?;
            log::debug!(
                "Compressed: {} -> {} bytes ({:.1}% ratio)",
                data.len(),
                processed.len(),
                if data.len() > 0 {
                    100.0 * processed.len() as f64 / data.len() as f64
                } else {
                    0.0
                }
            );
        }

        if self.config.enable_encryption {
            processed = self.encrypt(&processed)?;
            log::debug!("Encrypted: {} bytes", processed.len());
        }

        Ok(processed)
    }

    fn compress(&self, data: &[u8]) -> Result<Vec<u8>> {
        let level = Compression::new(self.config.compression_level.min(9));
        let mut encoder = GzEncoder::new(data, level);
        let mut compressed = Vec::new();
        encoder.read_to_end(&mut compressed).map_err(|e| {
            GatewayError::Other(format!("Compression error: {}", e))
        })?;
        Ok(compressed)
    }

    fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        let cipher = self
            .cipher
            .as_ref()
            .ok_or_else(|| GatewayError::Other("Encryption not initialized".into()))?;

        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, data)
            .map_err(|e| GatewayError::Other(format!("Encryption error: {}", e)))?;

        let mut result = Vec::with_capacity(nonce_bytes.len() + ciphertext.len());
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&ciphertext);

        Ok(result)
    }

    pub fn generate_key() -> String {
        let mut key = [0u8; 32];
        rand::thread_rng().fill_bytes(&mut key);
        hex::encode(key)
    }
}

pub fn generate_encryption_key() -> String {
    CryptoHandler::generate_key()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_generation() {
        let key = generate_encryption_key();
        assert_eq!(key.len(), 64);
        assert!(hex::decode(&key).is_ok());
    }

    #[test]
    fn test_compression() {
        let key = generate_encryption_key();
        let config = CryptoConfig {
            encryption_key: key,
            enable_compression: true,
            enable_encryption: false,
            compression_level: 6,
        };
        let handler = CryptoHandler::new(config).unwrap();

        let data = b"Hello World! Hello World! Hello World!";
        let result = handler.process(data).unwrap();
        assert!(result.len() < data.len());
    }

    #[test]
    fn test_full_pipeline() {
        let key = generate_encryption_key();
        let config = CryptoConfig {
            encryption_key: key.clone(),
            enable_compression: true,
            enable_encryption: true,
            compression_level: 6,
        };
        let handler = CryptoHandler::new(config).unwrap();

        let data = b"Test data for compression and encryption pipeline";
        let result = handler.process(data).unwrap();
        assert!(!result.is_empty());
        assert_ne!(result.as_slice(), data);
    }
}
