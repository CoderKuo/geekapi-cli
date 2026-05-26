# GeekAPI CLI 一键安装脚本（Windows）
#
# 使用：
#   irm https://raw.githubusercontent.com/CoderKuo/geekapi-cli/main/install.ps1 | iex
#
# 环境变量（可选）：
#   $env:GEEKAPI_VERSION      指定版本，例如 v0.2.0；默认拉 latest
#   $env:GEEKAPI_INSTALL_DIR  安装目录，默认 %LOCALAPPDATA%\Programs\GeekAPI
#   $env:GEEKAPI_BIN_NAME     生成的命令名，默认 geekapi.exe

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Repo        = 'CoderKuo/geekapi-cli'
$Asset       = 'geekapi-win.exe'
$InstallDir  = if ($env:GEEKAPI_INSTALL_DIR) { $env:GEEKAPI_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\GeekAPI' }
$BinName     = if ($env:GEEKAPI_BIN_NAME)    { $env:GEEKAPI_BIN_NAME }    else { 'geekapi.exe' }
$Version     = $env:GEEKAPI_VERSION

function Say  ($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok   ($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Warn ($msg) { Write-Host "[!]  $msg" -ForegroundColor Yellow }
function Die  ($msg) { Write-Host "[X]  $msg" -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host 'GeekAPI CLI 安装器' -ForegroundColor White
Write-Host ''

if ([Environment]::Is64BitOperatingSystem -ne $true) {
  Die '只支持 64 位 Windows。'
}

$Url = if ($Version) {
  "https://github.com/$Repo/releases/download/$Version/$Asset"
} else {
  "https://github.com/$Repo/releases/latest/download/$Asset"
}

Say "下载 $Asset"
Write-Host "    来源：$Url"

if (-not (Test-Path $InstallDir)) {
  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$Target = Join-Path $InstallDir $BinName
$Tmp    = "$Target.download"

try {
  $ProgressPreference = 'Continue'
  Invoke-WebRequest -Uri $Url -OutFile $Tmp -UseBasicParsing
} catch {
  if (Test-Path $Tmp) { Remove-Item $Tmp -Force -ErrorAction SilentlyContinue }
  Die "下载失败：$($_.Exception.Message)"
}

if (-not (Test-Path $Tmp) -or (Get-Item $Tmp).Length -eq 0) {
  Remove-Item $Tmp -Force -ErrorAction SilentlyContinue
  Die '下载到的文件是空的。'
}

# 如果旧版正在运行，覆盖会失败 —— 提前给个友好提示
if (Test-Path $Target) {
  try {
    Move-Item -Path $Tmp -Destination $Target -Force
  } catch {
    Remove-Item $Tmp -Force -ErrorAction SilentlyContinue
    Die "覆盖旧版本失败（可能正在运行）：关闭已打开的 GeekAPI CLI 后重试。"
  }
} else {
  Move-Item -Path $Tmp -Destination $Target -Force
}

Ok "已安装到 $Target"

# 把 InstallDir 加到当前用户的 PATH（永久）
$UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$PathEntries = if ($UserPath) { $UserPath.Split(';') | Where-Object { $_ -ne '' } } else { @() }
$AlreadyOnPath = $PathEntries -contains $InstallDir

if (-not $AlreadyOnPath) {
  Say "把 $InstallDir 加入当前用户的 PATH"
  $NewPath = if ($UserPath) { "$UserPath;$InstallDir" } else { $InstallDir }
  [Environment]::SetEnvironmentVariable('Path', $NewPath, 'User')
  # 当前会话也立即生效
  $env:Path = "$env:Path;$InstallDir"
  Ok 'PATH 更新完成（新打开的终端立即生效）'
} else {
  Ok "$InstallDir 已经在 PATH 中"
}

$BareName = [System.IO.Path]::GetFileNameWithoutExtension($BinName)

Write-Host ''
Write-Host '安装完成。' -ForegroundColor Green
Write-Host ''
Write-Host '  在新终端里运行：' -ForegroundColor White
Write-Host "    $BareName" -ForegroundColor Cyan
Write-Host ''
Write-Host '  或在当前会话直接运行：' -ForegroundColor White
Write-Host "    $Target" -ForegroundColor Cyan
Write-Host ''
