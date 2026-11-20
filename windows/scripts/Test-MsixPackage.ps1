<#
  NEXORA AI - Inspect an MSIX package without installing it.
  Checks: AppxManifest presence, identity values, 4-part version, hosted-app
  launch parameters, the exact capability set agreed in package-identity.json
  (internetClient + justified runFullTrust), required tile/splash assets, and
  obvious secret leakage in text files.
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
  Write-Host "  DisplayName: $($manifest.Package.Properties.DisplayName)"
  Write-Host "  PublisherDN: $($manifest.Package.Properties.PublisherDisplayName)"
  $uap10Ns = 'http://schemas.microsoft.com/appx/manifest/uap/windows10/10'
  $hostId = $app.GetAttribute('HostId', $uap10Ns)
  $parameters = $app.GetAttribute('Parameters', $uap10Ns)
  if ($hostId) { Write-Host "  HostId:      $hostId" }
  if ($parameters) { Write-Host "  Parameters:  $parameters" }
  if ($app.StartPage) { Write-Host "  StartPage:   $($app.StartPage)" }

  if ($identity.Version -notmatch '^\d{1,5}\.\d{1,5}\.\d{1,5}\.\d{1,5}$') { $errors.Add('Version is not four numeric parts.') }
  if ($identity.Name -match 'REPLACE|PARTNER-CENTER|TODO') { $errors.Add('Identity Name is still a placeholder.') }
  if ($identity.Publisher -match 'REPLACE|PARTNER-CENTER|TODO') { $errors.Add('Publisher is still a placeholder.') }

  # قارن الهوية بالملف المعتمد من Partner Center — لا يكفي أن يكون الشكل صحيحًا.
  $expectedDisplayName = 'NEXORA AI by BECETTI'
  if ($IdentityFile -and (Test-Path -LiteralPath $IdentityFile)) {
    $expected = Get-Content -LiteralPath $IdentityFile -Raw | ConvertFrom-Json
    $expectedDisplayName = [string]$expected.displayName
    if ($identity.Name -ne $expected.identityName) { $errors.Add("Identity Name does not match package-identity.json: $($identity.Name)") }
    if ($identity.Publisher -ne $expected.publisher) { $errors.Add("Publisher does not match package-identity.json: $($identity.Publisher)") }
    if ($identity.Version -ne $expected.version) { $errors.Add("Version does not match package-identity.json: $($identity.Version)") }
    if ($manifest.Package.Properties.DisplayName -ne $expectedDisplayName) { $errors.Add("DisplayName does not match package-identity.json: $($manifest.Package.Properties.DisplayName)") }
    if ($manifest.Package.Properties.PublisherDisplayName -ne $expected.publisherDisplayName) { $errors.Add("PublisherDisplayName does not match package-identity.json: $($manifest.Package.Properties.PublisherDisplayName)") }
    # سياسة الصلاحيات: مجموعة الحزمة يجب أن تطابق الهوية تمامًا (لا زيادة ولا نقصان).
    $declaredCaps = @($manifest.Package.Capabilities.ChildNodes |
      Where-Object { 'System.Xml.XmlElement' -eq $_.GetType().FullName } |
      ForEach-Object { [string]$_.GetAttribute('Name') } |
      Where-Object { $_ } | Sort-Object -Unique)
    $expectedCaps = @($expected.capabilities.required | Sort-Object -Unique)
    if (($declaredCaps -join ',') -ne ($expectedCaps -join ',')) {
      $errors.Add("Capabilities do not match package-identity.json. Package: [$($declaredCaps -join ', ')] / identity: [$($expectedCaps -join ', ')]")
    }
    foreach ($extra in @($declaredCaps | Where-Object { $_ -ne 'internetClient' -and $_ -ne 'runFullTrust' })) {
      $errors.Add("Unexpected restricted capability: $extra")
    }
    if ($declaredCaps -contains 'runFullTrust') {
      $justification = $expected.capabilities.restricted.runFullTrust
      if (-not $justification -or $justification.required -ne $true) { $errors.Add('runFullTrust is declared but not justified in package-identity.json.') }
      elseif (([string]$justification.partnerCenterJustification).Length -lt 120) { $errors.Add('Partner Center justification for runFullTrust is missing or too short.') }
      else { Write-Host "  runFullTrust: justified ($($justification.reviewFile))" }
    }
    if ($hostId) {
      if ($parameters -notmatch '--app-fallback-url=(?<url>https://\S+)') { $errors.Add('Hosted package has no --app-fallback-url.') }
      elseif ($Matches['url'] -ne $expected.startPage) { $errors.Add("Fallback URL does not match package-identity.json: $($Matches['url'])") }
      if ($parameters -notmatch '--app-id=[a-p]{32}') { $errors.Add('Hosted package has no valid --app-id.') }
      if ($parameters -notmatch '--ip-edge-aumid=Microsoft\.MicrosoftEdge\.stable_8wekyb3d8bbwe!MSEDGE') { $errors.Add('Hosted package does not target Microsoft Edge stable.') }
    }
    elseif ($app.StartPage -ne $expected.startPage) { $errors.Add("StartPage does not match package-identity.json: $($app.StartPage)") }
  }
  else {
    Write-Warning "Identity file not found ($IdentityFile); only structural identity checks were performed."
  }
  if ($manifest.Package.Properties.DisplayName -ne $expectedDisplayName) { $errors.Add("Properties/DisplayName must be the reserved Store name (got: $($manifest.Package.Properties.DisplayName)).") }
  $visualElements = $app.SelectSingleNode("*[local-name()='VisualElements']")
  if ($visualElements -and $visualElements.GetAttribute('DisplayName') -ne $expectedDisplayName) {
    $errors.Add("VisualElements/DisplayName must match the reserved Store name (got: $($visualElements.GetAttribute('DisplayName'))).")
  }
  if ($manifest.Package.Properties.PublisherDisplayName -ne 'Ahmedbecetti') { $errors.Add('PublisherDisplayName must be "Ahmedbecetti" (Partner Center).') }
  if ($hostId) {
    if ($hostId -ne 'PWA') { $errors.Add("Unsupported HostId: $hostId") }
    if ($parameters -notmatch '--app-fallback-url=https://\S*\?nx_surface=msix') { $errors.Add('Fallback URL must include ?nx_surface=msix so MSIX-only policies apply.') }
    if ($parameters -notmatch '--app-id=[a-p]{32}\b') { $errors.Add('Hosted package must carry a 32-character a-p web app id.') }
    if ($parameters -notmatch '--windows-store-app') { $errors.Add('Hosted package must include --windows-store-app.') }
  }
  elseif ($app.StartPage -notmatch '\?nx_surface=msix') { $errors.Add('StartPage must include ?nx_surface=msix so MSIX-only policies apply.') }
  if (-not $hostId -and $app.StartPage -notmatch '^https://') { $errors.Add('StartPage must use HTTPS.') }
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
