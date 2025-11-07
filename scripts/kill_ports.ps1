$ports = 3000..3009 + 8000..8009
$pids = @()
foreach ($p in $ports) {
  try {
    $conns = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
      if ($c.OwningProcess) {
        $pids += $c.OwningProcess
      }
    }
  } catch {}
}

$pids = $pids | Sort-Object -Unique
foreach ($pid in $pids) {
  try {
    Write-Host "Matando PID $pid"
    taskkill /F /PID $pid | Out-Null
  } catch {}
}

Write-Host "Finalizado. PIDs encerrados:" ($pids -join ', ')