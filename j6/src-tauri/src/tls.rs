use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;
use rustls::{Certificate, ClientConfig, RootCertStore, ServerName};
use rustls_pemfile::{certs, pkcs8_private_keys};
use tokio_rustls::TlsConnector;

use crate::models::AppError;

pub struct TlsConfig {
    pub client_config: Arc<ClientConfig>,
    pub cert_path: Option<PathBuf>,
    pub key_path: Option<PathBuf>,
    pub ca_path: Option<PathBuf>,
}

impl TlsConfig {
    pub fn new(
        ca_path: Option<PathBuf>,
        cert_path: Option<PathBuf>,
        key_path: Option<PathBuf>,
    ) -> Result<Self, AppError> {
        let mut root_store = RootCertStore::empty();

        if let Some(ca) = &ca_path {
            let ca_file = std::fs::File::open(ca)
                .map_err(|e| AppError::TlsError(format!("Failed to open CA file: {}", e)))?;
            let mut reader = std::io::BufReader::new(ca_file);
            let ca_certs = certs(&mut reader)
                .map_err(|e| AppError::TlsError(format!("Failed to read CA cert: {}", e)))?;
            for cert in ca_certs {
                root_store
                    .add(&Certificate(cert))
                    .map_err(|e| AppError::TlsError(format!("Failed to add CA cert: {}", e)))?;
            }
        } else {
            let native_certs = rustls_native_certs::load()
                .map_err(|e| AppError::TlsError(format!("Failed to load native certs: {}", e)))?;
            for cert in native_certs {
                root_store
                    .add(&Certificate(cert.0))
                    .map_err(|e| AppError::TlsError(format!("Failed to add native cert: {}", e)))?;
            }
        }

        let mut config_builder = ClientConfig::builder()
            .with_safe_defaults()
            .with_root_certificates(root_store);

        if let (Some(cert_p), Some(key_p)) = (&cert_path, &key_path) {
            let cert_file = std::fs::File::open(cert_p)
                .map_err(|e| AppError::TlsError(format!("Failed to open cert file: {}", e)))?;
            let mut cert_reader = std::io::BufReader::new(cert_file);
            let cert_chain = certs(&mut cert_reader)
                .map_err(|e| AppError::TlsError(format!("Failed to read cert: {}", e)))?
                .into_iter()
                .map(Certificate)
                .collect();

            let key_file = std::fs::File::open(key_p)
                .map_err(|e| AppError::TlsError(format!("Failed to open key file: {}", e)))?;
            let mut key_reader = std::io::BufReader::new(key_file);
            let mut keys = pkcs8_private_keys(&mut key_reader)
                .map_err(|e| AppError::TlsError(format!("Failed to read key: {}", e)))?;

            if keys.is_empty() {
                return Err(AppError::TlsError("No private key found".to_string()));
            }

            let key = rustls::PrivateKey(keys.remove(0));
            config_builder = config_builder
                .with_client_auth_cert(cert_chain, key)
                .map_err(|e| AppError::TlsError(format!("Failed to set client auth: {}", e)))?;
        }

        let client_config = Arc::new(config_builder.with_no_client_auth());

        Ok(Self {
            client_config,
            cert_path,
            key_path,
            ca_path,
        })
    }

    pub fn connector(&self) -> TlsConnector {
        TlsConnector::from(self.client_config.clone())
    }

    pub fn connect_dangerous() -> Result<TlsConnector, AppError> {
        let mut root_store = RootCertStore::empty();

        let mut client_config = ClientConfig::builder()
            .with_safe_defaults()
            .with_root_certificates(root_store)
            .with_custom_certificate_verifier(Arc::new(NoCertificateVerification))
            .with_no_client_auth();

        client_config
            .dangerous()
            .set_certificate_verifier(Arc::new(NoCertificateVerification));

        Ok(TlsConnector::from(Arc::new(client_config)))
    }
}

#[derive(Debug)]
struct NoCertificateVerification;

impl rustls::client::ServerCertVerifier for NoCertificateVerification {
    fn verify_server_cert(
        &self,
        _end_entity: &Certificate,
        _intermediates: &[Certificate],
        _server_name: &ServerName,
        _scts: &mut dyn Iterator<Item = &[u8]>,
        _ocsp_response: &[u8],
        _now: std::time::SystemTime,
    ) -> Result<rustls::client::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::ServerCertVerified::assertion())
    }
}
