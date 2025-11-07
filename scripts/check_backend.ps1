try {
  $r = Invoke-WebRequest -UseBasicParsing http://localhost:8001/docs -TimeoutSec 5
  Write-Host "Backend OK:" $r.StatusCode
  exit 0
} catch {
  Write-Host "Backend indisponível"
  exit 1
}