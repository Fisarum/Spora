use rusqlite::Connection;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewaySettings {
    pub retry_count: u32,
    pub timeout_seconds: u64,
    pub semantic_cache_enabled: bool,
    pub mcp_enabled: bool,
    pub data_retention_days: u32,
    pub gateway_port: u16,
}

impl Default for GatewaySettings {
    fn default() -> Self {
        Self {
            retry_count: 3,
            timeout_seconds: 30,
            semantic_cache_enabled: false,
            mcp_enabled: false,
            data_retention_days: 90,
            gateway_port: 4141,
        }
    }
}

pub struct AppState {
    pub db: Mutex<Connection>,
    pub settings: GatewaySettings,
    pub gateway_running: bool,
    pub gateway_port: u16,
}

impl AppState {
    pub fn new(conn: Connection) -> Self {
        let settings = load_settings_from_db(&conn).unwrap_or_default();
        let port = settings.gateway_port;
        Self {
            db: Mutex::new(conn),
            settings,
            gateway_running: true,
            gateway_port: port,
        }
    }
}

fn load_settings_from_db(conn: &Connection) -> Option<GatewaySettings> {
    let result: rusqlite::Result<String> = conn.query_row(
        "SELECT value FROM settings WHERE key = 'gateway_settings'",
        [],
        |row| row.get(0),
    );
    result.ok().and_then(|s| serde_json::from_str(&s).ok())
}
