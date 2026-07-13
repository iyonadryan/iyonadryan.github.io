# =============================================================================
# bootstrap.ps1 — sekali jalan, setelah Flutter SDK terpasang.
#
# Kenapa perlu script ini: folder native (android/, ios/) tidak bisa ditulis
# tangan secara andal (Gradle + Xcode .pbxproj digenerate tooling). Tapi
# `flutter create .` langsung di folder ini akan MENIMPA lib/main.dart dan
# pubspec.yaml yang sudah berisi kode app. Jadi script ini:
#   1. Jalankan `flutter create` ke folder TEMP (bersih, tidak menyentuh apa pun).
#   2. Salin HANYA android/ + ios/ dari temp ke sini.
#   3. Salin app/img/*.png ke assets/img/ (ikon Iyon/Ciwul/Both, dipakai badge
#      pembuat — di web direferensikan sbg ../img/, di Flutter harus jadi asset).
#   4. flutter pub get.
#
# Jalankan dari folder app/mobile:  .\bootstrap.ps1
# =============================================================================

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$temp = Join-Path $env:TEMP "iyon_mobile_scaffold"

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
  Write-Error "Flutter SDK tidak ditemukan di PATH. Install dulu: https://docs.flutter.dev/get-started/install/windows"
}

Write-Host "==> 1/4 Generate scaffold native di folder temp..." -ForegroundColor Cyan
if (Test-Path $temp) { Remove-Item -Recurse -Force $temp }
New-Item -ItemType Directory -Force $temp | Out-Null
flutter create --org com.iyonadryan --project-name iyon_mobile --platforms=android,ios $temp

Write-Host "==> 2/4 Salin android/ + ios/ ke project..." -ForegroundColor Cyan
foreach ($p in @("android", "ios")) {
  $src = Join-Path $temp $p
  $dst = Join-Path $root $p
  if (Test-Path $dst) {
    Write-Host "    $p/ sudah ada — dilewati (hapus manual dulu kalau mau regenerate)." -ForegroundColor Yellow
    continue
  }
  Copy-Item -Recurse $src $dst
  Write-Host "    $p/ dibuat."
}

Write-Host "==> 3/4 Salin ikon pengguna dari app/img ke assets/img..." -ForegroundColor Cyan
$assets = Join-Path $root "assets\img"
New-Item -ItemType Directory -Force $assets | Out-Null
Get-ChildItem (Join-Path $root "..\img") -Filter *.png | ForEach-Object {
  Copy-Item $_.FullName $assets -Force
  Write-Host "    $($_.Name)"
}

Write-Host "==> 4/4 flutter pub get..." -ForegroundColor Cyan
Push-Location $root
flutter pub get
Pop-Location

Remove-Item -Recurse -Force $temp

Write-Host ""
Write-Host "Selesai. Langkah berikutnya (WAJIB sebelum run):" -ForegroundColor Green
Write-Host "  dart pub global activate flutterfire_cli"
Write-Host "  flutterfire configure --project=iyon-adryanlf-trialerror"
Write-Host ""
Write-Host "Itu akan menimpa lib/core/firebase_options.dart dengan appId Android/iOS"
Write-Host "yang benar (yang sekarang cuma placeholder dari config web). Lihat README.md."
