<#
  NEXORA AI - Build the real Windows Store package on Windows.
  ------------------------------------------------------------
  This is the build that runs in .github/workflows/windows-store-package.yml.
  It does NOT use pwabuilder.com. It builds the Hosted App Model package with
  the Microsoft Windows SDK:

    1. copies the real AppxManifest.reference.xml and the 53 PNG assets;
    2. generates a real resources.pri with makepri.exe;
    3. packs NEXORA-AI_<version>_neutral.msix with makeappx.exe;
    4. bundles it into a .msixbundle (single neutral package);
    5. wraps the bundle in a .msixupload (plain ZIP, Store re-signs it);
    6. creates a separate self-signed test copy for local sideload only.

  The Store upload is intentionally UNSIGNED. Microsoft Store signs it during
  certification. The test certificate is generated in a temp folder, never
  written to the repository, and its password is never printed.

  Requirements: Windows 10/11 or Windows Server, Windows SDK (makeappx.exe,
  makepri.exe, signtool.exe), PowerShell 5.1+.

  Example:
    powershell -ExecutionPolicy Bypass -File .\windows\scripts\Build-Msix.ps1 `
      -OutputDirectory .\dist\windows
#>
[CmdletBinding()]
param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\dist\windows'),
  [string]$IdentityFile = (Join-Path $PSScriptRoot '..\package-identity.json'),
  [string]$ManifestPath = (Join-Path $PSScriptRoot '..\msix\AppxManifest.reference.xml'),
  [string]$AssetsDirectory = (Join-Path $PSScriptRoot '..\msix\Assets'),
  [switch]$SkipTestSignature
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Find-WindowsSdkTool([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $roots = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'),
    (Join-Path $env:ProgramFiles 'Windows Kits\10\bin')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  foreach ($root in $roots) {
    $candidate = Get-ChildItem -LiteralPath $root -Filter $Name -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match '\\x64\\' } |
      Sort-Object FullName -Descending | Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
  }
  throw "$Name was not found. Install the Windows 10/11 SDK."
}

function New-WebAppId([string]$ManifestId) {
  if ($ManifestId -notmatch '^https://') { throw "Manifest ID must be HTTPS: $ManifestId" }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hash = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($ManifestId))
  }
  finally {
    $sha.Dispose()
  }
  $hex = (($hash[0..15] | ForEach-Object { $_.ToString('x2') }) -join '')
  $mapped = foreach ($c in $hex.ToCharArray()) {
    if ([char]::IsDigit($c)) { [char]([int]$c + 49) } else { [char]([int]$c + 10) }
  }
  return (-join $mapped)
}

function Assert-TextContains([string]$Text, [string]$Needle, [string]$Message) {
  if (-not $Text.Contains($Needle)) { throw $Message }
}

if (-not (Test-Path -LiteralPath $IdentityFile)) { throw "Identity file not found: $IdentityFile" }
if (-not (Test-Path -LiteralPath $ManifestPath)) { throw "Manifest not found: $ManifestPath" }
if (-not (Test-Path -LiteralPath $AssetsDirectory)) { throw "Assets folder not found: $AssetsDirectory" }

$identity = Get-Content -LiteralPath $IdentityFile -Raw | ConvertFrom-Json
if ($identity.version -notmatch '^\d{1,5}\.\d{1,5}\.\d{1,5}\.0$') {
  throw "MSIX version must be four parts ending in .0, got: $($identity.version). Run node windows/tools/sync-version.mjs."
}
if ($identity.identityName -match 'REPLACE|PARTNER-CENTER|TODO') { throw 'identityName is still a placeholder.' }
if ($identity.publisher -match 'REPLACE|PARTNER-CENTER|TODO') { throw 'publisher is still a placeholder.' }

$manifestText = Get-Content -LiteralPath $ManifestPath -Raw
Assert-TextContains $manifestText "Version=`"$($identity.version)`"" 'Manifest version does not match package-identity.json.'
Assert-TextContains $manifestText "Name=`"$($identity.identityName)`"" 'Manifest identityName does not match package-identity.json.'
Assert-TextContains $manifestText "Publisher=`"$($identity.publisher)`"" 'Manifest publisher does not match package-identity.json.'
Assert-TextContains $manifestText 'uap10:HostId="PWA"' 'Manifest is not a Hosted App Model package.'
Assert-TextContains $manifestText 'Name="Microsoft.MicrosoftEdge.Stable"' 'Manifest does not declare the Edge stable host.'
Assert-TextContains $manifestText '--windows-store-app' 'Manifest is missing the Store launch flag.'

