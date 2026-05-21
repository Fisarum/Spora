pub mod schema;

use rusqlite::Connection;
use serde::Deserialize;
use crate::error::Result;
use chrono::Utc;

pub fn open_db(path: &std::path::Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    Ok(conn)
}

pub fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(schema::SCHEMA)?;

    // Migrations for existing DBs
    let _ = conn.execute("ALTER TABLE request_logs ADD COLUMN request_body TEXT", []);
    let _ = conn.execute("ALTER TABLE request_logs ADD COLUMN response_body TEXT", []);

    // Seed default models if table is empty
    let model_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM models", [], |r| r.get(0))
        .unwrap_or(0);
    if model_count == 0 {
        let _ = ingest_default_models(conn);
    }

    Ok(())
}

#[derive(Deserialize)]
struct RawModelSeed {
    id: String,
    name: String,
    provider: String,
    context_length: i64,
    modality: String,
    description: String,
    prompt_price: f64,
    completion_price: f64,
}

pub fn map_to_spora_provider(provider: &str) -> &'static str {
    match provider {
        "openai" => "openai",
        "anthropic" => "anthropic",
        "google" => "gemini",
        _ => "openrouter",
    }
}

pub fn compute_model_tags(name: &str, description: &str, prompt_price: f64, completion_price: f64, modality: &str) -> Vec<&'static str> {
    let mut tags: Vec<&'static str> = Vec::new();
    let nl = name.to_lowercase();
    let dl = description.to_lowercase();

    if prompt_price == 0.0 && completion_price == 0.0 {
        tags.push("Free");
    }
    let coding_kw = ["coding", "code gen", "software eng", "swe-bench", "developer", "programming", "codebase", "devstral", "coder", "agentic coding"];
    if coding_kw.iter().any(|k| dl.contains(k) || nl.contains(k)) {
        tags.push("Coding");
    }
    let reason_kw = ["reasoning", "thinking", "reinforcement learning to think", "step-by-step", "math", "science", "logic"];
    if reason_kw.iter().any(|k| dl.contains(k)) {
        tags.push("Reasoning");
    }
    let fast_kw = ["flash", " mini", " lite", "nano", " turbo", "fast", "haiku", "instant", "quick"];
    if fast_kw.iter().any(|k| nl.contains(k)) {
        tags.push("Fast");
    }
    if modality.contains("image") || modality.contains("video") || modality.contains("audio") {
        tags.push("Vision");
    }
    tags
}

