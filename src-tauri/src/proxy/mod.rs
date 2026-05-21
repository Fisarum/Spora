pub mod router;
pub mod middleware;
pub mod adapters;

use axum::Router;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::{CorsLayer, Any};
use crate::state::AppState;
use crate::error::Result;

#[cfg(feature = "gui")]
use tauri::AppHandle;
#[cfg(not(feature = "gui"))]
pub type AppHandle = ();

pub async fn start_proxy(state: Arc<RwLock<AppState>>, app_handle: Option<AppHandle>, port: u16) -> Result<()> {
    let app = Router::new()
        .merge(router::create_router(state, app_handle))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        );

    let bind_host = std::env::var("SPORA_LISTEN_ADDR").unwrap_or_else(|_| "127.0.0.1".to_string());
    let addr = format!("{}:{}", bind_host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await
        .map_err(|e| crate::error::SporaError::Other(e.to_string()))?;

    tracing::info!("Spora proxy listening on {}", addr);
    axum::serve(listener, app).await
        .map_err(|e| crate::error::SporaError::Other(e.to_string()))?;
    Ok(())
}
