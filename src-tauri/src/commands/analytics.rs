use tauri::State;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use crate::state::AppState;
use crate::error::SporaError;

type AppStateManaged = Arc<RwLock<AppState>>;

#[derive(Serialize)]
pub struct UsageStats {
    #[serde(rename = "totalRequests")]
    pub total_requests: i64,
    #[serde(rename = "totalCostUsd")]
    pub total_cost_usd: f64,
    #[serde(rename = "totalTokens")]
    pub total_tokens: i64,
    #[serde(rename = "avgLatencyMs")]
    pub avg_latency_ms: f64,
}

#[derive(Serialize)]
pub struct ProviderUsage {
    pub provider: String,
    pub requests: i64,
    #[serde(rename = "costUsd")]
    pub cost_usd: f64,
    pub tokens: i64,
}

#[derive(Serialize)]
pub struct ModelUsage {
    pub model: String,
    pub provider: String,
    pub requests: i64,
    #[serde(rename = "costUsd")]
    pub cost_usd: f64,
    pub tokens: i64,
}

#[derive(Serialize)]
pub struct KeyUsage {
    #[serde(rename = "sporaKeyId")]
    pub spora_key_id: String,
    pub label: String,
    pub location: String,
    pub requests: i64,
    #[serde(rename = "costUsd")]
    pub cost_usd: f64,
    pub tokens: i64,
}

#[derive(Serialize)]
pub struct DailyUsage {
    pub date: String,
    pub requests: i64,
    #[serde(rename = "costUsd")]
    pub cost_usd: f64,
    pub tokens: i64,
}

#[derive(Serialize)]
pub struct RequestLog {
    pub id: String,
    #[serde(rename = "sporaKeyId")]
    pub spora_key_id: Option<String>,
    #[serde(rename = "sporaKeyLabel")]
    pub spora_key_label: Option<String>,
    pub provider: String,
    pub model: String,
    #[serde(rename = "promptTokens")]
    pub prompt_tokens: i64,
    #[serde(rename = "completionTokens")]
    pub completion_tokens: i64,
    #[serde(rename = "costUsd")]
    pub cost_usd: f64,
    #[serde(rename = "latencyMs")]
    pub latency_ms: i64,
    #[serde(rename = "statusCode")]
    pub status_code: i64,
    pub ts: i64,
}

#[derive(Serialize)]
pub struct LogsResult {
    pub logs: Vec<RequestLog>,
    pub total: i64,
}

#[derive(Deserialize)]
pub struct LogsParams {
    pub limit: i64,
    pub offset: i64,
    #[serde(rename = "sporaKeyId")]
    pub _spora_key_id: Option<String>,
    #[serde(rename = "provider")]
    pub _provider: Option<String>,
}

fn time_clause(from: Option<i64>, to: Option<i64>) -> String {
    match (from, to) {
        (Some(f), Some(t)) => format!("AND ts >= {} AND ts <= {}", f, t),
        (Some(f), None) => format!("AND ts >= {}", f),
        (None, Some(t)) => format!("AND ts <= {}", t),
        (None, None) => String::new(),
    }
}

#[tauri::command]
pub async fn get_usage_stats(
    state: State<'_, AppStateManaged>,
    #[allow(non_snake_case)] fromTs: Option<i64>,
    #[allow(non_snake_case)] toTs: Option<i64>,
) -> Result<UsageStats, SporaError> {
    let clause = time_clause(fromTs, toTs);
    let s = state.read().await;
    let db = s.db.lock().unwrap();
    let stats = db.query_row(
        &format!(
            "SELECT COUNT(*), COALESCE(SUM(cost_usd),0), COALESCE(SUM(prompt_tokens+completion_tokens),0), COALESCE(AVG(latency_ms),0)
             FROM request_logs WHERE 1=1 {}", clause
        ),
        [],
        |row| Ok(UsageStats {
            total_requests: row.get(0)?,
            total_cost_usd: row.get(1)?,
            total_tokens: row.get(2)?,
            avg_latency_ms: row.get(3)?,
        }),
    )?;
    Ok(stats)
}

