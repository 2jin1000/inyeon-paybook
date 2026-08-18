#requires -version 5
# 인연 페이북 개발 모드 — 개발모드.cmd 가 이 파일을 부릅니다.
# 코드를 저장하면 화면이 바로 새로고침됩니다.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$Host.UI.RawUI.WindowTitle = '인연 페이북 (개발 모드)'
$port = 5173

Write-Host ''
Write-Host '  인연 페이북 - 개발 모드' -ForegroundColor Cyan
Write-Host '  코드를 저장하면 화면이 바로 새로고침됩니다.' -ForegroundColor DarkGray
Write-Host ''

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host '  [실패] Node.js 가 설치되어 있지 않습니다. https://nodejs.org 에서 설치해 주세요.' -ForegroundColor Red
  exit 1
}

if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "  이미 개발 서버가 떠 있습니다. 브라우저만 엽니다. (http://localhost:$port)" -ForegroundColor Yellow
  Start-Process "http://localhost:$port"
  Start-Sleep -Seconds 2
  exit 0
}

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host '  필요한 파일을 내려받는 중...' -ForegroundColor Yellow
  & npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Write-Host '  [실패] 패키지 설치 실패' -ForegroundColor Red; exit 1 }
}

Start-Job -ScriptBlock {
  param($url)
  for ($i = 0; $i -lt 40; $i++) {
    try {
      Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
      Start-Process $url
      return
    } catch { Start-Sleep -Milliseconds 500 }
  }
} -ArgumentList "http://localhost:$port" | Out-Null

& npm run dev
