pub mod router;
pub mod middleware;
pub mod adapters;

use axum::Router;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::{CorsLayer, Any};
use crate::state::AppState;
use crate::error::Result;

pub async fn start_proxy(state: Arc<RwLock<AppState>>, port: u16) -> Result<()> {
    let app = Router::new()
        .merge(router::create_router(state))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        );

    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await
        .map_err(|e| crate::error::SporaError::Other(e.to_string()))?;

    tracing::info!("Spora proxy listening on {}", addr);
    axum::serve(listener, app).await
        .map_err(|e| crate::error::SporaError::Other(e.to_string()))?;
    Ok(())
}
