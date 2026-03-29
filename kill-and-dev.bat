@echo off
echo Matando processos super-robo-baileys...
taskkill /F /IM super-robo-baileys.exe 2>nul
if %errorlevel% == 0 (
    echo Processo encerrado com sucesso.
) else (
    echo Nenhum processo encontrado ou acesso negado.
)
echo.
echo Aguardando 1 segundo...
timeout /t 1 /nobreak >nul
echo.
echo Iniciando tauri dev...
cd /d "%~dp0"
npm run tauri:dev
