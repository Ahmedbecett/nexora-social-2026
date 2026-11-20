<#
  NEXORA AI - Update an existing PWABuilder MSIX with Store identity values.
  ------------------------------------------------------------------------
  Preferred workflow: enter the Package/Identity/Publisher values in PWABuilder
  BEFORE generating the package. Use this script only when you already have a
  valid .msix (built by PWABuilder) and need to apply the identity file or fix
  the StartPage, then repack and sign.

  This script:
    1. Refuses to embed an invented Store Product ID.
    2. Extracts the .msix (it is a ZIP container) to a temporary folder.
    3. Replaces Identity Name/Publisher/Version, DisplayName, PublisherDisplayName
       and the hosted PWA fallback URL (keeps ?nx_surface=msix) or StartPage.
    4. Repacks with makeappx.exe and optionally signs with signtool.exe.

  Requirements: Windows 10/11, Windows SDK (makeappx/signtool), a .msix produced
  by PWABuilder. A .msixbundle is not handled here: configure identity in
  PWABuilder instead and rebuild.

  Example:
    .\Update-MsixIdentity.ps1 `
      -SourceMsix .\NEXORA.msix `
      -OutputMsix .\dist\NEXORA-AI-Windows.msix `
      -CertificatePath .\nexora-store.pfx -RequireSignature
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$SourceMsix,
  [Parameter(Mandatory = $true)][string]$OutputMsix,
  [string]$IdentityFile = (Join-Path $PSScriptRoot '..\package-identity.json'),
  [string]$CertificatePath,
  [System.Security.SecureString]$CertificatePassword,
  [switch]$RequireSignature,
  [string]$TimestampUrl = 'http://timestamp.digicert.com'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Find-WindowsSdkTool([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $roots = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'),
    (Join-Path $env:ProgramFiles 'Windows Kits\10\bin')
  ) | Where-Object { $_ -and (Test-Path $_) }
  foreach ($root in $roots) {
    $candidate = Get-ChildItem -Path $root -Filter $Name -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match '\\(x64|x86|arm64)\\' } |
      Sort-Object FullName -Descending | Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
  }
  throw "$Name was not found. Install the Windows 10/11 SDK."
}

if (-not (Test-Path -LiteralPath $SourceMsix)) { throw "Source package not found: $SourceMsix" }
if ([System.IO.Path]::GetExtension($SourceMsix) -ne '.msix') {
  throw 'Only .msix is supported by this script. For .msixbundle, set the identity in PWABuilder and rebuild.'
}
if (-not (Test-Path -LiteralPath $IdentityFile)) { throw "Identity file not found: $IdentityFile" }

$identity = Get-Content -LiteralPath $IdentityFile -Raw | ConvertFrom-Json
if ($identity.productId -and $identity.productId -notmatch '^9[A-Z0-9]{11}$') {
  throw "productId is not a valid Store Product ID: $($identity.productId). Copy it from Partner Center; never invent it."
}
if ($identity.version -notmatch '^\d{1,5}\.\d{1,5}\.\d{1,5}\.0$') {
  throw "MSIX version must be four parts ending in .0, got: $($identity.version). Run node windows/tools/sync-version.mjs."
}
if ($identity.identityName -match 'REPLACE|PARTNER-CENTER|TODO') {
  throw 'identityName is still a placeholder. Copy Package/Identity/Name from Partner Center first.'
}
if ($identity.publisher -match 'REPLACE|PARTNER-CENTER|TODO') {
  throw 'publisher is still a placeholder. Copy Package/Identity/Publisher from Partner Center first.'
}

$makeappx = Find-WindowsSdkTool 'makeappx.exe'
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ('nx-msix-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null

try {
  Write-Host "Extracting $SourceMsix"
  [System.IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path -LiteralPath $SourceMsix), $temp)

  $manifestPath = Join-Path $temp 'AppxManifest.xml'
  if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'AppxManifest.xml not found in the package.' }

  [xml]$manifest = Get-Content -LiteralPath $manifestPath -Raw
  $package = $manifest.Package
  $package.Identity.Name = [string]$identity.identityName
  $package.Identity.Publisher = [string]$identity.publisher
  $package.Identity.Version = [string]$identity.version
  $package.Properties.DisplayName = [string]$identity.displayName
  $package.Properties.PublisherDisplayName = [string]$identity.publisherDisplayName

  $app = @($package.Applications.Application)[0]
  if (-not $app) { throw 'The package has no Application element.' }
  $uap10Ns = 'http://schemas.microsoft.com/appx/manifest/uap/windows10/10'
  $hostId = $app.GetAttribute('HostId', $uap10Ns)
  if ($hostId) {
    if ($hostId -ne 'PWA') { throw "Unsupported hosted app HostId: $hostId" }
    $parameters = $app.GetAttribute('Parameters', $uap10Ns)
    if (-not $parameters) { throw 'Hosted package has no uap10:Parameters.' }
    if ($parameters -notmatch '--app-id=[a-p]{32}') { throw 'Hosted package has no valid --app-id.' }
    if ($parameters -notmatch '--app-fallback-url=') { throw 'Hosted package has no --app-fallback-url.' }
    $parameters = [regex]::Replace($parameters, '--app-fallback-url=\S+', "--app-fallback-url=$([string]$identity.startPage)")
    $app.SetAttribute('Parameters', $uap10Ns, $parameters) | Out-Null
    Write-Host "Hosted App Model: HostId=PWA, fallback URL set to $($identity.startPage)"
  }
  elseif ($app.StartPage) {
    $app.StartPage = [string]$identity.startPage
  }
  else {
    throw 'Application has neither uap10:HostId nor StartPage; refusing to guess the launch URL.'
  }

  # Keep tile/splash paths valid relative to the package root.
  foreach ($asset in @(
      'StoreLogo.png',
      'Square44x44Logo.png',
      'Square150x150Logo.png',
      'Wide310x150Logo.png',
      'Square310x310Logo.png',
      'SplashScreen.png')) {
    if (-not (Test-Path -LiteralPath (Join-Path (Join-Path $temp 'Assets') $asset))) {
      Write-Warning "Assets\$asset is missing from the package; run New-MsixAssets.ps1 and rebuild in PWABuilder."
    }
  }

  $manifest.Save($manifestPath)
  Write-Host "Identity applied: $($identity.displayName) · $($identity.identityName) · $($identity.version)"

  # These are regenerated by makeappx; stale copies invalidate the package.
  foreach ($generated in @('AppxSignature.p7x', 'AppxBlockMap.xml')) {
    $path = Join-Path $temp $generated
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
  }

  $outDir = Split-Path -Parent ([System.IO.Path]::GetFullPath($OutputMsix))
  if ($outDir -and -not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
  if (Test-Path -LiteralPath $OutputMsix) { Remove-Item -LiteralPath $OutputMsix -Force }

  Write-Host "Packing $OutputMsix"
  & $makeappx pack /d $temp /p ([System.IO.Path]::GetFullPath($OutputMsix)) /o
  if ($LASTEXITCODE -ne 0) { throw "makeappx pack failed with exit code $LASTEXITCODE" }

  if ($CertificatePath) {
    if (-not (Test-Path -LiteralPath $CertificatePath)) { throw "Certificate not found: $CertificatePath" }
    $signtool = Find-WindowsSdkTool 'signtool.exe'
    $plainPassword = $null
    if ($CertificatePassword) {
      $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($CertificatePassword)
      try { $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
      finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }
    $signArgs = @('sign', '/fd', 'SHA256', '/f', $CertificatePath)
    if ($plainPassword) { $signArgs += @('/p', $plainPassword) }
    $signArgs += @('/tr', $TimestampUrl, '/td', 'SHA256', '/a', $OutputMsix)
    Write-Host 'Signing with signtool'
    & $signtool @signArgs
    if ($LASTEXITCODE -ne 0) { throw "signtool failed with exit code $LASTEXITCODE" }
  }
  elseif ($RequireSignature) {
    throw 'A signature is required but no CertificatePath was provided.'
  }
  else {
    Write-Warning 'Package created WITHOUT a signature. It cannot be installed or submitted until signed with the Partner Center certificate.'
  }

  Write-Host "Done: $OutputMsix"
}
finally {
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue }
}
