#requires -version 5
# 인연 페이북 실행 스크립트 — 실행.cmd 가 이 파일을 부릅니다.
# 빌드한 뒤 로컬 서버를 띄우고 브라우저를 엽니다.

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$Host.UI.RawUI.WindowTitle = '인연 페이북'
$port = 4173

function Fail($message) {
  Write-Host ''
  Write-Host "  [실패] $message" -ForegroundColor Red
  Write-Host ''
  exit 1
}

Write-Host ''
Write-Host '  ====================================' -ForegroundColor DarkGray
Write-Host '    인연 페이북 (경조사 관리 매니저)' -ForegroundColor Cyan
Write-Host '  ====================================' -ForegroundColor DarkGray
Write-Host ''

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host '  Node.js 가 설치되어 있지 않습니다.' -ForegroundColor Yellow
  Write-Host '  https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해 주세요.'
  Fail 'Node.js 없음'
}

# 이미 떠 있는 창이 있으면 두 번 띄우지 않고 브라우저만 연다.
if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
  Write-Host "  이미 실행 중입니다. 브라우저만 엽니다. (http://localhost:$port)" -ForegroundColor Yellow
  Write-Host '  새로 빌드하려면 먼저 기존 창을 닫아 주세요.' -ForegroundColor DarkGray
  Start-Process "http://localhost:$port"
  Start-Sleep -Seconds 2
  exit 0
}

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host '  처음 실행이라 필요한 파일을 내려받습니다. 몇 분 걸릴 수 있습니다...' -ForegroundColor Yellow
  & npm install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Fail '패키지 설치에 실패했습니다.' }
}

Write-Host '  앱을 준비하는 중...' -ForegroundColor DarkGray
& npm run build | Out-Null
if ($LASTEXITCODE -ne 0) { Fail '빌드에 실패했습니다.' }

# 같은 와이파이의 휴대폰에서 접속할 주소를 함께 안내한다.
$lan = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1 -ExpandProperty IPAddress)

Write-Host ''
Write-Host '  준비 완료. 브라우저가 곧 열립니다.' -ForegroundColor Green
Write-Host ''
Write-Host "    이 PC    http://localhost:$port" -ForegroundColor White
if ($lan) { Write-Host "    휴대폰   http://${lan}:$port  (같은 와이파이)" -ForegroundColor White }
Write-Host ''
Write-Host '  * 이 창을 닫으면 앱도 종료됩니다.' -ForegroundColor DarkGray
Write-Host ''

# 서버가 응답하기 시작하면 브라우저를 연다.
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

& npx vite preview --host --port $port --strictPort
