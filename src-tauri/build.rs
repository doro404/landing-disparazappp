fn main() {
    // Mata o processo anterior antes de compilar (evita "Acesso negado" no Windows)
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "super-robo-baileys.exe"])
            .output();
    }

    tauri_build::build()
}
