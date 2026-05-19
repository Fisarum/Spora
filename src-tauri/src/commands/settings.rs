use tauri::State;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::Serialize;
use crate::state::{AppState, GatewaySettings};
use crate::error::SporaError;

type AppStateManaged = Arc<RwLock<AppState>>;

#[derive(Serialize)]
pub struct GatewayStatus {
    pub running: bool,
    pub port: u16,
}

#[derive(Serialize)]
pub struct DbStats {
    #[serde(rename = "sizeBytes")]
    pub size_bytes: u64,
    #[serde(rename = "rowCount")]
    pub row_count: i64,
}

#[tauri::command]
pub async fn get_settings(
    state: State<'_, AppStateManaged>,
) -> Result<GatewaySettings, SporaError> {
    let s = state.read().await;
    Ok(s.settings.clone())
}

#[tauri::command]
pub async fn update_settings(
    state: State<'_, AppStateManaged>,
    settings: GatewaySettings,
) -> Result<(), SporaError> {
    let mut s = state.write().await;
    let json = serde_json::to_string(&settings)?;
    {
        let db = s.db.lock().unwrap();
        db.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('gateway_settings', ?1)",
            [&json],
        )?;
    }
    s.settings = settings;
    Ok(())
}

#[tauri::command]
pub async fn get_gateway_status(
    state: State<'_, AppStateManaged>,
) -> Result<GatewayStatus, SporaError> {
    let s = state.read().await;
    Ok(GatewayStatus {
        running: s.gateway_running,
        port: s.gateway_port,
    })
}

#[tauri::command]
pub async fn start_gateway(
    state: State<'_, AppStateManaged>,
) -> Result<(), SporaError> {
    let mut s = state.write().await;
    s.gateway_running = true;
    Ok(())
}

#[tauri::command]
pub async fn stop_gateway(
    state: State<'_, AppStateManaged>,
) -> Result<(), SporaError> {
    let mut s = state.write().await;
    s.gateway_running = false;
    Ok(())
}

#[tauri::command]
pub async fn get_db_stats(
    state: State<'_, AppStateManaged>,
) -> Result<DbStats, SporaError> {
    let s = state.read().await;
    let db = s.db.lock().unwrap();

    let row_count: i64 = db.query_row(
        "SELECT COUNT(*) FROM request_logs",
        [],
        |row| row.get(0),
    )?;

    let page_count: i64 = db.query_row("PRAGMA page_count", [], |row| row.get(0))?;
    let page_size: i64 = db.query_row("PRAGMA page_size", [], |row| row.get(0))?;
    let size_bytes = (page_count * page_size) as u64;

    Ok(DbStats { size_bytes, row_count })
}

#[tauri::command]
pub async fn clear_logs(
    state: State<'_, AppStateManaged>,
) -> Result<(), SporaError> {
    let s = state.read().await;
    let db = s.db.lock().unwrap();
    db.execute("DELETE FROM request_logs", [])?;
    Ok(())
}

#[tauri::command]
pub async fn export_logs(
    state: State<'_, AppStateManaged>,
    path: String,
) -> Result<(), SporaError> {
    let s = state.read().await;
    let db = s.db.lock().unwrap();

    let mut stmt = db.prepare(
        "SELECT r.id, r.spora_key_id, k.label, r.provider, r.model,
                r.prompt_tokens, r.completion_tokens, r.cost_usd, r.latency_ms, r.status_code, r.ts
         FROM request_logs r LEFT JOIN spora_keys k ON k.id = r.spora_key_id
         ORDER BY r.ts DESC"
    )?;

    let logs: Vec<serde_json::Value> = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let key_id: Option<String> = row.get(1)?;
        let key_label: Option<String> = row.get(2)?;
        let provider: String = row.get(3)?;
        let model: String = row.get(4)?;
        let prompt_tokens: i64 = row.get(5)?;
        let completion_tokens: i64 = row.get(6)?;
        let cost: f64 = row.get(7)?;
        let latency: i64 = row.get(8)?;
        let status: i64 = row.get(9)?;
        let ts: i64 = row.get(10)?;
        Ok(serde_json::json!({
            "id": id,
            "sporaKeyId": key_id,
            "sporaKeyLabel": key_label,
            "provider": provider,
            "model": model,
            "promptTokens": prompt_tokens,
            "completionTokens": completion_tokens,
            "costUsd": cost,
            "latencyMs": latency,
            "statusCode": status,
            "ts": ts,
        }))
    })?.collect::<rusqlite::Result<Vec<_>>>()?;

    let json = serde_json::to_string_pretty(&logs)?;
    std::fs::write(&path, json)?;
    Ok(())
}
