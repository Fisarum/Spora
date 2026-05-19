use reqwest::Client;
use serde_json::{Value, json};
use crate::error::{Result, SporaError};

pub async fn forward(client: &Client, api_key: &str, body: &Value) -> Result<(Value, u16)> {
    let anthropic_body = openai_to_anthropic(body);

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&anthropic_body)
        .send()
        .await
        .map_err(SporaError::Http)?;

    let status = resp.status().as_u16();
    let anthropic_resp: Value = resp.json().await.map_err(SporaError::Http)?;
    let openai_resp = anthropic_to_openai(&anthropic_resp, body);
    Ok((openai_resp, status))
}

fn openai_to_anthropic(body: &Value) -> Value {
    let messages = body.get("messages")
        .and_then(|m| m.as_array())
        .cloned()
        .unwrap_or_default();

    let mut system_prompt: Option<String> = None;
    let mut filtered_messages: Vec<Value> = Vec::new();

    for msg in &messages {
        let role = msg.get("role").and_then(|r| r.as_str()).unwrap_or("user");
        if role == "system" {
            system_prompt = msg.get("content").and_then(|c| c.as_str()).map(|s| s.to_string());
        } else {
            filtered_messages.push(msg.clone());
        }
    }

    let model = body.get("model")
        .and_then(|m| m.as_str())
        .unwrap_or("claude-3-5-sonnet-20241022");

    let max_tokens = body.get("max_tokens")
        .and_then(|t| t.as_i64())
        .unwrap_or(4096);

    let mut req = json!({
        "model": model,
        "messages": filtered_messages,
        "max_tokens": max_tokens,
    });

    if let Some(sp) = system_prompt {
        req["system"] = json!(sp);
    }

    if let Some(temp) = body.get("temperature") {
        req["temperature"] = temp.clone();
    }

    req
}

fn anthropic_to_openai(anthropic: &Value, original: &Value) -> Value {
    let content = anthropic.pointer("/content/0/text")
        .and_then(|t| t.as_str())
        .unwrap_or("");

    let model = original.get("model")
        .and_then(|m| m.as_str())
        .unwrap_or("claude-3-5-sonnet-20241022");

    let prompt_tokens = anthropic.pointer("/usage/input_tokens")
        .and_then(|t| t.as_i64()).unwrap_or(0);
    let completion_tokens = anthropic.pointer("/usage/output_tokens")
        .and_then(|t| t.as_i64()).unwrap_or(0);

    json!({
        "id": anthropic.get("id").cloned().unwrap_or(json!("msg_spora")),
        "object": "chat.completion",
        "model": model,
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": content,
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
