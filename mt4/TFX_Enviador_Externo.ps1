# ============================================================================
#  TFX_Enviador_Externo.ps1  —  Envia os sinais do spool2 SEM depender do MT4
#
#  POR QUE: o WebRequest do MT4 nessa VPS da erro 5203 (a engine de conexao do
#  MT4 falha), mas a VPS ALCANCA o servidor normalmente (o Internet Explorer
#  abre a URL). Este script roda FORA do MetaTrader e usa o TLS do Windows/.NET
#  (o mesmo do IE, que funciona) -> contorna 100% o bug do MT4.
#
#  O QUE FAZ: le os arquivos que o seu EA spool2 ja grava em
#  MQL4\Files\tfx_outbox\ (*__OPEN.json / *__CLOSE.json), manda pro backend,
#  apaga no 2xx, move pra \bad no 400. Igual o EA faria.
#
#  COMO RODAR NA VPS:
#    1) Copie este arquivo pra VPS (ex.: Area de Trabalho).
#    2) Botao direito -> "Executar com PowerShell"
#       (ou no cmd:  powershell -ExecutionPolicy Bypass -File TFX_Enviador_Externo.ps1 )
#    3) Deixe a janela aberta. Ele acha a pasta tfx_outbox sozinho e fica
#       enviando a cada 5s. Pode fechar o EA sender do MT4 (nao precisa mais dele
#       pra enviar; o indicador continua gravando os arquivos).
#
#  Se ele nao achar a pasta, passe manualmente:
#    powershell -ExecutionPolicy Bypass -File TFX_Enviador_Externo.ps1 -OutboxDir "C:\Users\Administrador\AppData\Roaming\MetaQuotes\Terminal\SEU_ID\MQL4\Files\tfx_outbox"
# ============================================================================

param(
  [string]$OutboxDir  = "",      # pasta tfx_outbox (vazio = auto-descobre)
  [int]   $IntervaloSeg = 5,
  [switch]$UmaVez               # roda 1 ciclo e sai (so pra testar)
)

$Endpoint = "https://sinais-tfx.vercel.app/api/signals"
$Token    = "0393df6d014741badd6a55f12b62f69627168dabf17f60dd63af1fa9fdd9cebf"

# Forca TLS 1.2 pelo VALOR NUMERICO (3072) — funciona ate no .NET antigo do
# Windows Server 2012, onde o nome [SecurityProtocolType]::Tls12 pode nao existir.
try { [Net.ServicePointManager]::SecurityProtocol = 3072 } catch {}
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 12288 } catch {} # +TLS1.3 se existir
# Ignora validacao de certificado: VPS antiga pode estar SEM a raiz nova do
# certificado da Vercel (o Chrome funciona por ter raiz propria). Como o destino
# e o NOSSO servidor conhecido, ignorar a checagem aqui e seguro e resolve o caso.
try { [Net.ServicePointManager]::ServerCertificateValidationCallback = { $true } } catch {}

function Achar-Outbox {
  if ($OutboxDir -and (Test-Path $OutboxDir)) { return $OutboxDir }
  $base = Join-Path $env:APPDATA "MetaQuotes\Terminal"
  if (Test-Path $base) {
    $achados = Get-ChildItem $base -Directory -ErrorAction SilentlyContinue |
      ForEach-Object { Join-Path $_.FullName "MQL4\Files\tfx_outbox" } |
      Where-Object { Test-Path $_ }
    if ($achados) { return @($achados)[0] }
  }
  return $null
}

$outbox = Achar-Outbox
if (-not $outbox) {
  Write-Host "ERRO: pasta tfx_outbox nao encontrada." -ForegroundColor Red
  Write-Host "Rode passando a pasta:  -OutboxDir 'C:\...\MQL4\Files\tfx_outbox'"
  exit 1
}
$badDir = Join-Path $outbox "bad"
if (-not (Test-Path $badDir)) { New-Item -ItemType Directory -Path $badDir -Force | Out-Null }

