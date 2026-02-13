# Start Expo on Android emulator with reliable localhost routing.
# Usage: .\start-android-local.ps1
#        .\start-android-local.ps1 -Clear

param(
  [switch]$Clear
)

$ErrorActionPreference = "Stop"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

if (-not (Test-Path $adb)) {
  Write-Host "adb not found: $adb" -ForegroundColor Red
  Write-Host "Install Android SDK platform-tools first." -ForegroundColor Yellow
  exit 1
}

Write-Host "Configuring adb reverse tcp:8081 -> tcp:8081 ..."
& $adb reverse tcp:8081 tcp:8081

if ($Clear) {
  Write-Host "Launching Expo with localhost mode on Android (clear cache)..."
  npx expo start --localhost --android --clear
} else {
  Write-Host "Launching Expo with localhost mode on Android..."
  npx expo start --localhost --android
}
