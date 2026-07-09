# ============================================================================
#  CORRIGIR_TLS_VPS.ps1  —  Liga o TLS 1.2 no Windows da VPS (registro)
#
#  CAUSA do erro "Nao foi possivel criar um canal seguro para SSL/TLS" (e do
#  5203 no MT4): o Windows Server antigo esta com o TLS 1.2 DESLIGADO no schannel
#  e o .NET nao usa criptografia forte por padrao. Isso derruba tudo que usa o
#  TLS do Windows (MT4 e PowerShell). O Chrome funciona por ter TLS proprio.
#
#  ESTE SCRIPT liga o TLS 1.2 (client+server) no registro e manda o .NET usar
#  TLS forte. Conserta o PowerShell E o MT4 de uma vez.
#
#  COMO RODAR (na VPS, como ADMINISTRADOR):
#    1) Botao direito no PowerShell -> "Executar como administrador"
#    2) Cole:  powershell -ExecutionPolicy Bypass -File CORRIGIR_TLS_VPS.ps1
#       (ou botao direito no arquivo -> Executar com PowerShell, sendo admin)
#    3) >>> REINICIE A VPS <<<  (obrigatorio pra valer)
#    4) Depois do reboot, roda o TFX_Enviador_Externo.ps1 de novo — vai conectar.
#       (e o MT4 provavelmente para de dar 5203 tambem)
# ============================================================================

function SetDword($path, $name, $value) {
  if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
  New-ItemProperty -Path $path -Name $name -Value $value -PropertyType DWord -Force | Out-Null
  Write-Host ("  OK  {0}\{1} = {2}" -f $path, $name, $value) -ForegroundColor Green
}

Write-Host "=== Ligando TLS 1.2 no schannel (sistema) ===" -ForegroundColor Cyan
$base = "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols"
foreach ($proto in @("TLS 1.2","TLS 1.1")) {
  foreach ($lado in @("Client","Server")) {
    SetDword "$base\$proto\$lado" "Enabled" 1
    SetDword "$base\$proto\$lado" "DisabledByDefault" 0
  }
}

Write-Host "=== Mandando o .NET usar TLS forte (SchUseStrongCrypto) ===" -ForegroundColor Cyan
foreach ($net in @(
  "HKLM:\SOFTWARE\Microsoft\.NETFramework\v4.0.30319",
  "HKLM:\SOFTWARE\WOW6432Node\Microsoft\.NETFramework\v4.0.30319",
  "HKLM:\SOFTWARE\Microsoft\.NETFramework\v2.0.50727",
  "HKLM:\SOFTWARE\WOW6432Node\Microsoft\.NETFramework\v2.0.50727"
)) {
  SetDword $net "SchUseStrongCrypto" 1
  SetDword $net "SystemDefaultTlsVersions" 1
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host " PRONTO. AGORA >>> REINICIE A VPS <<< pra valer." -ForegroundColor Yellow
Write-Host " Depois do reboot: rode o TFX_Enviador_Externo.ps1 de novo." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
