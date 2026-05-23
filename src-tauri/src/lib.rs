pub mod db;
pub mod proxy;
pub mod state;
pub mod error;

#[cfg(feature = "gui")]
mod commands;

#[cfg(feature = "gui")]
pub fn run() {
    use tauri::Manager;
    use std::sync::Arc;
    use tokio::sync::RwLock;
    use crate::state::AppState;

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&data_dir).expect("Failed to create data dir");

            let db_path = data_dir.join("spora.db");
            let conn = db::open_db(&db_path).expect("Failed to open database");
            db::run_migrations(&conn).expect("Failed to run migrations");

            let app_state = Arc::new(RwLock::new(AppState::new(conn)));
            app.manage(app_state.clone());

            let state_for_proxy = app_state.clone();
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let port = {
                    let s = state_for_proxy.read().await;
                    s.settings.gateway_port
                };
                if let Err(e) = proxy::start_proxy(state_for_proxy, Some(handle), port).await {
                    tracing::error!("Proxy server error: {}", e);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::keys::list_provider_keys,
            commands::keys::add_provider_key,
            commands::keys::update_provider_key,
            commands::keys::delete_provider_key,
            commands::keys::list_spora_keys,
            commands::keys::create_spora_key,
            commands::keys::update_spora_key,
            commands::keys::revoke_spora_key,
            commands::keys::delete_spora_key,
            commands::analytics::get_usage_stats,
            commands::analytics::get_provider_usage,
            commands::analytics::get_model_usage,
            commands::analytics::get_key_usage,
            commands::analytics::get_daily_usage,
            commands::analytics::get_request_logs,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::export_logs,
            commands::settings::clear_logs,
            commands::settings::get_db_stats,
            commands::settings::get_gateway_status,
            commands::settings::start_gateway,
            commands::settings::stop_gateway,
            commands::updater::check_for_updates,
            commands::updater::download_update,
            commands::updater::install_and_restart,
            commands::updater::get_current_version,
            commands::models::list_available_models,
            commands::models::sync_models,
            commands::models::get_model_count,
            commands::models::reset_models,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
