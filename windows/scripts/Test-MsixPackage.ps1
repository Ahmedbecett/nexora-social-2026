<#
  NEXORA AI - Inspect an MSIX package without installing it.
  Checks: AppxManifest presence, identity values, 4-part version, StartPage,
  internetClient capability, required tile/splash assets, and obvious secret
  leakage in text files.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$MsixPath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not (Test-Path -LiteralPath $MsixPath)) { throw "Package not found: $MsixPath" }

$temp = Join-Path ([System.IO.Path]::GetTempPath()) ('nx-inspect-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
$errors = New-Object System.Collections.Generic.List[string]

try {
  [System.IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path -LiteralPath $MsixPath), $temp)
  $manifestPath = Join-Path $temp 'AppxManifest.xml'
  if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'AppxManifest.xml missing: not a valid MSIX.' }

  [xml]$manifest = Get-Content -LiteralPath $manifestPath -Raw
  $identity = $manifest.Package.Identity
  $app = @($manifest.Package.Applications.Application)[0]

  Write-Host 'NEXORA AI - MSIX inspection'
  Write-Host "  Name:        $($identity.Name)"
  Write-Host "  Publisher:   $($identity.Publisher)"
  Write-Host "  Version:     $($identity.Version)"
  Write-Host "  DisplayName: $($manifest.Package.Properties.DisplayName)"
  Write-Host "  PublisherDN: $($manifest.Package.Properties.PublisherDisplayName)"
  Write-Host "  StartPage:   $($app.StartPage)"

  if ($identity.Version -notmatch '^\d{1,5}\.\d{1,5}\.\d{1,5}\.\d{1,5}$') { $errors.Add('Version is not four numeric parts.') }
  if ($identity.Name -match 'REPLACE|PARTNER-CENTER|TODO') { $errors.Add('Identity Name is still a placeholder.') }
  if ($identity.Publisher -match 'REPLACE|PARTNER-CENTER|TODO') { $errors.Add('Publisher is still a placeholder.') }
  if ($manifest.Package.Properties.DisplayName -ne 'NEXORA AI') { $errors.Add('DisplayName must be "NEXORA AI".') }
  if ($manifest.Package.Properties.PublisherDisplayName -ne 'BECETTI') { $errors.Add('PublisherDisplayName must be "BECETTI".') }
  if ($app.StartPage -notmatch '\?nx_surface=msix') { $errors.Add('StartPage must include ?nx_surface=msix so MSIX-only policies apply.') }
  if ($app.StartPage -notmatch '^https://') { $errors.Add('StartPage must use HTTPS.') }
  if (-not ($manifest.Package.Capabilities.ChildNodes | Where-Object { $_.Name -eq 'internetClient' })) {
    $errors.Add('internetClient capability is missing.')
  }

  $required = @(
    'Assets\StoreLogo.png',
    'Assets\Square44x44Logo.png',
    'Assets\Square150x150Logo.png',
    'Assets\Wide310x150Logo.png',
    'Assets\SplashScreen.png'
  )
  foreach ($asset in $required) {
    $plain = $asset -replace '\\', '/'
    if (-not (Test-Path -LiteralPath (Join-Path $temp $plain))) { $errors.Add("Missing asset: $asset") }
  }

  # Safety: no provider/service keys should ever ship in a Windows package.
  $forbidden = @('DATABASE_URL', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'VERCEL_TOKEN', 'FIREBASE_PRIVATE_KEY', 'serviceAccount')
  Get-ChildItem -Path $temp -Recurse -File -Include *.js,*.json,*.html,*.xml,*.txt |
    Where-Object { $_.Length -lt 4MB } |
    ForEach-Object {
      $text = Get-Content -LiteralPath $_.FullName -Raw -ErrorAction SilentlyContinue
      foreach ($needle in $forbidden) {
        if ($text -and $text.Contains($needle)) { $errors.Add("Secret-like token '$needle' found in $($_.Name)") }
      }
    }

  if ($errors.Count) {
    Write-Host ''
    foreach ($e in $errors) { Write-Host "  ERROR $e" -ForegroundColor Red }
    exit 1
  }
  Write-Host ''
  Write-Host '  OK - no blocking issues found. Signature is verified separately with signtool.' -ForegroundColor Green
}
finally {
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue }
}
