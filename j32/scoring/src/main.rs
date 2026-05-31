use std::env;
use std::sync::Arc;

use anyhow::{Context, Result};
use clap::Parser;
use serde::{Deserialize, Serialize};
use sqlx::mysql::MySqlPoolOptions;
use sqlx::MySqlPool;
use actix_web::{web, App, HttpServer, HttpResponse, middleware};
use chrono::{DateTime, Utc};
use tracing::{info, warn};

#[derive(Parser, Debug)]
#[command(name = "dcdn-scoring", about = "dCDN health scoring engine")]
struct Args {
    #[arg(long, default_value = "0.0.0.0:8081")]
    listen: String,
    #[arg(long, env = "TIDB_DSN", default_value = "mysql://root:@127.0.0.1:4000/dcdn")]
    dsn: String,
}

#[derive(Clone)]
struct AppState {
    pool: MySqlPool,
    cfg: Arc<ScoringConfig>,
}

#[derive(Clone, Debug)]
struct ScoringConfig {
    base_elo: f64,
    k: f64,
}

#[derive(Debug, Deserialize)]
struct HeartbeatReq {
    node_id: String,
    cpu_usage: f64,
    mem_usage: f64,
    bw_usage: f64,
    lat_ms: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct HealthScore {
    node_id: String,
    elo: f64,
    availability: f64,
    bandwidth_contrib: f64,
    uptime_ratio: f64,
    version: i64,
    computed_at: DateTime<Utc>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let args = Args::parse();
    info!("connecting to TiDB at {}", args.dsn);
    let pool = MySqlPoolOptions::new()
        .max_connections(20)
        .connect(&args.dsn)
        .await
        .context("connect tidb")?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS score_history (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            node_id VARCHAR(64) NOT NULL,
            elo DOUBLE NOT NULL,
            availability DOUBLE NOT NULL,
            bandwidth_contrib DOUBLE NOT NULL,
            uptime_ratio DOUBLE NOT NULL,
            version BIGINT NOT NULL,
            computed_at DATETIME NOT NULL,
            INDEX idx_node_at (node_id, computed_at)
        )"
    ).execute(&pool).await?;

    let state = AppState {
        pool,
        cfg: Arc::new(ScoringConfig { base_elo: 1200.0, k: 32.0 }),
    };
    info!("listening on {}", args.listen);
    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(state.clone()))
            .route("/healthz", web::get().to(healthz))
            .route("/api/v1/scores/{node_id}", web::get().to(get_score))
            .route("/api/v1/scores", web::post().to(compute_score))
            .route("/api/v1/heritage", web::post().to(transfer_heritage))
    })
    .bind(&args.listen)?
    .run()
    .await?;
    Ok(())
}

async fn healthz() -> HttpResponse {
    HttpResponse::Ok().json(serde_json::json!({"ok": true, "service": "scoring"}))
}