$appIdMatch = [regex]::Match($manifestText, '--app-id=([a-p]{32})\b')
if (-not $appIdMatch.Success) { throw 'Manifest has no valid --app-id (32 characters a-p).' }
$appId = $appIdMatch.Groups[1].Value

$manifestId = [string]$identity.webAppManifestId
if (-not $manifestId) { throw 'package-identity.json must contain webAppManifestId.' }
$computedAppId = New-WebAppId $manifestId
if ($identity.webAppId -and $identity.webAppId -ne $computedAppId) {
  throw "webAppId in package-identity.json ($($identity.webAppId)) does not match SHA-256 derivation ($computedAppId)."
}
if ($appId -ne $computedAppId) {
  throw "Manifest --app-id ($appId) does not match webAppManifestId derivation ($computedAppId)."
}

$fallbackMatch = [regex]::Match($manifestText, '--app-fallback-url=(\S+)')
if (-not $fallbackMatch.Success) { throw 'Manifest has no --app-fallback-url.' }
if ($fallbackMatch.Groups[1].Value -ne [string]$identity.startPage) {
  throw "Manifest fallback URL ($($fallbackMatch.Groups[1].Value)) does not match package-identity.json ($($identity.startPage))."
}

$makeappx = Find-WindowsSdkTool 'makeappx.exe'
$makepri = Find-WindowsSdkTool 'makepri.exe'
$signtool = if ($SkipTestSignature) { $null } else { Find-WindowsSdkTool 'signtool.exe' }

$work = Join-Path ([System.IO.Path]::GetTempPath()) ('nx-msix-' + [guid]::NewGuid().ToString('N'))
$layout = Join-Path $work 'layout'
$verify = Join-Path $work 'verify'
$bundleInput = Join-Path $work 'bundle'
New-Item -ItemType Directory -Path $layout, $verify, $bundleInput, $OutputDirectory -Force | Out-Null

$safeName = 'NEXORA-AI'
$baseName = "${safeName}_$($identity.version)_neutral"
$msixPath = Join-Path $OutputDirectory "$baseName.msix"
$bundlePath = Join-Path $OutputDirectory "$baseName.msixbundle"
$uploadPath = Join-Path $OutputDirectory "$baseName.msixupload"
$testMsixPath = Join-Path $OutputDirectory "$baseName.test-signed.msix"
$testCerPath = Join-Path $OutputDirectory 'NEXORA-AI-test-certificate.cer'

