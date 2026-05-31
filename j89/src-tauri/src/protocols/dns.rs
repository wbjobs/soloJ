pub struct DnsInfo {
    pub query: String,
    pub query_type: String,
    pub info: String,
}

pub fn parse_dns(payload: &[u8]) -> Option<DnsInfo> {
    if payload.len() < 12 {
        return None;
    }

    let id = u16::from_be_bytes([payload[0], payload[1]]);
    let flags = u16::from_be_bytes([payload[2], payload[3]]);
    let qr = (flags >> 15) & 1;
    let qdcount = u16::from_be_bytes([payload[4], payload[5]]);

    if qdcount == 0 {
        return None;
    }

    let mut pos = 12;
    let mut labels = Vec::new();

    while pos < payload.len() {
        let length = payload[pos] as usize;
        if length == 0 {
            pos += 1;
            break;
        }
        if length & 0xC0 == 0xC0 {
            let offset = ((length & 0x3F) as usize) << 8 | payload[pos + 1] as usize;
            if let Ok(compressed_name) = parse_compressed_name(payload, offset) {
                labels.extend(compressed_name);
            }
            pos += 2;
            break;
        }
        pos += 1;
        if pos + length > payload.len() {
            return None;
        }
        if let Ok(label) = std::str::from_utf8(&payload[pos..pos + length]) {
            labels.push(label.to_string());
        }
        pos += length;
    }

    if pos + 4 > payload.len() {
        return None;
    }

    let qtype = u16::from_be_bytes([payload[pos], payload[pos + 1]]);
    let _qclass = u16::from_be_bytes([payload[pos + 2], payload[pos + 3]]);

    let query_name = labels.join(".");
    let query_type = get_dns_type(qtype);

    let info = if qr == 0 {
        format!("Standard query {} {} {}", id, query_type, query_name)
    } else {
        format!(
            "Standard query response {} {} {}",
            id, query_type, query_name
        )
    };

    Some(DnsInfo {
        query: query_name,
        query_type: query_type.to_string(),
        info,
    })
}

fn parse_compressed_name(payload: &[u8], mut offset: usize) -> Result<Vec<String>, ()> {
    let mut labels = Vec::new();
    let mut jumps = 0;

    while offset < payload.len() && jumps < 10 {
        let length = payload[offset] as usize;
        if length == 0 {
            break;
        }
        if length & 0xC0 == 0xC0 {
            offset = ((length & 0x3F) as usize) << 8 | payload[offset + 1] as usize;
            jumps += 1;
            continue;
        }
        offset += 1;
        if offset + length > payload.len() {
            return Err(());
        }
        if let Ok(label) = std::str::from_utf8(&payload[offset..offset + length]) {
            labels.push(label.to_string());
        }
        offset += length;
    }

    Ok(labels)
}

fn get_dns_type(qtype: u16) -> &'static str {
    match qtype {
        1 => "A",
        2 => "NS",
        5 => "CNAME",
        6 => "SOA",
        12 => "PTR",
        15 => "MX",
        16 => "TXT",
        28 => "AAAA",
        33 => "SRV",
        65 => "HTTPS",
        _ => "UNKNOWN",
    }
}

pub fn is_dns_port(port: u16) -> bool {
    port == 53
}