async fn get_score(path: web::Path<String>, data: web::Data<AppState>) -> HttpResponse {
    let node_id = path.into_inner();
    match fetch_latest_score(&data.pool, &node_id).await {
        Ok(Some(s)) => HttpResponse::Ok().json(s),
        Ok(None) => HttpResponse::NotFound().json(serde_json::json!({"error": "not found"})),
        Err(e) => {
            warn!("get_score err: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}))
        }
    }
}

async fn compute_score(
    data: web::Data<AppState>,
    body: web::Json<HeartbeatReq>,
) -> HttpResponse {
    // 为了简化，这里基于心跳直接计算。实际生产可读取 heartbeats 表。
    let avail = clamp(1.0 - (body.cpu_usage + body.mem_usage) / 2.0, 0.0, 1.0);
    let bw_contrib = clamp(body.bw_usage / 1000.0, 0.0, 1.0);
    let uptime = 0.5; // 简化：实际应由节点注册时长计算
    let actual = 0.5 * avail + 0.3 * bw_contrib + 0.2 * uptime;

    let prev = fetch_latest_score(&data.pool, &body.node_id).await.ok().flatten();
    let (prev_elo, version) = match prev {
        Some(p) => (p.elo, p.version + 1),
        None => (data.cfg.base_elo, 1),
    };
    let expected = clamp((prev_elo - 1000.0) / 400.0, 0.0, 1.0);
    let k = data.cfg.k * (0.5 + 0.5 * bw_contrib);
    let new_elo = clamp(prev_elo + k * (actual - expected), 0.0, 2400.0);

    let score = HealthScore {
        node_id: body.node_id.clone(),
        elo: new_elo,
        availability: avail,
        bandwidth_contrib: bw_contrib,
        uptime_ratio: uptime,
        version,
        computed_at: Utc::now(),
    };
    if let Err(e) = save_score(&data.pool, &score).await {
        warn!("save_score err: {e}");
        return HttpResponse::InternalServerError().json(serde_json::json!({"error": e.to_string()}));
    }
    HttpResponse::Ok().json(score)
}

#[derive(Deserialize)]
struct HeritageReq {
    from_node_id: String,
    to_node_ids: Vec<String>,
}

async fn transfer_heritage(
    data: web::Data<AppState>,
    body: web::Json<HeritageReq>,
) -> HttpResponse {
    // 1. 读取源节点 Elo
    let source = match fetch_latest_score(&data.pool, &body.from_node_id).await {
        Ok(Some(s)) => s,
        _ => return HttpResponse::NotFound().json(serde_json::json!({"error": "source not found"})),
    };
    // 2. 读取目标节点评分
    let mut targets: Vec<HealthScore> = Vec::new();
    for id in &body.to_node_ids {
        if let Ok(Some(s)) = fetch_latest_score(&data.pool, id).await {
            targets.push(s);
        }
    }
    if targets.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "no targets alive"}));
    }
    let total: f64 = targets.iter().map(|t| t.elo).sum();
    if total <= 0.0 {
        return HttpResponse::BadRequest().json(serde_json::json!({"error": "invalid target scores"}));
    }
    // 3. 按权重分配（仅 20% 转移，防止评分膨胀）
    for t in &targets {
        let share = source.elo * (t.elo / total) * 0.2;
        let new_elo = t.elo + share;
        let updated = HealthScore {
            node_id: t.node_id.clone(),
            elo: new_elo,
            availability: t.availability,
            bandwidth_contrib: t.bandwidth_contrib,
            uptime_ratio: t.uptime_ratio,
            version: t.version + 1,
            computed_at: Utc::now(),
        };
        if let Err(e) = save_score(&data.pool, &updated).await {
            warn!("save heritage err: {e}");
        }
    }
    HttpResponse::Ok().json(serde_json::json!({
        "from": body.from_node_id,
        "total_elo": source.elo,
        "targets": body.to_node_ids,
        "status": "transferred"
    }))
}

async fn fetch_latest_score(pool: &MySqlPool, node_id: &str) -> Result<Option<HealthScore>> {
    let row: Option<(String, f64, f64, f64, f64, i64, chrono::NaiveDateTime)> =
        sqlx::query_as(
            "SELECT node_id,elo,availability,bandwidth_contrib,uptime_ratio,version,computed_at
             FROM score_history WHERE node_id=? ORDER BY computed_at DESC LIMIT 1"
        )
        .bind(node_id)
        .fetch_optional(pool)
        .await
        .context("query score")?;
    Ok(row.map(|(n, e, a, b, u, v, t)| HealthScore {
        node_id: n, elo: e, availability: a, bandwidth_contrib: b,
        uptime_ratio: u, version: v,
        computed_at: DateTime::<Utc>::from_naive_utc_and_offset(t, Utc),
    }))
}

async fn save_score(pool: &MySqlPool, s: &HealthScore) -> Result<()> {
    sqlx::query(
        "INSERT INTO score_history(node_id,elo,availability,bandwidth_contrib,uptime_ratio,version,computed_at)
         VALUES(?,?,?,?,?,?,?)"
    )
    .bind(&s.node_id)
    .bind(s.elo)
    .bind(s.availability)
    .bind(s.bandwidth_contrib)
    .bind(s.uptime_ratio)
    .bind(s.version)
    .bind(s.computed_at.naive_utc())
    .execute(pool)
    .await
    .context("save score")?;
    Ok(())
}

fn clamp(v: f64, lo: f64, hi: f64) -> f64 {
    if v < lo { lo } else if v > hi { hi } else { v }
}