try {
  Write-Host "Staging $($identity.displayName) $($identity.version)"
  New-Item -ItemType Directory -Path (Join-Path $layout 'Assets') -Force | Out-Null
  Copy-Item -Path (Join-Path $AssetsDirectory '*.png') -Destination (Join-Path $layout 'Assets') -Force
  Copy-Item -LiteralPath $ManifestPath -Destination (Join-Path $layout 'AppxManifest.xml') -Force

  Write-Host 'Generating resources.pri with makepri.exe'
  $priConfig = Join-Path $work 'priconfig.xml'
  Push-Location $layout
  try {
    & $makepri createconfig /cf $priConfig /dq en-US /o /pv 10.0.0
    if ($LASTEXITCODE -ne 0) { throw "makepri createconfig failed with exit code $LASTEXITCODE" }
    $lines = @(Get-Content -LiteralPath $priConfig)
    $filtered = @($lines | Where-Object { $_ -notmatch 'autoResourcePackage\s+qualifier="Scale"' })
    if ($filtered.Count -eq $lines.Count) { Write-Warning 'Scale qualifier was not found in priconfig.xml.' }
    Set-Content -LiteralPath $priConfig -Value $filtered -Encoding UTF8
    & $makepri new /pr $layout /cf $priConfig /v /o
    if ($LASTEXITCODE -ne 0) { throw "makepri new failed with exit code $LASTEXITCODE" }
  }
  finally {
    Pop-Location
  }
  if (-not (Test-Path -LiteralPath (Join-Path $layout 'resources.pri'))) {
    throw 'resources.pri was not generated in the package layout.'
  }

  Write-Host "Packing $msixPath"
  & $makeappx pack /d $layout /p $msixPath /o /v
  if ($LASTEXITCODE -ne 0) { throw "makeappx pack failed with exit code $LASTEXITCODE" }

  Write-Host 'Verifying the packed package structure'
  & $makeappx unpack /p $msixPath /d $verify /o
  if ($LASTEXITCODE -ne 0) { throw "makeappx unpack failed with exit code $LASTEXITCODE" }
  & (Join-Path $PSScriptRoot 'Test-MsixPackage.ps1') -MsixPath $msixPath -IdentityFile $IdentityFile
  if ($LASTEXITCODE -ne 0) { throw "Test-MsixPackage.ps1 failed with exit code $LASTEXITCODE" }

  Write-Host "Bundling $bundlePath"
  Copy-Item -LiteralPath $msixPath -Destination (Join-Path $bundleInput "$baseName.msix") -Force
  & $makeappx bundle /d $bundleInput /p $bundlePath /bv $identity.version /o /v
  if ($LASTEXITCODE -ne 0) { throw "makeappx bundle failed with exit code $LASTEXITCODE" }

  # .msixupload is a plain ZIP containing the bundle; the Store re-signs it.
  Write-Host "Creating $uploadPath"
  $uploadZip = Join-Path $work "$baseName.zip"
  Compress-Archive -LiteralPath $bundlePath -DestinationPath $uploadZip -Force
  Copy-Item -LiteralPath $uploadZip -Destination $uploadPath -Force

  if (-not $SkipTestSignature) {
    Write-Host 'Creating a self-signed test certificate and test-signed copy (local sideload only)'
    $cert = New-SelfSignedCertificate -Type CodeSigningCert `
      -Subject ([string]$identity.publisher) `
      -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 `
      -KeyExportPolicy Exportable `
      -CertStoreLocation Cert:\CurrentUser\My `
      -NotAfter (Get-Date).AddYears(1)
    $password = [guid]::NewGuid().ToString('N') + 'Aa1!'
    $securePassword = ConvertTo-SecureString -String $password -AsPlainText -Force
    $pfxPath = Join-Path $work 'test.pfx'
    try {
      Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null
      Export-Certificate -Cert $cert -FilePath $testCerPath -Type CERT | Out-Null
      Copy-Item -LiteralPath $msixPath -Destination $testMsixPath -Force
      & $signtool sign /fd SHA256 /f $pfxPath /p $password /tr http://timestamp.digicert.com /td SHA256 $testMsixPath
      if ($LASTEXITCODE -ne 0) { throw "signtool sign failed with exit code $LASTEXITCODE" }
      Import-Certificate -FilePath $testCerPath -CertStoreLocation Cert:\CurrentUser\TrustedPeople | Out-Null
      & $signtool verify /pa /v $testMsixPath
      if ($LASTEXITCODE -ne 0) { Write-Warning 'signtool verify reported an untrusted test chain; the Store upload is unsigned anyway.' }
    }
    finally {
      if (Test-Path -LiteralPath $pfxPath) { Remove-Item -LiteralPath $pfxPath -Force -ErrorAction SilentlyContinue }
      Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force -ErrorAction SilentlyContinue
    }
  }

  $files = @($msixPath, $bundlePath, $uploadPath)
  if (Test-Path -LiteralPath $testMsixPath) { $files += $testMsixPath }
  if (Test-Path -LiteralPath $testCerPath) { $files += $testCerPath }
  $hashLines = foreach ($file in $files) {
    if (Test-Path -LiteralPath $file) {
      $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
      "$hash  $([System.IO.Path]::GetFileName($file))"
    }
  }
  $hashLines | Set-Content -LiteralPath (Join-Path $OutputDirectory 'SHA256SUMS.txt') -Encoding ASCII

  @"
NEXORA AI Windows package
=========================
Display name:       $($identity.displayName)
Identity name:      $($identity.identityName)
Publisher:          $($identity.publisher)
Version:            $($identity.version)
Web App Manifest ID:$manifestId
Web App ID:         $appId
Fallback URL:       $($identity.startPage)
Target family:      Windows.Desktop, MinVersion $($identity.minWindowsVersion)
Host:               Microsoft.MicrosoftEdge.Stable (HostId PWA)
Built (UTC):        $([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))

Store upload:  $([System.IO.Path]::GetFileName($uploadPath)) (UNSIGNED; Store re-signs it)
Bundle:        $([System.IO.Path]::GetFileName($bundlePath)) (UNSIGNED)
Package:       $([System.IO.Path]::GetFileName($msixPath)) (UNSIGNED)
Test package:  $([System.IO.Path]::GetFileName($testMsixPath)) (self-signed, local sideload only)
Test cert:     $([System.IO.Path]::GetFileName($testCerPath)) (public certificate, no private key)

Do NOT upload the test-signed package or the test certificate to Partner Center.
"@ | Set-Content -LiteralPath (Join-Path $OutputDirectory 'BUILD-INFO.txt') -Encoding UTF8

  Write-Host ''
  Write-Host 'Build complete:'
  foreach ($file in $files) { if (Test-Path -LiteralPath $file) { Write-Host "  $file" } }
}
finally {
  if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
}

# signtool verify returns 1 for a self-signed chain by design. That warning is
# not a build failure; the package for Partner Center is the unsigned upload.
exit 0
