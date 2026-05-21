pub const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS provider_keys (
    id          TEXT PRIMARY KEY,
    provider    TEXT NOT NULL,
    label       TEXT NOT NULL,
    key_enc     TEXT NOT NULL,
    created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS spora_keys (
    id                  TEXT PRIMARY KEY,
    token               TEXT UNIQUE NOT NULL,
    label               TEXT NOT NULL,
    location            TEXT NOT NULL DEFAULT '',
    allowed_providers   TEXT,
    allowed_models      TEXT,
    daily_limit_usd     REAL,
    monthly_limit_usd   REAL,
    created_at          INTEGER NOT NULL,
    active              INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS request_logs (
    id                  TEXT PRIMARY KEY,
    spora_key_id        TEXT REFERENCES spora_keys(id),
    provider            TEXT NOT NULL,
    model               TEXT NOT NULL,
    prompt_tokens       INTEGER NOT NULL DEFAULT 0,
    completion_tokens   INTEGER NOT NULL DEFAULT 0,
    cost_usd            REAL NOT NULL DEFAULT 0.0,
    latency_ms          INTEGER NOT NULL DEFAULT 0,
    status_code         INTEGER NOT NULL DEFAULT 200,
    ts                  INTEGER NOT NULL,
    request_body        TEXT,
    response_body       TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key     TEXT PRIMARY KEY,
    value   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS models (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    provider            TEXT NOT NULL,
    spora_provider      TEXT NOT NULL,
    context_length      INTEGER NOT NULL DEFAULT 0,
    modality            TEXT NOT NULL DEFAULT '',
    description         TEXT NOT NULL DEFAULT '',
    prompt_price        REAL NOT NULL DEFAULT 0.0,
    completion_price    REAL NOT NULL DEFAULT 0.0,
    tags                TEXT NOT NULL DEFAULT '[]',
    updated_at          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_logs_ts ON request_logs(ts);
CREATE INDEX IF NOT EXISTS idx_logs_spora_key ON request_logs(spora_key_id);
CREATE INDEX IF NOT EXISTS idx_logs_provider ON request_logs(provider);
CREATE INDEX IF NOT EXISTS idx_models_spora_provider ON models(spora_provider);
"#;
