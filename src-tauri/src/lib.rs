use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, Manager, State,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_autostart::ManagerExt;

pub struct SidecarState(pub Mutex<Option<CommandChild>>);

#[tauri::command]
async fn start_baileys_server(
    app: AppHandle,
    state: State<'_, SidecarState>,
) -> Result<String, String> {
    let mut child_guard = state.0.lock().map_err(|e| e.to_string())?;
    if child_guard.is_some() {
        return Ok("Sidecar já está rodando".to_string());
    }
    let sidecar_cmd = app
        .shell()
        .sidecar("baileys-server")
        .map_err(|e| e.to_string())?;
    
    // Define diretório de dados fora da árvore monitorada pelo Tauri
    // Usa o diretório pai do executável (ou do projeto em dev)
    let data_dir = app.path().app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."))
        .join("dispara-zapp-data");
    
    let sidecar_cmd = sidecar_cmd.env("DISPARA_DATA_DIR", data_dir.to_string_lossy().as_ref());
    let (mut rx, child) = sidecar_cmd.spawn().map_err(|e| e.to_string())?;
    *child_guard = Some(child);
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => println!("[baileys-server] {}", String::from_utf8_lossy(&line)),
                CommandEvent::Stderr(line) => eprintln!("[baileys-server ERR] {}", String::from_utf8_lossy(&line)),
                _ => {}
            }
        }
    });
    Ok("Sidecar iniciado".to_string())
}

#[tauri::command]
async fn stop_baileys_server(state: State<'_, SidecarState>) -> Result<String, String> {
    let mut child_guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(child) = child_guard.take() {
        child.kill().map_err(|e| e.to_string())?;
        return Ok("Sidecar parado".to_string());
    }
    Ok("Sidecar não estava rodando".to_string())
}

#[tauri::command]
async fn get_sidecar_status(state: State<'_, SidecarState>) -> Result<bool, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    Ok(guard.is_some())
}

#[tauri::command]
async fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let autostart = app.autolaunch();
    if enabled {
        autostart.enable().map_err(|e| e.to_string())?;
    } else {
        autostart.disable().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn get_autostart(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
async fn quit_app(app: AppHandle, state: State<'_, SidecarState>) -> Result<(), String> {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(child) = guard.take() {
            let _ = child.kill();
        }
    }
    app.exit(0);
    Ok(())
}

#[tauri::command]
async fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .manage(SidecarState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            start_baileys_server,
            stop_baileys_server,
            get_sidecar_status,
            quit_app,
            hide_window,
            set_autostart,
            get_autostart,
        ])
        .setup(|app| {
            // ── Inicia minimizado se veio do autostart ─────────────────────
            let args: Vec<String> = std::env::args().collect();
            let start_minimized = args.contains(&"--minimized".to_string());

            // ── Tray icon ──────────────────────────────────────────────────
            let show_item = MenuItem::with_id(app, "show", "Abrir Dispara Zapp", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Encerrar", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Dispara Zapp — Rodando em segundo plano")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_window(app),
                    "quit" => {
                        // Para o sidecar antes de sair
                        let state = app.state::<SidecarState>();
                        if let Ok(mut guard) = state.0.lock() {
                            if let Some(child) = guard.take() {
                                let _ = child.kill();
                            }
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    // Clique duplo ou clique esquerdo abre a janela
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // ── Intercepta fechar janela → emite evento pro frontend ──────
            let window = app.get_webview_window("main").unwrap();

            // ── Desativa DevTools em produção ──────────────────────────────
            // Nota: Em Tauri 2.x, DevTools são desativados automaticamente em produção
            // #[cfg(not(debug_assertions))]
            // window.set_devtools_enabled(false).ok();

            // Esconde janela se iniciado pelo autostart
            if start_minimized {
                let _ = window.hide();
            }

            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    // Emite evento pro frontend decidir o que fazer
                    let _ = window_clone.emit("close-requested", ());
                }
            });

            // ── Auto-start sidecar ─────────────────────────────────────────
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let state = app_handle.state::<SidecarState>();
                match start_baileys_server(app_handle.clone(), state).await {
                    Ok(msg) => println!("[setup] {}", msg),
                    Err(e) => eprintln!("[setup] Erro ao iniciar sidecar: {}", e),
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Erro ao iniciar aplicação Tauri");
}