static DEFAULT_MODELS_JSON: &str = r#"[
{"id":"openai/gpt-4o","name":"OpenAI: GPT-4o","provider":"openai","context_length":128000,"modality":"text+image->text","description":"GPT-4o is OpenAI's flagship model supporting text and image inputs. Twice as fast as GPT-4 Turbo.","prompt_price":0.0000025,"completion_price":0.00001},
{"id":"openai/gpt-4o-mini","name":"OpenAI: GPT-4o Mini","provider":"openai","context_length":128000,"modality":"text+image->text","description":"GPT-4o mini is OpenAI's fast, affordable model for lightweight tasks with text and image inputs.","prompt_price":0.00000015,"completion_price":0.0000006},
{"id":"openai/gpt-4.1","name":"OpenAI: GPT-4.1","provider":"openai","context_length":1047576,"modality":"text+image+file->text","description":"GPT-4.1 is optimized for advanced instruction following, real-world software engineering, and long-context reasoning.","prompt_price":0.000002,"completion_price":0.000008},
{"id":"openai/gpt-4.1-mini","name":"OpenAI: GPT-4.1 Mini","provider":"openai","context_length":1047576,"modality":"text+image+file->text","description":"GPT-4.1 Mini delivers competitive performance at lower latency and cost with a 1M token context window.","prompt_price":0.0000004,"completion_price":0.0000016},
{"id":"openai/gpt-4.1-nano","name":"OpenAI: GPT-4.1 Nano","provider":"openai","context_length":1047576,"modality":"text+image+file->text","description":"GPT-4.1 nano is the fastest, cheapest in the GPT-4.1 series, ideal for low-latency and high-volume tasks.","prompt_price":0.0000001,"completion_price":0.0000004},
{"id":"openai/gpt-5.4","name":"OpenAI: GPT-5.4","provider":"openai","context_length":1050000,"modality":"text+image+file->text","description":"GPT-5.4 unifies Codex and GPT lines with a 1M+ token context window. State-of-the-art coding and reasoning.","prompt_price":0.0000025,"completion_price":0.000015},
{"id":"openai/gpt-5.4-mini","name":"OpenAI: GPT-5.4 Mini","provider":"openai","context_length":400000,"modality":"text+image+file->text","description":"GPT-5.4 mini is a fast, cost-efficient model for high-throughput workloads with strong coding performance.","prompt_price":0.00000075,"completion_price":0.0000045},
{"id":"openai/gpt-5.4-pro","name":"OpenAI: GPT-5.4 Pro","provider":"openai","context_length":1050000,"modality":"text+image+file->text","description":"GPT-5.4 Pro has enhanced reasoning for complex, high-stakes tasks with a 1M+ token context window.","prompt_price":0.00003,"completion_price":0.00018},
{"id":"openai/o3","name":"OpenAI: o3","provider":"openai","context_length":200000,"modality":"text+image+file->text","description":"o3 uses reinforcement learning to think before answering. Excels at math, science, coding, and visual reasoning.","prompt_price":0.000002,"completion_price":0.000008},
{"id":"openai/o4-mini","name":"OpenAI: o4 Mini","provider":"openai","context_length":200000,"modality":"text+image+file->text","description":"o4-mini is a compact reasoning model for fast, cost-efficient performance with strong multimodal capabilities.","prompt_price":0.0000011,"completion_price":0.0000044},
{"id":"openai/gpt-3.5-turbo","name":"OpenAI: GPT-3.5 Turbo","provider":"openai","context_length":16385,"modality":"text->text","description":"GPT-3.5 Turbo is OpenAI's fast, cost-effective model for chat and completion tasks.","prompt_price":0.0000005,"completion_price":0.0000015},
{"id":"anthropic/claude-opus-4","name":"Anthropic: Claude Opus 4","provider":"anthropic","context_length":200000,"modality":"text+image+file->text","description":"Claude Opus 4 is benchmarked as the world's best coding model with sustained performance on complex, long-running tasks and agent workflows.","prompt_price":0.000015,"completion_price":0.000075},
{"id":"anthropic/claude-sonnet-4","name":"Anthropic: Claude Sonnet 4","provider":"anthropic","context_length":1000000,"modality":"text+image+file->text","description":"Claude Sonnet 4 excels in coding and reasoning tasks. State-of-the-art SWE-bench performance at 72.7%.","prompt_price":0.000003,"completion_price":0.000015},
{"id":"anthropic/claude-sonnet-4.6","name":"Anthropic: Claude Sonnet 4.6","provider":"anthropic","context_length":1000000,"modality":"text+image+file->text","description":"Sonnet 4.6 excels at iterative development, complex codebase navigation, and end-to-end project management.","prompt_price":0.000003,"completion_price":0.000015},
{"id":"anthropic/claude-opus-4.6","name":"Anthropic: Claude Opus 4.6","provider":"anthropic","context_length":1000000,"modality":"text+image+file->text","description":"Opus 4.6 is Anthropic's strongest model for coding and long-running professional tasks, built for agents.","prompt_price":0.000005,"completion_price":0.000025},
{"id":"anthropic/claude-opus-4.7","name":"Anthropic: Claude Opus 4.7","provider":"anthropic","context_length":1000000,"modality":"text+image+file->text","description":"Opus 4.7 is built for long-running, asynchronous agents with stronger coding performance.","prompt_price":0.000005,"completion_price":0.000025},
{"id":"anthropic/claude-3.5-haiku","name":"Anthropic: Claude 3.5 Haiku","provider":"anthropic","context_length":200000,"modality":"text+image->text","description":"Claude 3.5 Haiku features enhanced speed, coding accuracy, and tool use for real-time applications.","prompt_price":0.0000008,"completion_price":0.000004},
{"id":"anthropic/claude-3-haiku","name":"Anthropic: Claude 3 Haiku","provider":"anthropic","context_length":200000,"modality":"text+image->text","description":"Claude 3 Haiku is Anthropic's fastest, most compact model for near-instant responsiveness.","prompt_price":0.00000025,"completion_price":0.00000125},
{"id":"google/gemini-2.5-pro","name":"Google: Gemini 2.5 Pro","provider":"google","context_length":1048576,"modality":"text+image+file+audio+video->text","description":"Gemini 2.5 Pro is Google's state-of-the-art model for advanced reasoning, coding, math, and science with built-in thinking.","prompt_price":0.00000125,"completion_price":0.00001},
{"id":"google/gemini-2.5-flash","name":"Google: Gemini 2.5 Flash","provider":"google","context_length":1048576,"modality":"text+image+file+audio+video->text","description":"Gemini 2.5 Flash is Google's workhorse model for reasoning, coding, math, and science at Flash speed.","prompt_price":0.0000003,"completion_price":0.0000025},
{"id":"google/gemini-2.0-flash-001","name":"Google: Gemini 2.0 Flash","provider":"google","context_length":1000000,"modality":"text+image+file+audio+video->text","description":"Gemini 2.0 Flash offers fast TTFT while maintaining quality. Ideal for high-volume production workloads.","prompt_price":0.0000001,"completion_price":0.0000004},
{"id":"google/gemini-3.1-pro-preview","name":"Google: Gemini 3.1 Pro Preview","provider":"google","context_length":1048576,"modality":"text+image+file+audio+video->text","description":"Gemini 3.1 Pro Preview is Google's frontier reasoning model with enhanced software engineering performance.","prompt_price":0.000002,"completion_price":0.000012},
{"id":"google/gemini-3.5-flash","name":"Google: Gemini 3.5 Flash","provider":"google","context_length":1048576,"modality":"text+image+file+audio+video->text","description":"Gemini 3.5 Flash brings near-Pro level coding and reasoning at Flash-tier cost and speed.","prompt_price":0.0000015,"completion_price":0.000009},
{"id":"google/gemma-3-27b-it","name":"Google: Gemma 3 27B","provider":"google","context_length":131072,"modality":"text+image->text","description":"Gemma 3 27B supports vision-language input and text outputs, 140+ languages with improved math and reasoning.","prompt_price":0.00000008,"completion_price":0.00000016},
{"id":"deepseek/deepseek-r1","name":"DeepSeek: R1","provider":"deepseek","context_length":163840,"modality":"text->text","description":"DeepSeek R1 is a reasoning model using reinforcement learning to think before answering. On par with OpenAI o1, fully open-sourced with open reasoning tokens. 671B parameters, 37B active.","prompt_price":0.0000007,"completion_price":0.0000025},
{"id":"deepseek/deepseek-r1-0528","name":"DeepSeek: R1 0528","provider":"deepseek","context_length":163840,"modality":"text->text","description":"May 2026 update to DeepSeek R1. Reinforcement learning to think, on par with OpenAI o1. Open reasoning tokens.","prompt_price":0.0000005,"completion_price":0.00000215},
{"id":"deepseek/deepseek-chat","name":"DeepSeek: DeepSeek V3","provider":"deepseek","context_length":163840,"modality":"text->text","description":"DeepSeek-V3 latest chat model built on strong instruction following and coding abilities.","prompt_price":0.00000032,"completion_price":0.00000089},
{"id":"deepseek/deepseek-v3.2","name":"DeepSeek: DeepSeek V3.2","provider":"deepseek","context_length":131072,"modality":"text->text","description":"DeepSeek-V3.2 introduces sparse attention for efficient long-context processing with strong coding and reasoning.","prompt_price":0.000000252,"completion_price":0.000000378},
{"id":"meta-llama/llama-4-maverick","name":"Meta: Llama 4 Maverick","provider":"meta-llama","context_length":1048576,"modality":"text+image->text","description":"Llama 4 Maverick is a high-capacity multimodal MoE model with 128 experts and 17B active parameters.","prompt_price":0.00000015,"completion_price":0.0000006},
{"id":"meta-llama/llama-4-scout","name":"Meta: Llama 4 Scout","provider":"meta-llama","context_length":10000000,"modality":"text+image->text","description":"Llama 4 Scout is a MoE language model with native multimodal input and 10M token context window.","prompt_price":0.00000008,"completion_price":0.0000003},
{"id":"meta-llama/llama-3.3-70b-instruct","name":"Meta: Llama 3.3 70B Instruct","provider":"meta-llama","context_length":131072,"modality":"text->text","description":"Llama 3.3 70B is Meta's multilingual model for instruction following, reasoning, and summarization.","prompt_price":0.0000001,"completion_price":0.00000032},
{"id":"meta-llama/llama-3.3-70b-instruct:free","name":"Meta: Llama 3.3 70B (free)","provider":"meta-llama","context_length":131072,"modality":"text->text","description":"Free tier of Llama 3.3 70B Instruct. Multilingual instruction following and summarization.","prompt_price":0.0,"completion_price":0.0},
{"id":"mistralai/mistral-large-2512","name":"Mistral: Mistral Large 3","provider":"mistralai","context_length":262144,"modality":"text+image+file->text","description":"Mistral Large 3 is Mistral's most capable model with sparse MoE, 41B active out of 675B total. Apache 2.0.","prompt_price":0.0000005,"completion_price":0.0000015},
{"id":"mistralai/devstral-2512","name":"Mistral: Devstral 2","provider":"mistralai","context_length":262144,"modality":"text+file->text","description":"Devstral 2 specializes in agentic coding. 123B-parameter dense transformer for exploring large codebases.","prompt_price":0.0000004,"completion_price":0.000002},
{"id":"mistralai/mistral-small-3.1-24b-instruct","name":"Mistral: Mistral Small 3.1 24B","provider":"mistralai","context_length":128000,"modality":"text+image->text","description":"Mistral Small 3.1 features multimodal capabilities with strong text reasoning and vision understanding.","prompt_price":0.000000351,"completion_price":0.000000555},
{"id":"qwen/qwen3-235b-a22b","name":"Qwen: Qwen3 235B A22B","provider":"qwen","context_length":131072,"modality":"text->text","description":"Qwen3 235B MoE with 22B active parameters. Thinking mode for complex reasoning, math, and coding.","prompt_price":0.000000455,"completion_price":0.00000182},
{"id":"qwen/qwen3-32b","name":"Qwen: Qwen3 32B","provider":"qwen","context_length":131072,"modality":"text->text","description":"Qwen3 32B dense model with thinking mode for complex math, coding, and logical reasoning tasks.","prompt_price":0.00000008,"completion_price":0.00000028},
{"id":"qwen/qwen-2.5-coder-32b-instruct","name":"Qwen: Qwen2.5 Coder 32B","provider":"qwen","context_length":128000,"modality":"text->text","description":"Qwen2.5-Coder is a code-specific model with significantly improved code generation, code reasoning, and code fixing capabilities.","prompt_price":0.00000066,"completion_price":0.000001},
{"id":"x-ai/grok-4.20","name":"xAI: Grok 4.20","provider":"x-ai","context_length":2000000,"modality":"text+image+file->text","description":"Grok 4.20 is a reasoning model with industry-leading speed and agentic tool calling. Low hallucination rate.","prompt_price":0.00000125,"completion_price":0.0000025},
{"id":"x-ai/grok-build-0.1","name":"xAI: Grok Build 0.1","provider":"x-ai","context_length":256000,"modality":"text+image->text","description":"Grok Build 0.1 is xAI's fast coding model for agentic software engineering workflows.","prompt_price":0.000001,"completion_price":0.000002},
{"id":"nvidia/nemotron-3-nano-30b-a3b:free","name":"NVIDIA: Nemotron 3 Nano (free)","provider":"nvidia","context_length":256000,"modality":"text->text","description":"Nemotron 3 Nano 30B is a small MoE model for agentic AI systems. Fully open-sourced.","prompt_price":0.0,"completion_price":0.0},
{"id":"perplexity/sonar","name":"Perplexity: Sonar","provider":"perplexity","context_length":127072,"modality":"text+image->text","description":"Sonar is lightweight and fast with citations and customizable web search sources.","prompt_price":0.000001,"completion_price":0.000001},
{"id":"openrouter/auto","name":"Auto Router","provider":"openrouter","context_length":2000000,"modality":"text+image+file+audio+video->text+image","description":"Prompt is processed by a meta-model and routed to the best model automatically.","prompt_price":-1.0,"completion_price":-1.0},
{"id":"openrouter/free","name":"Free Models Router","provider":"openrouter","context_length":200000,"modality":"text+image->text","description":"Routes to free models available on OpenRouter, filtering for capable free models.","prompt_price":0.0,"completion_price":0.0},
{"id":"openrouter/pareto-code","name":"Pareto Code Router","provider":"openrouter","context_length":2000000,"modality":"text->text","description":"Maintains a tiered shortlist of strong coding models ranked by Artificial Analysis coding percentiles.","prompt_price":-1.0,"completion_price":-1.0}
]"#;

pub fn ingest_default_models(conn: &Connection) -> Result<()> {
    let models: Vec<RawModelSeed> = serde_json::from_str(DEFAULT_MODELS_JSON)
        .map_err(|e| crate::error::SporaError::Other(e.to_string()))?;

    let ts = Utc::now().timestamp();

    for m in &models {
        let spora_provider = map_to_spora_provider(&m.provider);
        let tags = compute_model_tags(&m.name, &m.description, m.prompt_price, m.completion_price, &m.modality);
        let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());

        let _ = conn.execute(
            "INSERT OR IGNORE INTO models (id, name, provider, spora_provider, context_length, modality, description, prompt_price, completion_price, tags, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            rusqlite::params![
                m.id, m.name, m.provider, spora_provider,
                m.context_length, m.modality, m.description,
                m.prompt_price, m.completion_price, tags_json, ts
            ],
        );
    }
    Ok(())
}
