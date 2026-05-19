use tauri::State;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::state::AppState;
use crate::error::SporaError;
use crate::proxy::middleware::{encrypt_key, decrypt_key};

type AppStateManaged = Arc<RwLock<AppState>>;

#[derive(Serialize)]
pub struct ProviderKeyOut {
    pub id: String,
    pub provider: String,
    pub label: String,
    #[serde(rename = "maskedKey")]
    pub masked_key: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

#[derive(Serialize)]
pub struct SporaKeyOut {
    pub id: String,
    pub token: String,
    pub label: String,
    pub location: String,
    #[serde(rename = "allowedProviders")]
    pub allowed_providers: Option<Vec<String>>,
    #[serde(rename = "allowedModels")]
    pub allowed_models: Option<Vec<String>>,
    #[serde(rename = "dailyLimitUsd")]
    pub daily_limit_usd: Option<f64>,
    #[serde(rename = "monthlyLimitUsd")]
    pub monthly_limit_usd: Option<f64>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    pub active: bool,
}

#[derive(Deserialize)]
pub struct CreateSporaKeyParams {
    pub label: String,
    pub location: String,
    #[serde(rename = "allowedProviders")]
    pub allowed_providers: Option<Vec<String>>,
    #[serde(rename = "allowedModels")]
    pub allowed_models: Option<Vec<String>>,
    #[serde(rename = "dailyLimitUsd")]
    pub daily_limit_usd: Option<f64>,
    #[serde(rename = "monthlyLimitUsd")]
    pub monthly_limit_usd: Option<f64>,
}

#[tauri::command]
pub async fn list_provider_keys(
    state: State<'_, AppStateManaged>,
) -> Result<Vec<ProviderKeyOut>, SporaError> {
    let s = state.read().await;
    let db = s.db.lock().unwrap();
    let mut stmt = db.prepare(
        "SELECT id, provider, label, key_enc, created_at FROM provider_keys ORDER BY created_at DESC"
    )?;
    let keys = stmt.query_map([], |row| {
        let key_enc: String = row.get(3)?;
        let raw = decrypt_key(&key_enc);
        let masked = if raw.len() > 8 {
            format!("{}...{}", &raw[..4], &raw[raw.len()-4..])
        } else {
            "****".to_string()
        };
        Ok(ProviderKeyOut {
            id: row.get(0)?,
            provider: row.get(1)?,
            label: row.get(2)?,
            masked_key: masked,
            created_at: row.get(4)?,
        })
    })?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(keys)
}

#[tauri::command]
pub async fn add_provider_key(
    state: State<'_, AppStateManaged>,
    provider: String,
    label: String,
    api_key: String,
) -> Result<ProviderKeyOut, SporaError> {
    let id = Uuid::new_v4().to_string();
    let ts = chrono::Utc::now().timestamp();
    let key_enc = encrypt_key(&api_key);
    let masked = if api_key.len() > 8 {
        format!("{}...{}", &api_key[..4], &api_key[api_key.len()-4..])
    } else {
        "****".to_string()
    };

    let s = state.read().await;
    let db = s.db.lock().unwrap();
    db.execute(
        "INSERT INTO provider_keys (id, provider, label, key_enc, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, provider, label, key_enc, ts],
    )?;

    Ok(ProviderKeyOut {
        id,
        provider,
        label,
        masked_key: masked,
        created_at: ts,
    })
}

#[tauri::command]
pub async fn delete_provider_key(
    state: State<'_, AppStateManaged>,
    id: String,
) -> Result<(), SporaError> {
    let s = state.read().await;
    let db = s.db.lock().unwrap();
    db.execute("DELETE FROM provider_keys WHERE id = ?1", [&id])?;
    Ok(())
}

#[tauri::command]
pub async fn list_spora_keys(
    state: State<'_, AppStateManaged>,
) -> Result<Vec<SporaKeyOut>, SporaError> {
    let s = state.read().await;
    let db = s.db.lock().unwrap();
    let mut stmt = db.prepare(
        "SELECT id, token, label, location, allowed_providers, allowed_models, daily_limit_usd, monthly_limit_usd, created_at, active
         FROM spora_keys ORDER BY created_at DESC"
    )?;
    let keys = stmt.query_map([], |row| {
        let allowed_providers: Option<String> = row.get(4)?;
        let allowed_models: Option<String> = row.get(5)?;
        Ok(SporaKeyOut {
            id: row.get(0)?,
            token: row.get(1)?,
            label: row.get(2)?,
            location: row.get(3)?,
            allowed_providers: allowed_providers.and_then(|s| serde_json::from_str(&s).ok()),
            allowed_models: allowed_models.and_then(|s| serde_json::from_str(&s).ok()),
            daily_limit_usd: row.get(6)?,
            monthly_limit_usd: row.get(7)?,
            created_at: row.get(8)?,
            active: row.get::<_, i64>(9)? != 0,
        })
    })?.collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(keys)
}

#[tauri::command]
pub async fn create_spora_key(
    state: State<'_, AppStateManaged>,
    params: CreateSporaKeyParams,
) -> Result<SporaKeyOut, SporaError> {
    let id = Uuid::new_v4().to_string();
    let token = format!("sk-spora-{}", Uuid::new_v4().to_string().replace('-', ""));
    let ts = chrono::Utc::now().timestamp();

    let allowed_providers_json: Option<String> = params.allowed_providers.as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());
    let allowed_models_json: Option<String> = params.allowed_models.as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());

    let s = state.read().await;
    let db = s.db.lock().unwrap();
    db.execute(
        "INSERT INTO spora_keys (id, token, label, location, allowed_providers, allowed_models, daily_limit_usd, monthly_limit_usd, created_at, active)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1)",
        rusqlite::params![
            id, token, params.label, params.location,
            allowed_providers_json, allowed_models_json,
            params.daily_limit_usd, params.monthly_limit_usd, ts
        ],
    )?;

    Ok(SporaKeyOut {
        id,
        token,
        label: params.label,
        location: params.location,
        allowed_providers: params.allowed_providers,
        allowed_models: params.allowed_models,
        daily_limit_usd: params.daily_limit_usd,
        monthly_limit_usd: params.monthly_limit_usd,
        created_at: ts,
        active: true,
    })
}

#[tauri::command]
pub async fn revoke_spora_key(
    state: State<'_, AppStateManaged>,
    id: String,
) -> Result<(), SporaError> {
    let s = state.read().await;
    let db = s.db.lock().unwrap();
    db.execute("UPDATE spora_keys SET active = 0 WHERE id = ?1", [&id])?;
    Ok(())
}

#[tauri::command]
pub async fn delete_spora_key(
    state: State<'_, AppStateManaged>,
    id: String,
) -> Result<(), SporaError> {
    let s = state.read().await;
    let db = s.db.lock().unwrap();
    db.execute("DELETE FROM spora_keys WHERE id = ?1", [&id])?;
    Ok(())
}
