use tauri::State;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::Serialize;
use crate::state::AppState;
use crate::error::SporaError;
use crate::db::{map_to_spora_provider, compute_model_tags, ingest_default_models};

type AppStateManaged = Arc<RwLock<AppState>>;

#[derive(Serialize, Clone)]
pub struct ModelOut {
    pub id: String,
    pub name: String,
    pub provider: String,
    #[serde(rename = "sporaProvider")]
    pub spora_provider: String,
    #[serde(rename = "contextLength")]
    pub context_length: i64,
    pub modality: String,
    pub description: String,
    #[serde(rename = "promptPrice")]
    pub prompt_price: f64,
    #[serde(rename = "completionPrice")]
    pub completion_price: f64,
    pub tags: Vec<String>,
}

#[tauri::command]
pub async fn list_available_models(
    state: State<'_, AppStateManaged>,
    spora_key_id: String,
) -> Result<Vec<ModelOut>, SporaError> {
    let s = state.read().await;
    let db = s.db.lock().unwrap();

    // Fetch allowed_providers for this Spora key
    let allowed_providers: Option<String> = if spora_key_id.is_empty() {
        None
    } else {
        db.query_row(
            "SELECT allowed_providers FROM spora_keys WHERE id = ?1",
            [&spora_key_id],
            |row| row.get(0),
        ).ok().flatten()
    };

    let provider_filter: Option<Vec<String>> = allowed_providers
        .and_then(|s| serde_json::from_str(&s).ok());

    // Determine which spora_providers to include
    // If "openrouter" is in the list, show all models (OpenRouter routes to any provider)
    let query_all = provider_filter.as_ref()
        .map(|pf| pf.iter().any(|p| p == "openrouter"))
        .unwrap_or(true);

    let models: Vec<ModelOut> = if query_all {
        let mut stmt = db.prepare(
            "SELECT id, name, provider, spora_provider, context_length, modality, description, prompt_price, completion_price, tags
             FROM models ORDER BY provider, name"
        )?;
        let rows = stmt.query_map([], model_row_map)?.collect::<rusqlite::Result<Vec<_>>>()?;
        rows
    } else if let Some(ref pf) = provider_filter {
        // Map spora provider names
        let spora_providers: Vec<&str> = pf.iter().map(|p| match p.as_str() {
            "openai" => "openai",
            "anthropic" => "anthropic",
            "gemini" => "gemini",
            _ => "openrouter",
        }).collect();

        let placeholders: String = spora_providers.iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", i + 1))
            .collect::<Vec<_>>()
            .join(", ");

        let sql = format!(
            "SELECT id, name, provider, spora_provider, context_length, modality, description, prompt_price, completion_price, tags
             FROM models WHERE spora_provider IN ({}) ORDER BY provider, name",
            placeholders
        );

        let mut stmt = db.prepare(&sql)?;
        let params: Vec<&dyn rusqlite::ToSql> = spora_providers
            .iter()
            .map(|s| s as &dyn rusqlite::ToSql)
            .collect();

        let rows = stmt.query_map(params.as_slice(), model_row_map)?.collect::<rusqlite::Result<Vec<_>>>()?;
        rows
    } else {
        vec![]
    };

    Ok(models)
}

#[tauri::command]
pub async fn get_model_count(
    state: State<'_, AppStateManaged>,
) -> Result<i64, SporaError> {
    let s = state.read().await;
    let db = s.db.lock().unwrap();
    let count: i64 = db.query_row("SELECT COUNT(*) FROM models", [], |r| r.get(0))
        .unwrap_or(0);
    Ok(count)
}

#[tauri::command]
pub async fn sync_models(
    state: State<'_, AppStateManaged>,
) -> Result<usize, SporaError> {
    // Fetch live model list from OpenRouter public API
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| SporaError::Other(e.to_string()))?;

    let resp = client
        .get("https://openrouter.ai/api/v1/models")
        .header("User-Agent", "spora-gateway/1.0")
        .send()
        .await
        .map_err(|e| SporaError::Other(format!("Failed to fetch models: {}", e)))?;

    let body: serde_json::Value = resp.json().await
        .map_err(|e| SporaError::Other(format!("Failed to parse models: {}", e)))?;

    let data = body.get("data")
        .and_then(|d| d.as_array())
        .ok_or_else(|| SporaError::Other("Invalid models response".to_string()))?;

    let ts = chrono::Utc::now().timestamp();
    let s = state.read().await;
    let db = s.db.lock().unwrap();

    let mut count = 0usize;
    for item in data {
        let id = item.get("id").and_then(|v| v.as_str()).unwrap_or_default();
        let name = item.get("name").and_then(|v| v.as_str()).unwrap_or(id);
        let description = item.get("description").and_then(|v| v.as_str()).unwrap_or("");
        let context_length = item.get("context_length").and_then(|v| v.as_i64()).unwrap_or(0);
        let modality = item.pointer("/architecture/modality").and_then(|v| v.as_str()).unwrap_or("");

        let prompt_price: f64 = item.pointer("/pricing/prompt")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0.0);
        let completion_price: f64 = item.pointer("/pricing/completion")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0.0);

        // Derive provider from model ID prefix
        let provider = id.split('/').next().unwrap_or("openrouter");
        let spora_provider = map_to_spora_provider(provider);
        let tags = compute_model_tags(name, description, prompt_price, completion_price, modality);
        let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());

        if db.execute(
            "INSERT OR REPLACE INTO models (id, name, provider, spora_provider, context_length, modality, description, prompt_price, completion_price, tags, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                id, name, provider, spora_provider,
                context_length, modality, description,
                prompt_price, completion_price, tags_json, ts
            ],
        ).is_ok() {
            count += 1;
        }
    }

    Ok(count)
}

#[tauri::command]
pub async fn reset_models(
    state: State<'_, AppStateManaged>,
) -> Result<(), SporaError> {
    let s = state.read().await;
    let db = s.db.lock().unwrap();
    db.execute("DELETE FROM models", [])?;
    ingest_default_models(&db)
}

fn model_row_map(row: &rusqlite::Row<'_>) -> rusqlite::Result<ModelOut> {
    let tags_str: String = row.get(9)?;
    let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
    Ok(ModelOut {
        id: row.get(0)?,
        name: row.get(1)?,
        provider: row.get(2)?,
        spora_provider: row.get(3)?,
        context_length: row.get(4)?,
        modality: row.get(5)?,
        description: row.get(6)?,
        prompt_price: row.get(7)?,
        completion_price: row.get(8)?,
        tags,
    })
}
