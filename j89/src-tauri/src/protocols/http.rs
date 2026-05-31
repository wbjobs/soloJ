use regex::Regex;

pub struct HttpInfo {
    pub method: Option<String>,
    pub path: Option<String>,
    pub status_code: Option<u16>,
    pub info: String,
}

pub fn parse_http(payload: &[u8]) -> Option<HttpInfo> {
    let text = String::from_utf8_lossy(payload);

    let request_re =
        Regex::new(r"^(GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH) (\S+) HTTP/\d\.\d").unwrap();
    let response_re = Regex::new(r"^HTTP/\d\.\d (\d{3}) (.+)").unwrap();

    if let Some(captures) = request_re.captures(&text) {
        let method = captures.get(1).map(|m| m.as_str().to_string());
        let path = captures.get(2).map(|m| m.as_str().to_string());
        let info = format!(
            "{} {} HTTP/1.1",
            method.as_deref().unwrap_or(""),
            path.as_deref().unwrap_or("")
        );
        return Some(HttpInfo {
            method,
            path,
            status_code: None,
            info,
        });
    }

    if let Some(captures) = response_re.captures(&text) {
        let status_code = captures.get(1).and_then(|m| m.as_str().parse::<u16>().ok());
        let reason = captures.get(2).map(|m| m.as_str().to_string());
        let info = format!(
            "HTTP/1.1 {} {}",
            status_code.unwrap_or(0),
            reason.as_deref().unwrap_or("")
        );
        return Some(HttpInfo {
            method: None,
            path: None,
            status_code,
            info,
        });
    }

    None
}

pub fn is_http_port(port: u16) -> bool {
    matches!(port, 80 | 8080 | 3000 | 5000 | 8000)
}
