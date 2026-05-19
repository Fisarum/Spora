use reqwest::Client;
use serde_json::{Value, json};
use crate::error::{Result, SporaError};

pub async fn forward(client: &Client, api_key: &str, body: &Value) -> Result<(Value, u16)> {
    let model = body.get("model")
        .and_then(|m| m.as_str())
        .unwrap_or("gemini-1.5-flash");

    let gemini_body = openai_to_gemini(body);
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key
    );

    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&gemini_body)
        .send()
        .await
        .map_err(SporaError::Http)?;

    let status = resp.status().as_u16();
    let gemini_resp: Value = resp.json().await.map_err(SporaError::Http)?;
    let openai_resp = gemini_to_openai(&gemini_resp, model);
    Ok((openai_resp, status))
}

fn openai_to_gemini(body: &Value) -> Value {
    let messages = body.get("messages")
        .and_then(|m| m.as_array())
        .cloned()
        .unwrap_or_default();

    let contents: Vec<Value> = messages.iter().map(|msg| {
        let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("user");
        let content = msg.get("content").and_then(|c| c.as_str()).unwrap_or("");
        let gemini_role = if role == "assistant" { "model" } else { "user" };
        json!({
            "role": gemini_role,
            "parts": [{"text": content}]
        })
    }).collect();

    let mut req = json!({ "contents": contents });

    if let Some(temp) = body.get("temperature").and_then(|t| t.as_f64()) {
        req["generationConfig"] = json!({ "temperature": temp });
    }

    req
}

fn gemini_to_openai(gemini: &Value, model: &str) -> Value {
    let text = gemini
        .pointer("/candidates/0/content/parts/0/text")
        .and_then(|t| t.as_str())
        .unwrap_or("");

    let prompt_tokens = gemini.pointer("/usageMetadata/promptTokenCount")
        .and_then(|t| t.as_i64()).unwrap_or(0);
    let completion_tokens = gemini.pointer("/usageMetadata/candidatesTokenCount")
        .and_then(|t| t.as_i64()).unwrap_or(0);

    json!({
        "id": format!("gemini-{}", uuid::Uuid::new_v4()),
        "object": "chat.completion",
        "model": model,
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": text,
            },
            "finish_reason": "stop",
        }],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        }
    })
}
