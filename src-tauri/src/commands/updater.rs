use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<Option<String>, String> {
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    Ok(Some(update.version.clone()))
                }
                Ok(None) => Ok(None),
                Err(e) => Err(format!("Failed to check for updates: {}", e)),
            }
        }
        Err(e) => Err(format!("Updater not available: {}", e)),
    }
}

#[tauri::command]
pub async fn download_update(
    app: AppHandle,
    window: tauri::Window,
) -> Result<(), String> {
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    // Download with progress events
                    let on_chunk = |chunk_length: usize, content_length: Option<u64>| {
                        let progress = content_length
                            .map(|total| (chunk_length as f64 / total as f64) * 100.0)
                            .unwrap_or(0.0);
                        let _ = window.emit("update-progress", progress);
                    };
                    
                    match update.download_and_install(&on_chunk, || {}).await {
                        Ok(_) => {
                            let _ = window.emit("update-downloaded", ());
                            Ok(())
                        }
                        Err(e) => Err(format!("Failed to download update: {}", e)),
                    }
                }
                Ok(None) => Err("No update available".to_string()),
                Err(e) => Err(format!("Failed to check for updates: {}", e)),
            }
        }
        Err(e) => Err(format!("Updater not available: {}", e)),
    }
}

#[tauri::command]
pub async fn install_and_restart(app: AppHandle) -> Result<(), String> {
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    match update.download_and_install(&|_, _| {}, || {}).await {
                        Ok(_) => {
                            app.restart();
                        }
                        Err(e) => Err(format!("Failed to install update: {}", e)),
                    }
                }
                Ok(None) => Err("No update available".to_string()),
                Err(e) => Err(format!("Failed to check for updates: {}", e)),
            }
        }
        Err(e) => Err(format!("Updater not available: {}", e)),
    }
}

#[tauri::command]
pub fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
