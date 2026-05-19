use axum::http::HeaderMap;
use rusqlite::Connection;
use crate::error::{Result, SporaError};

pub struct ResolvedKey {
    pub spora_key_id: String,
    pub provider: String,
    pub api_key: String,
}

pub fn extract_spora_key(headers: &HeaderMap) -> Option<String> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

pub fn infer_provider_from_model(model: &str) -> &'static str {
    let m = model.to_lowercase();
    if m.starts_with("claude") {
        "anthropic"
    } else if m.starts_with("gemini") {
        "gemini"
    } else {
        "openai"
    }
}

pub fn resolve_provider_key(db: &Connection, token: &str) -> Result<ResolvedKey> {
    resolve_provider_key_for_model(db, token, "")
}

pub fn resolve_provider_key_for_model(db: &Connection, token: &str, model: &str) -> Result<ResolvedKey> {
    let (spora_key_id, allowed_providers, active): (String, Option<String>, bool) = db
        .query_row(
            "SELECT id, allowed_providers, active FROM spora_keys WHERE token = ?1",
            [token],
            |row| Ok((row.get(0)?, row.get(1)?, row.get::<_, i64>(2)? != 0)),
        )
        .map_err(|_| SporaError::Unauthorized("Invalid Spora key".to_string()))?;

    if !active {
        return Err(SporaError::Unauthorized("Spora key has been revoked".to_string()));
    }

    let provider_filter: Option<Vec<String>> = allowed_providers
        .and_then(|s| serde_json::from_str(&s).ok());

    let (provider, key_enc): (String, String) = if let Some(ref pf) = provider_filter {
        // Restricted key: must match one of the allowed providers
        let filter_json = serde_json::to_string(pf).unwrap_or_default();
        db.query_row(
            "SELECT provider, key_enc FROM provider_keys WHERE provider IN (SELECT value FROM json_each(?1)) ORDER BY rowid LIMIT 1",
            [filter_json.as_str()],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
    } else if !model.is_empty() {
        // Unrestricted key: prefer provider matching the model
        let preferred = infer_provider_from_model(model);
        let result = db.query_row(
            "SELECT provider, key_enc FROM provider_keys WHERE provider = ?1 LIMIT 1",
            [preferred],
            |row| Ok((row.get(0)?, row.get(1)?)),
        );
        match result {
            Ok(row) => Ok(row),
            // Fall back to any available key
            Err(_) => db.query_row(
                "SELECT provider, key_enc FROM provider_keys ORDER BY rowid LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            ),
        }
    } else {
        db.query_row(
            "SELECT provider, key_enc FROM provider_keys ORDER BY rowid LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
    }
    .map_err(|_| SporaError::NotFound("No provider key available for this request".to_string()))?;

    let api_key = decrypt_key(&key_enc);

    Ok(ResolvedKey { spora_key_id, provider, api_key })
}

pub fn check_spend_cap(db: &Connection, spora_key_id: &str) -> Result<()> {
    let (daily_limit, monthly_limit): (Option<f64>, Option<f64>) = db
        .query_row(
            "SELECT daily_limit_usd, monthly_limit_usd FROM spora_keys WHERE id = ?1",
            [spora_key_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap_or((None, None));

    let now = chrono::Utc::now();
    let day_start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp();
    let month_start = chrono::NaiveDate::from_ymd_opt(now.year(), now.month(), 1)
        .and_then(|d| d.and_hms_opt(0, 0, 0))
        .map(|dt| dt.and_utc().timestamp())
        .unwrap_or(0);

    use chrono::Datelike;

    if let Some(daily_cap) = daily_limit {
        let daily_spent: f64 = db
            .query_row(
                "SELECT COALESCE(SUM(cost_usd), 0) FROM request_logs WHERE spora_key_id = ?1 AND ts >= ?2",
                rusqlite::params![spora_key_id, day_start],
                |row| row.get(0),
            )
            .unwrap_or(0.0);
        if daily_spent >= daily_cap {
            return Err(SporaError::SpendCapExceeded(
                format!("Daily spend cap of ${:.2} reached", daily_cap)
            ));
        }
    }

    if let Some(monthly_cap) = monthly_limit {
        let monthly_spent: f64 = db
            .query_row(
                "SELECT COALESCE(SUM(cost_usd), 0) FROM request_logs WHERE spora_key_id = ?1 AND ts >= ?2",
                rusqlite::params![spora_key_id, month_start],
                |row| row.get(0),
            )
            .unwrap_or(0.0);
        if monthly_spent >= monthly_cap {
            return Err(SporaError::SpendCapExceeded(
                format!("Monthly spend cap of ${:.2} reached", monthly_cap)
            ));
        }
    }

    Ok(())
}

pub fn encrypt_key(key: &str) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(key.as_bytes())
}

pub fn decrypt_key(enc: &str) -> String {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD.decode(enc).unwrap_or_default();
    String::from_utf8(bytes).unwrap_or_default()
}
