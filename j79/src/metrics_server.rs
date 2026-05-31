use crate::config::MetricsConfig;
use crate::error::{GatewayError, Result};
use crate::metrics::MetricsCollector;
use http_body_util::Full;
use hyper::body::Bytes;
use hyper::service::service_fn;
use hyper::{Request, Response};
use hyper_util::rt::TokioIo;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::watch;

pub async fn start_metrics_server(
    config: MetricsConfig,
    metrics: Arc<MetricsCollector>,
    mut shutdown: watch::Receiver<bool>,
) -> Result<()> {
    if !config.enabled {
        log::info!("Metrics server is disabled");
        return Ok(());
    }

    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .map_err(|e| GatewayError::Config(format!("Invalid metrics address: {}", e)))?;

    log::info!("Starting metrics server on http://{}", addr);

    let listener = TcpListener::bind(addr)
        .await
        .map_err(|e| GatewayError::Other(format!("Failed to bind metrics server: {}", e)))?;

    loop {
        tokio::select! {
            result = listener.accept() => {
                match result {
                    Ok((stream, _)) => {
                        let io = TokioIo::new(stream);
                        let metrics_clone = metrics.clone();

                        tokio::spawn(async move {
                            let service = service_fn(move |req: Request<hyper::body::Incoming>| {
                                let metrics = metrics_clone.clone();
                                async move { handle_request(req, metrics).await }
                            });

                            if let Err(err) = hyper::server::conn::http1::Builder::new()
                                .serve_connection(io, service)
                                .await
                            {
                                log::warn!("Metrics server connection error: {}", err);
                            }
                        });
                    }
                    Err(e) => {
                        log::warn!("Metrics server accept error: {}", e);
                    }
                }
            }
            _ = shutdown.changed() => {
                if *shutdown.borrow() {
                    log::info!("Metrics server received shutdown signal");
                    break;
                }
            }
        }
    }

    log::info!("Metrics server stopped");
    Ok(())
}

async fn handle_request(
    req: Request<hyper::body::Incoming>,
    metrics: Arc<MetricsCollector>,
) -> std::result::Result<Response<Full<Bytes>>, std::convert::Infallible> {
    let path = req.uri().path();

    match path {
        "/metrics" => {
            let body = metrics.gather();
            Ok(Response::builder()
                .status(200)
                .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
                .body(Full::new(Bytes::from(body)))
                .unwrap())
        }
        "/health" => {
            let response = serde_json::json!({
                "status": "ok",
                "timestamp": chrono::Utc::now().to_rfc3339(),
            });
            Ok(Response::builder()
                .status(200)
                .header("Content-Type", "application/json")
                .body(Full::new(Bytes::from(response.to_string())))
                .unwrap())
        }
        "/" => {
            let html = r#"
<!DOCTYPE html>
<html>
<head>
    <title>Data Sync Gateway Metrics</title>
</head>
<body>
    <h1>Data Sync Gateway</h1>
    <ul>
        <li><a href="/metrics">/metrics</a> - Prometheus metrics</li>
        <li><a href="/health">/health</a> - Health check</li>
    </ul>
</body>
</html>
"#;
            Ok(Response::builder()
                .status(200)
                .header("Content-Type", "text/html")
                .body(Full::new(Bytes::from(html)))
                .unwrap())
        }
        _ => Ok(Response::builder()
            .status(404)
            .body(Full::new(Bytes::from("Not Found")))
            .unwrap()),
    }
}