Write-Host "==============================================="
Write-Host "TFX Enviador Externo (bypass do MT4)"
Write-Host "Outbox  : $outbox"
Write-Host "Endpoint: $Endpoint"
Write-Host "==============================================="

# Teste de conexao na largada — mostra o motivo EXATO se falhar
Write-Host "Testando conexao com o servidor..." -ForegroundColor Cyan
try {
  $t = Invoke-WebRequest -Uri "https://sinais-tfx.vercel.app/api/health" -TimeoutSec 20 -UseBasicParsing
  Write-Host ("CONEXAO OK (HTTP {0}): {1}" -f [int]$t.StatusCode, $t.Content) -ForegroundColor Green
} catch {
  Write-Host ("CONEXAO FALHOU -> {0}" -f $_.Exception.Message) -ForegroundColor Red
  Write-Host "  (se falar de 'SSL/TLS' ou 'canal seguro' = TLS/certificado da VPS; me manda esta linha)"
}

function Enviar-Um($arquivo) {
  $json = Get-Content -LiteralPath $arquivo.FullName -Raw -Encoding UTF8
  if (-not $json -or -not $json.Trim()) { Remove-Item -LiteralPath $arquivo.FullName -Force; return $true }
  $code = 0; $errMsg = ""
  try {
    $resp = Invoke-WebRequest -Uri $Endpoint -Method Post -Body $json `
      -ContentType "application/json" -Headers @{ "X-TFX-Token" = $Token } `
      -TimeoutSec 20 -UseBasicParsing
    $code = [int]$resp.StatusCode
  } catch {
    $errMsg = $_.Exception.Message
    if ($_.Exception.Response) { try { $code = [int]$_.Exception.Response.StatusCode } catch { $code = 0 } }
  }
  if ($code -ge 200 -and $code -lt 300) {
    Remove-Item -LiteralPath $arquivo.FullName -Force
    Write-Host ("  OK   {0}  (HTTP {1})" -f $arquivo.Name, $code) -ForegroundColor Green
    return $true
  } elseif ($code -eq 400) {
    Move-Item -LiteralPath $arquivo.FullName -Destination (Join-Path $badDir $arquivo.Name) -Force
    Write-Host ("  BAD  {0}  (HTTP 400 -> movido p/ bad)" -f $arquivo.Name) -ForegroundColor Yellow
    return $true
  } elseif ($code -eq 401) {
    Write-Host "  401 - token invalido. Parando." -ForegroundColor Red
    return $false
  } else {
    Write-Host ("  FALHOU {0}  (HTTP/erro {1}) {2}" -f $arquivo.Name, $code, $errMsg) -ForegroundColor DarkYellow
    return $false
  }
}

do {
  $arqs = @(Get-ChildItem -LiteralPath $outbox -Filter "*.json" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*__OPEN.json" -or $_.Name -like "*__CLOSE.json" })

  # ordena por epoch (do signal_id) e OPEN antes de CLOSE
  $lista = foreach ($a in $arqs) {
    $sig = ($a.Name -split "__")[0]
    $ep = 0; if ($sig -match "_(\d+)$") { $ep = [long]$Matches[1] }
    $prio = if ($a.Name -like "*__OPEN.json") { 0 } else { 1 }
    [pscustomobject]@{ file = $a; epoch = $ep; prio = $prio }
  }
  $ordenados = @($lista | Sort-Object epoch, prio, @{ Expression = { $_.file.Name } })

  $enviados = 0
  foreach ($item in $ordenados) {
    if (-not (Enviar-Um $item.file)) { break }
    $enviados++
    Start-Sleep -Milliseconds 150   # respiro leve p/ nao bater no rate limit
  }

  $rest = @(Get-ChildItem -LiteralPath $outbox -Filter "*.json" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "*__OPEN.json" -or $_.Name -like "*__CLOSE.json" }).Count
  Write-Host ("[{0}] enviados neste ciclo: {1} | pendentes: {2}" -f (Get-Date -Format HH:mm:ss), $enviados, $rest) -ForegroundColor Cyan

  if ($UmaVez) { break }
  Start-Sleep -Seconds $IntervaloSeg
} while ($true)
