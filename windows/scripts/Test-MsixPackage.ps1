<#
  NEXORA AI by BECETTI — Inspect an MSIX package without installing it.
  Supports both the upgraded Native C# + WebView2 + MG Ads SDK V1.2.1 host
  (NexoraWindows.exe) and legacy Hosted App Model inspection.
  Checks: AppxManifest presence, exact Partner Center identity, 4-part version,
  capabilities, native binaries & MG Ads config, required tile/splash assets,
  and strict secret/private-key/demo-ID leakage scanning.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$MsixPath,
  [string]$IdentityFile = (Join-Path $PSScriptRoot '..\package-identity.json')
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

  Write-Host 'NEXORA AI by BECETTI - MSIX inspection'
  Write-Host "  Name:        $($identity.Name)"
  Write-Host "  Publisher:   $($identity.Publisher)"
  Write-Host "  Version:     $($identity.Version)"
  Write-Host "  Arch:        $($identity.ProcessorArchitecture)"
  Write-Host "  DisplayName: $($manifest.Package.Properties.DisplayName)"
  Write-Host "  PublisherDN: $($manifest.Package.Properties.PublisherDisplayName)"
  $uap10Ns = 'http://schemas.microsoft.com/appx/manifest/uap/windows10/10'
  $hostId = $app.GetAttribute('HostId', $uap10Ns)
  $parameters = $app.GetAttribute('Parameters', $uap10Ns)
  $executable = $app.GetAttribute('Executable')
  $entryPoint = $app.GetAttribute('EntryPoint')
  if ($executable) { Write-Host "  Executable:  $executable" }
  if ($entryPoint) { Write-Host "  EntryPoint:  $entryPoint" }
  if ($hostId) { Write-Host "  HostId:      $hostId" }
  if ($parameters) { Write-Host "  Parameters:  $parameters" }
  if ($app.StartPage) { Write-Host "  StartPage:   $($app.StartPage)" }

  if ($identity.Version -notmatch '^\d{1,5}\.\d{1,5}\.\d{1,5}\.\d{1,5}$') { $errors.Add('Version is not four numeric parts.') }
  if ($identity.Name -match 'REPLACE|PARTNER-CENTER|TODO') { $errors.Add('Identity Name is still a placeholder.') }
  if ($identity.Publisher -match 'REPLACE|PARTNER-CENTER|TODO') { $errors.Add('Publisher is still a placeholder.') }

  $expectedDisplayName = 'NEXORA AI by BECETTI'
  if ($IdentityFile -and (Test-Path -LiteralPath $IdentityFile)) {
    $expected = Get-Content -LiteralPath $IdentityFile -Raw | ConvertFrom-Json
    $expectedDisplayName = [string]$expected.displayName
    if ($identity.Name -ne $expected.identityName) { $errors.Add("Identity Name does not match package-identity.json: $($identity.Name)") }
    if ($identity.Publisher -ne $expected.publisher) { $errors.Add("Publisher does not match package-identity.json: $($identity.Publisher)") }
    if ($identity.Version -ne $expected.version) { $errors.Add("Version does not match package-identity.json: $($identity.Version)") }
    if ($manifest.Package.Properties.DisplayName -ne $expectedDisplayName) { $errors.Add("DisplayName does not match package-identity.json: $($manifest.Package.Properties.DisplayName)") }
    if ($manifest.Package.Properties.PublisherDisplayName -ne $expected.publisherDisplayName) { $errors.Add("PublisherDisplayName does not match package-identity.json: $($manifest.Package.Properties.PublisherDisplayName)") }
  }
  else {
    Write-Warning "Identity file not found ($IdentityFile); only structural identity checks were performed."
  }

  if ($manifest.Package.Properties.DisplayName -ne $expectedDisplayName) {
    $errors.Add("Properties/DisplayName must be the reserved Store name (got: $($manifest.Package.Properties.DisplayName)).")
  }
  $visualElements = $app.SelectSingleNode("*[local-name()='VisualElements']")
  if ($visualElements -and $visualElements.GetAttribute('DisplayName') -ne $expectedDisplayName) {
    $errors.Add("VisualElements/DisplayName must match the reserved Store name (got: $($visualElements.GetAttribute('DisplayName'))).")
  }
  if ($manifest.Package.Properties.PublisherDisplayName -ne 'Ahmedbecetti') {
    $errors.Add('PublisherDisplayName must be "Ahmedbecetti" (Partner Center).')
  }

  if ($executable) {
    # Native C# + WebView2 + MG Ads Desktop Bridge package
    if ($executable -ne 'NexoraWindows.exe') { $errors.Add("Unexpected Executable: $executable") }
    if ($entryPoint -ne 'Windows.FullTrustApplication') { $errors.Add("Native executable must use EntryPoint='Windows.FullTrustApplication' (got: $entryPoint)") }
    foreach ($nativeFile in @('NexoraWindows.exe', 'MiracleGamesAd.dll', 'Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'MgAdSDKCSharpDLL.dll', 'WebView2Loader.dll', 'Config\mgads-config.json')) {
      $plain = $nativeFile -replace '\\', '/'
      if (-not (Test-Path -LiteralPath (Join-Path $temp $plain))) { $errors.Add("Missing native runtime file: $nativeFile") }
    }
    $mgCfgPath = Join-Path $temp 'Config/mgads-config.json'
    if (Test-Path -LiteralPath $mgCfgPath) {
      $mgCfg = Get-Content -LiteralPath $mgCfgPath -Raw | ConvertFrom-Json
      if ($mgCfg.appId -ne '6b03f6af1f812ea86a26de4f') { $errors.Add("Unexpected MG Ads AppId in mgads-config.json: $($mgCfg.appId)") }
      if ($mgCfg.startUrl -notmatch '\?nx_surface=msix') { $errors.Add('mgads-config.json startUrl must include ?nx_surface=msix so MSIX-only policies apply.') }
      if ($mgCfg.units.interstitial.enabled -eq $true -and -not $mgCfg.units.interstitial.unitId) {
        $errors.Add('Interstitial cannot be enabled without an official unitId.')
      }
    }
  }
  elseif ($hostId) {
    if ($hostId -ne 'PWA') { $errors.Add("Unsupported HostId: $hostId") }
    if ($parameters -notmatch '--app-fallback-url=https://\S*\?nx_surface=msix') { $errors.Add('Fallback URL must include ?nx_surface=msix so MSIX-only policies apply.') }
    if ($parameters -notmatch '--app-id=[a-p]{32}\b') { $errors.Add('Hosted package must carry a 32-character a-p web app id.') }
    if ($parameters -notmatch '--windows-store-app') { $errors.Add('Hosted package must include --windows-store-app.') }
  }
  else {
    $errors.Add('Application must declare either Executable="NexoraWindows.exe" or HostId="PWA".')
  }

  $capNodes = @($manifest.Package.Capabilities.ChildNodes)
  if (-not ($capNodes | Where-Object { $_.Name -eq 'internetClient' })) {
    $errors.Add('internetClient capability is missing.')
  }
  if (-not ($capNodes | Where-Object { $_.Name -eq 'runFullTrust' })) {
    $errors.Add('runFullTrust capability is missing.')
  }

  $requiredAssets = @(
    'Assets\StoreLogo.png',
    'Assets\Square44x44Logo.png',
    'Assets\Square150x150Logo.png',
    'Assets\Wide310x150Logo.png',
    'Assets\SplashScreen.png'
  )
  foreach ($asset in $requiredAssets) {
    $plain = $asset -replace '\\', '/'
    if (-not (Test-Path -LiteralPath (Join-Path $temp $plain))) { $errors.Add("Missing asset: $asset") }
  }

  # Safety: no provider/service secrets, private keys, or MG/Google demo IDs may appear in package text files.
  $forbidden = @(
    'DATABASE_URL',
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'VERCEL_TOKEN',
    'FIREBASE_PRIVATE_KEY',
    'serviceAccount',
    'MIGTAgEA',
    'BEGIN PRIVATE KEY',
    'BEGIN EC PRIVATE KEY',
    '3940256099942544',
    '69316b6861328938223cc124',
    'cb7d9688a2d9499992febb6b642b3625',
    '2cb66a1301404561881a3f26b6ce5ba7'
  )
  Get-ChildItem -Path $temp -Recurse -File -Include *.js,*.json,*.html,*.xml,*.txt,*.config |
    Where-Object { $_.Length -lt 4MB } |
    ForEach-Object {
      $text = Get-Content -LiteralPath $_.FullName -Raw -ErrorAction SilentlyContinue
      foreach ($needle in $forbidden) {
        if ($text -and $text.Contains($needle)) { $errors.Add("Forbidden secret or test ID '$needle' found in $($_.Name)") }
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
