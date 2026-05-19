use axum::{
    routing::{get, post},
    Router,
    extract::{State, Json},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::Instant;
use uuid::Uuid;

use crate::state::AppState;
use crate::proxy::middleware::{extract_spora_key, resolve_provider_key, resolve_provider_key_for_model, check_spend_cap};
use crate::proxy::adapters::{openai, anthropic, gemini};

#[derive(Clone)]
pub struct ProxyState {
    pub app: Arc<RwLock<AppState>>,
}

pub fn create_router(state: Arc<RwLock<AppState>>) -> Router {
    let proxy_state = ProxyState { app: state };

    Router::new()
        .route("/v1/chat/completions", post(chat_completions))
        .route("/v1/models", get(list_models))
        .route("/health", get(health))
        .with_state(proxy_state)
}

async fn health() -> impl IntoResponse {
    Json(json!({"status": "ok", "service": "spora-gateway"}))
}

async fn list_models(
    State(state): State<ProxyState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let spora_key = match extract_spora_key(&headers) {
        Some(k) => k,
        None => {
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Missing Authorization header"}))).into_response();
        }
    };

    let resolved = {
        let s = state.app.read().await;
        let db = s.db.lock().unwrap();
        resolve_provider_key(&db, &spora_key)
    };

    match resolved {
        Err(e) => {
            (StatusCode::UNAUTHORIZED, Json(json!({"error": e.to_string()}))).into_response()
        }
        Ok(_) => Json(json!({
            "object": "list",
            "data": [
                {"id": "gpt-4o", "object": "model", "provider": "openai"},
                {"id": "gpt-4o-mini", "object": "model", "provider": "openai"},
                {"id": "gpt-3.5-turbo", "object": "model", "provider": "openai"},
                {"id": "claude-3-5-sonnet-20241022", "object": "model", "provider": "anthropic"},
                {"id": "claude-3-haiku-20240307", "object": "model", "provider": "anthropic"},
                {"id": "gemini-1.5-pro", "object": "model", "provider": "gemini"},
                {"id": "gemini-1.5-flash", "object": "model", "provider": "gemini"},
            ]
        })).into_response()
    }
}

async fn chat_completions(
    State(state): State<ProxyState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Response {
    let start = Instant::now();

    let spora_key_token = match extract_spora_key(&headers) {
        Some(k) => k,
        None => {
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": {"message": "Missing Authorization header", "type": "auth_error"}}))).into_response();
        }
    };

    let model = body.get("model")
        .and_then(|m| m.as_str())
        .unwrap_or("gpt-4o")
        .to_string();

    let (spora_key_id, provider, api_key, retry_count, timeout_secs) = {
        let s = state.app.read().await;
        let db = s.db.lock().unwrap();
        let resolved = match resolve_provider_key_for_model(&db, &spora_key_token, &model) {
            Ok(r) => r,
            Err(e) => {
                return (StatusCode::UNAUTHORIZED, Json(json!({"error": {"message": e.to_string(), "type": "auth_error"}}))).into_response();
            }
        };

        if let Err(e) = check_spend_cap(&db, &resolved.spora_key_id) {
            return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": {"message": e.to_string(), "type": "spend_cap_exceeded"}}))).into_response();
        }

        (
            resolved.spora_key_id,
            resolved.provider,
            resolved.api_key,
            s.settings.retry_count,
            s.settings.timeout_seconds,
        )
    };

    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .unwrap();

    let mut last_error: Option<String> = None;
    let mut response_body: Option<Value> = None;
    let mut status_code = 200u16;

    for attempt in 0..=(retry_count as usize) {
        if attempt > 0 {
            let backoff = std::time::Duration::from_millis(500 * (1u64 << (attempt - 1)));
            tokio::time::sleep(backoff).await;
        }

        let result = match provider.as_str() {
            "openai" => openai::forward(&http_client, &api_key, &body).await,
            "anthropic" => anthropic::forward(&http_client, &api_key, &body).await,
            "gemini" => gemini::forward(&http_client, &api_key, &body).await,
            _ => openai::forward(&http_client, &api_key, &body).await,
        };

        match result {
            Ok((resp_body, code)) => {
                status_code = code;
                response_body = Some(resp_body);
                if code < 500 {
                    break;
                }
                last_error = Some(format!("HTTP {}", code));
            }
            Err(e) => {
                last_error = Some(e.to_string());
            }
        }
    }

    let latency_ms = start.elapsed().as_millis() as i64;

    let (prompt_tokens, completion_tokens, cost) = if let Some(ref body) = response_body {
        extract_usage(body, &model, &provider)
    } else {
        (0, 0, 0.0)
    };

    {
        let s = state.app.read().await;
        let db = s.db.lock().unwrap();
        let log_id = Uuid::new_v4().to_string();
        let ts = chrono::Utc::now().timestamp();
        let _ = db.execute(
            "INSERT INTO request_logs (id, spora_key_id, provider, model, prompt_tokens, completion_tokens, cost_usd, latency_ms, status_code, ts)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                log_id,
                if spora_key_id.is_empty() { None } else { Some(&spora_key_id) },
                provider,
                model,
                prompt_tokens,
                completion_tokens,
                cost,
                latency_ms,
                status_code as i64,
                ts,
            ],
        );
    }

    match response_body {
        Some(body) => {
            let sc = StatusCode::from_u16(status_code).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
            (sc, Json(body)).into_response()
        }
        None => {
            let msg = last_error.unwrap_or_else(|| "Unknown error".to_string());
            (StatusCode::BAD_GATEWAY, Json(json!({"error": {"message": msg, "type": "gateway_error"}}))).into_response()
        }
    }
}

fn extract_usage(body: &Value, model: &str, provider: &str) -> (i64, i64, f64) {
    let prompt = body.pointer("/usage/prompt_tokens")
        .and_then(|v| v.as_i64()).unwrap_or(0);
    let completion = body.pointer("/usage/completion_tokens")
        .and_then(|v| v.as_i64()).unwrap_or(0);

    let cost = estimate_cost(model, provider, prompt, completion);
    (prompt, completion, cost)
}

fn estimate_cost(model: &str, _provider: &str, prompt: i64, completion: i64) -> f64 {
    let (input_per_1m, output_per_1m) = match model {
        "gpt-4o" => (5.0, 15.0),
        "gpt-4o-mini" => (0.15, 0.6),
        "gpt-3.5-turbo" => (0.5, 1.5),
        "claude-3-5-sonnet-20241022" => (3.0, 15.0),
        "claude-3-haiku-20240307" => (0.25, 1.25),
        "gemini-1.5-pro" => (1.25, 5.0),
        "gemini-1.5-flash" => (0.075, 0.3),
        _ => (1.0, 3.0),
    };
    (prompt as f64 * input_per_1m + completion as f64 * output_per_1m) / 1_000_000.0
}
