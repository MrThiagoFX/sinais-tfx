# ============================================================================
#  TFX_Uploader.ps1 — Ponte final Infinity Signals
#  Lê os arquivos JSON gravados pelo indicador TFXINFINITY_SIGNAL_BRIDGE
#  (MQL4\Files) e envia os sinais (abertura/fechamento) para o backend.
#  Roda FORA do MetaTrader (não ocupa gráfico nem trava robôs).
#
#  USO na VPS:
#    1) No indicador, em cada gráfico, defina um nome de arquivo ÚNICO no input
#       "ArquivoJson" (ex.: TFX_XAUUSD_M15.json, TFX_US30_M15.json, ...).
#    2) Ajuste $FilesDir abaixo para a pasta de dados do MT4 (MT4 -> Arquivo ->
#       Abrir Pasta de Dados -> MQL4\Files). Se deixar vazio, ele tenta achar.
#    3) Botão direito neste arquivo -> "Executar com PowerShell" (ou agende).
# ============================================================================

param(
  [switch]$Once,                 # roda 1 ciclo e sai (para teste)
  [string]$FilesDir = "",        # pasta MQL4\Files (vazio = auto-descobrir)
  [string]$Pattern  = "TFX_*.json"
)

$BackendUrl  = "https://sinais-tfx.vercel.app/api/signals"
$Token       = "0393df6d014741badd6a55f12b62f69627168dabf17f60dd63af1fa9fdd9cebf"
$IntervalSec = 10
$StateFile   = Join-Path $env:TEMP "tfx_uploader_state.txt"

# Estado: ids já enviados (evita reenvio; o backend também é idempotente)
$sent = @{}
if (Test-Path $StateFile) { Get-Content $StateFile | ForEach-Object { if ($_) { $sent[$_] = $true } } }
function Save-Sent([string]$key) { $script:sent[$key] = $true; Add-Content -Path $StateFile -Value $key }

function Resolve-Dirs {
  if ($FilesDir -and (Test-Path $FilesDir)) { return @($FilesDir) }
  $globs = @(
    "$env:APPDATA\MetaQuotes\Terminal\*\MQL4\Files",
    "$env:APPDATA\MetaQuotes\Terminal\Common\Files"
  )
  $dirs = @()
  foreach ($g in $globs) { $dirs += (Get-ChildItem -Path $g -Directory -ErrorAction SilentlyContinue).FullName }
  return ($dirs | Sort-Object -Unique)
}

function Post-Signal([hashtable]$payload) {
  try {
    $body = $payload | ConvertTo-Json -Compress
    Invoke-RestMethod -Uri $BackendUrl -Method Post -ContentType "application/json" `
      -Headers @{ "X-TFX-Token" = $Token } -Body $body -TimeoutSec 15 | Out-Null
    return $true
  } catch { Write-Host "   ERRO POST: $($_.Exception.Message)" -ForegroundColor Red; return $false }
}

function Process-Cycle {
  foreach ($dir in (Resolve-Dirs)) {
    Get-ChildItem -Path (Join-Path $dir $Pattern) -ErrorAction SilentlyContinue | ForEach-Object {
      try { $data = Get-Content $_.FullName -Raw -ErrorAction Stop | ConvertFrom-Json } catch { return }
      $symbol = $data.simbolo; $tf = $data.timeframe
      if (-not $symbol -or -not $data.setups) { return }
      foreach ($s in $data.setups) {
        if ($s.direcao -ne "COMPRA" -and $s.direcao -ne "VENDA") { continue }
        $sid = ("{0}_{1}_{2}_{3}" -f $symbol, $tf, $s.direcao, $s.hora_sinal) -replace '[^A-Za-z0-9_]', '_'

        $openKey = "OPEN:$sid"
        if (-not $sent.ContainsKey($openKey)) {
          $ok = Post-Signal @{ event = "SIGNAL_OPEN"; signal_id = $sid; symbol = $symbol; timeframe = $tf;
            direction = $s.direcao; entry = [double]$s.preco_entrada; stop = [double]$s.stop; target = [double]$s.alvo }
          if ($ok) { Save-Sent $openKey; Write-Host ("ABERTURA  {0} {1} {2}" -f $symbol, $tf, $s.direcao) -ForegroundColor Green }
        }

        if ($s.status -eq "FECHADO") {
          $closeKey = "CLOSE:$sid"
          if (-not $sent.ContainsKey($closeKey)) {
            $ok = Post-Signal @{ event = "SIGNAL_CLOSE"; signal_id = $sid; symbol = $symbol; timeframe = $tf;
              direction = $s.direcao; entry = [double]$s.preco_entrada; "exit" = [double]$s.preco_saida;
              close_reason = $s.motivo_saida }
            if ($ok) { Save-Sent $closeKey; Write-Host ("FECHAMENTO {0} {1} ({2})" -f $symbol, $tf, $s.motivo_saida) -ForegroundColor Cyan }
          }
        }
      }
    }
  }
}

Write-Host "TFX Uploader iniciado. Backend: $BackendUrl" -ForegroundColor Yellow
Write-Host ("Pastas monitoradas: {0}" -f ((Resolve-Dirs) -join ' | '))
if ($Once) { Process-Cycle; Write-Host "ciclo unico concluido."; return }
while ($true) { Process-Cycle; Start-Sleep -Seconds $IntervalSec }