#[tauri::command]
pub async fn get_provider_usage(
    state: State<'_, AppStateManaged>,
    #[allow(non_snake_case)] fromTs: Option<i64>,
    #[allow(non_snake_case)] toTs: Option<i64>,
) -> Result<Vec<ProviderUsage>, SporaError> {
    let clause = time_clause(fromTs, toTs);
    let s = state.read().await;
    let db = s.db.lock().unwrap();
    let mut stmt = db.prepare(&format!(
        "SELECT provider, COUNT(*), COALESCE(SUM(cost_usd),0), COALESCE(SUM(prompt_tokens+completion_tokens),0)
         FROM request_logs WHERE 1=1 {} GROUP BY provider ORDER BY COUNT(*) DESC", clause
    ))?;
    let rows = stmt.query_map([], |row| Ok(ProviderUsage {
        provider: row.get(0)?,
        requests: row.get(1)?,
        cost_usd: row.get(2)?,
        tokens: row.get(3)?,
    }))?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

#[tauri::command]
pub async fn get_model_usage(
    state: State<'_, AppStateManaged>,
    #[allow(non_snake_case)] fromTs: Option<i64>,
    #[allow(non_snake_case)] toTs: Option<i64>,
) -> Result<Vec<ModelUsage>, SporaError> {
    let clause = time_clause(fromTs, toTs);
    let s = state.read().await;
    let db = s.db.lock().unwrap();
    let mut stmt = db.prepare(&format!(
        "SELECT model, provider, COUNT(*), COALESCE(SUM(cost_usd),0), COALESCE(SUM(prompt_tokens+completion_tokens),0)
         FROM request_logs WHERE 1=1 {} GROUP BY model ORDER BY SUM(cost_usd) DESC", clause
    ))?;
    let rows = stmt.query_map([], |row| Ok(ModelUsage {
        model: row.get(0)?,
        provider: row.get(1)?,
        requests: row.get(2)?,
        cost_usd: row.get(3)?,
        tokens: row.get(4)?,
    }))?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

#[tauri::command]
pub async fn get_key_usage(
    state: State<'_, AppStateManaged>,
    #[allow(non_snake_case)] fromTs: Option<i64>,
    #[allow(non_snake_case)] toTs: Option<i64>,
) -> Result<Vec<KeyUsage>, SporaError> {
    let clause = time_clause(fromTs, toTs);
    let s = state.read().await;
    let db = s.db.lock().unwrap();
    let mut stmt = db.prepare(&format!(
        "SELECT r.spora_key_id, COALESCE(k.label,'Unknown'), COALESCE(k.location,''),
                COUNT(*), COALESCE(SUM(r.cost_usd),0), COALESCE(SUM(r.prompt_tokens+r.completion_tokens),0)
         FROM request_logs r LEFT JOIN spora_keys k ON k.id = r.spora_key_id
         WHERE r.spora_key_id IS NOT NULL {}
         GROUP BY r.spora_key_id ORDER BY SUM(r.cost_usd) DESC", clause
    ))?;
    let rows = stmt.query_map([], |row| Ok(KeyUsage {
        spora_key_id: row.get(0)?,
        label: row.get(1)?,
        location: row.get(2)?,
        requests: row.get(3)?,
        cost_usd: row.get(4)?,
        tokens: row.get(5)?,
    }))?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

#[tauri::command]
pub async fn get_daily_usage(
    state: State<'_, AppStateManaged>,
    #[allow(non_snake_case)] fromTs: Option<i64>,
    #[allow(non_snake_case)] toTs: Option<i64>,
) -> Result<Vec<DailyUsage>, SporaError> {
    let clause = time_clause(fromTs, toTs);
    let s = state.read().await;
    let db = s.db.lock().unwrap();
    let mut stmt = db.prepare(&format!(
        "SELECT date(ts, 'unixepoch') as d, COUNT(*), COALESCE(SUM(cost_usd),0), COALESCE(SUM(prompt_tokens+completion_tokens),0)
         FROM request_logs WHERE 1=1 {} GROUP BY d ORDER BY d ASC", clause
    ))?;
    let rows = stmt.query_map([], |row| Ok(DailyUsage {
        date: row.get(0)?,
        requests: row.get(1)?,
        cost_usd: row.get(2)?,
        tokens: row.get(3)?,
    }))?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

#[tauri::command]
pub async fn get_request_logs(
    state: State<'_, AppStateManaged>,
    params: LogsParams,
) -> Result<LogsResult, SporaError> {
    let s = state.read().await;
    let db = s.db.lock().unwrap();

    let total: i64 = db.query_row(
        "SELECT COUNT(*) FROM request_logs",
        [],
        |row| row.get(0),
    )?;

    let mut stmt = db.prepare(
        "SELECT r.id, r.spora_key_id, k.label, r.provider, r.model,
                r.prompt_tokens, r.completion_tokens, r.cost_usd, r.latency_ms, r.status_code, r.ts
         FROM request_logs r LEFT JOIN spora_keys k ON k.id = r.spora_key_id
         ORDER BY r.ts DESC LIMIT ?1 OFFSET ?2"
    )?;

    let logs = stmt.query_map(rusqlite::params![params.limit, params.offset], |row| {
        Ok(RequestLog {
            id: row.get(0)?,
            spora_key_id: row.get(1)?,
            spora_key_label: row.get(2)?,
            provider: row.get(3)?,
            model: row.get(4)?,
            prompt_tokens: row.get(5)?,
            completion_tokens: row.get(6)?,
            cost_usd: row.get(7)?,
            latency_ms: row.get(8)?,
            status_code: row.get(9)?,
            ts: row.get(10)?,
        })
    })?.collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(LogsResult { logs, total })
}
