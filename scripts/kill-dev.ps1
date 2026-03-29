# Mata todos os processos que bloqueiam o dev do Tauri
$names = @("super-robo-baileys", "baileys-server-x86_64-pc-windows-msvc")
foreach ($name in $names) {
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    if ($procs) {
        $procs | Stop-Process -Force
        Write-Host "Encerrado: $name ($($procs.Count) processo(s))"
    }
}

# Mata processo na porta 3001
$conn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    foreach ($c in $conn) {
        if ($c.OwningProcess -gt 4) {
            Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            Write-Host "Liberada porta 3001 (PID $($c.OwningProcess))"
        }
    }
}

Write-Host "Pronto."
