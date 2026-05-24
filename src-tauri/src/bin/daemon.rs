use spora_lib::db;
use spora_lib::proxy;
use spora_lib::state::AppState;
use std::sync::Arc;
use tokio::sync::RwLock;

fn env_u16(name: &str) -> Option<u16> {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse::<u16>().ok())
}

fn db_path() -> std::path::PathBuf {
    if let Ok(path) = std::env::var("SPORA_DB_PATH") {
        return std::path::PathBuf::from(path);
    }
    let data_dir = dirs::data_dir().expect("Failed to find user data directory");
    data_dir.join("com.spora.gateway").join("spora.db")
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "spora_daemon=info,spora_lib=info".into()),
        )
        .init();

    tracing::info!("Spora daemon starting");

    let db_path = db_path();
    tracing::info!("Database path: {}", db_path.display());
    tracing::info!(
        "Analytics mode: {}",
        std::env::var("SPORA_ANALYTICS_MODE").unwrap_or_else(|_| "local".to_string())
    );

    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).expect("Failed to create data directory");
    }

    let conn = db::open_db(&db_path).expect("Failed to open database");
    db::run_migrations(&conn).expect("Failed to run migrations");

    let app_state = Arc::new(RwLock::new(AppState::new(conn)));

    let port = if let Some(port) = env_u16("SPORA_PORT") {
        port
    } else {
        let s = app_state.read().await;
        s.settings.gateway_port
    };

    tracing::info!("Starting Spora proxy on port {}", port);

    tokio::select! {
        result = proxy::start_proxy(app_state, None, port) => {
            if let Err(e) = result {
                tracing::error!("Proxy server error: {}", e);
            }
        }
        _ = shutdown_signal() => {
            tracing::info!("Shutdown signal received, stopping daemon");
        }
    }
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install Ctrl+C handler");
}
