# Install Expo Go (SDK 54) to connected Android emulator
# Usage: .\install-expo-go.ps1
#    or: .\install-expo-go.ps1 -ApkPath "C:\path\to\Expo-Go-54.0.6.apk"
param([string]$ApkPath)

$ErrorActionPreference = "Stop"
$outPath = Join-Path $PSScriptRoot "expo-go-54.0.6.apk"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$downloadUrl = "https://github.com/expo/expo-go-releases/releases/download/Expo-Go-54.0.6/Expo-Go-54.0.6.apk"

if ($ApkPath -and (Test-Path $ApkPath)) {
    $outPath = $ApkPath
    Write-Host "Using APK: $outPath"
} elseif (-not (Test-Path $outPath) -or (Get-Item $outPath).Length -lt 100000000) {
    Write-Host "Downloading Expo Go APK (~173 MB)..."
    & curl.exe -sSL -o $outPath $downloadUrl
    if (-not (Test-Path $outPath) -or (Get-Item $outPath).Length -lt 100000000) {
        Write-Host "Download failed. Manual steps:" -ForegroundColor Yellow
        Write-Host "  1. Open in browser: $downloadUrl" -ForegroundColor Cyan
        Write-Host "  2. Save APK, then run:" -ForegroundColor Cyan
        Write-Host "     mobile\install-expo-go.ps1 -ApkPath `"C:\path\to\Expo-Go-54.0.5.apk`"" -ForegroundColor White
        exit 1
    }
    Write-Host "Download done."
} else {
    Write-Host "Using existing APK: $outPath ($([math]::Round((Get-Item $outPath).Length/1MB, 1)) MB)"
}

if (-not (Test-Path $adb)) {
    Write-Host "adb not found: $adb" -ForegroundColor Red
    exit 1
}

Write-Host "Installing to emulator..."
& $adb install -r $outPath
if ($LASTEXITCODE -eq 0) {
    Write-Host "Expo Go installed. Open Expo Go on emulator and enter: exp://192.168.1.11:8081" -ForegroundColor Green
} else {
    Write-Host "Install failed. Check: adb devices" -ForegroundColor Red
    exit 1
}
