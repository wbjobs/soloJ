use anyhow::{Result, Context, bail};
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use std::time::Duration;

const SERVICE_TYPE: &str = "_p2pfile._tcp.local.";

pub struct DiscoveryService {
    mdns: ServiceDaemon,
    service_name: String,
    service_type: String,
}

pub struct PeerInfo {
    pub host: String,
    pub port: u16,
    #[allow(dead_code)]
    pub key_hint: String,
}

impl DiscoveryService {
    pub fn new() -> Result<Self> {
        let mdns = ServiceDaemon::new().context("failed to create mDNS daemon")?;
        let service_name = format!("p2pfile-{}", hex_encode(&random_bytes(4)));
        Ok(Self {
            mdns,
            service_name,
            service_type: SERVICE_TYPE.to_string(),
        })
    }

    #[allow(dead_code)]
    pub fn service_name(&self) -> &str {
        &self.service_name
    }

    pub fn register(&self, port: u16, key_hint: &str) -> Result<()> {
        let mut properties = std::collections::HashMap::new();
        properties.insert("key_hint".to_string(), key_hint.to_string());

        let service_info = ServiceInfo::new(
            &self.service_type,
            &self.service_name,
            &self.service_name,
            "",
            port,
            properties,
        ).context("failed to create ServiceInfo")?;

        self.mdns.register(service_info)
            .map_err(|e| anyhow::anyhow!("failed to register mDNS service: {}", e))?;
        Ok(())
    }

    pub fn unregister(&self) -> Result<()> {
        self.mdns.unregister(&self.service_name)
            .map_err(|e| anyhow::anyhow!("failed to unregister: {}", e))?;
        Ok(())
    }

    pub async fn browse(&self, expected_key_hint: &str, timeout: Duration) -> Result<PeerInfo> {
        let receiver = self.mdns.browse(&self.service_type).context("failed to browse mDNS")?;

        let deadline = tokio::time::Instant::now() + timeout;
        loop {
            let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
            if remaining.is_zero() {
                bail!("mDNS discovery timed out after {:?}", timeout);
            }

            let event = tokio::time::timeout(remaining, async {
                loop {
                    match receiver.recv() {
                        Ok(event) => return event,
                        Err(_) => {
                            return ServiceEvent::ServiceRemoved(
                                SERVICE_TYPE.to_string(),
                                String::new(),
                            )
                        }
                    }
                }
            })
            .await;

            match event {
                Ok(ServiceEvent::ServiceResolved(info)) => {
                    let hint_val = info
                        .get_property_val_str("key_hint")
                        .unwrap_or_default()
                        .to_string();
                    if hint_val == expected_key_hint {
                        let host = info.get_hostname().to_string();
                        let port = info.get_port();
                        return Ok(PeerInfo {
                            host,
                            port,
                            key_hint: hint_val,
                        });
                    }
                }
                Ok(_) => continue,
                Err(_) => {
                    bail!("mDNS discovery timed out after {:?}", timeout);
                }
            }
        }
    }
}

fn random_bytes(len: usize) -> Vec<u8> {
    let rng: [u8; 32] = rand::random();
    rng[..len].to_vec()
}

fn hex_encode(data: &[u8]) -> String {
    data.iter().map(|b| format!("{:02x}", b)).collect()
}
