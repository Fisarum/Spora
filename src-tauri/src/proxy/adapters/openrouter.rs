use reqwest::Client;
use serde_json::Value;
use crate::error::{Result, SporaError};

pub async fn forward(client: &Client, api_key: &str, body: &Value) -> Result<(Value, u16)> {
    let resp = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .header("HTTP-Referer", "https://github.com/Fisarum/Spora")
        .header("X-Title", "Spora Gateway")
        .json(body)
        .send()
        .await
        .map_err(SporaError::Http)?;

    let status = resp.status().as_u16();
    let json: Value = resp.json().await.map_err(SporaError::Http)?;
    Ok((json, status))
}
