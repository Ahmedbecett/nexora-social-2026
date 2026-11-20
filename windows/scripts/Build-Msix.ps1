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
    6. creates a separate self-signed test copy for local sideload only;
    7. enforces the capability policy: the manifest must declare exactly the
       capabilities in package-identity.json, and runFullTrust must be backed by
       docs/windows/RUNFULLTRUST-REVIEW.md + a Partner Center justification.

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
  [switch]$SkipTestSignature,
  # اختياري: مجلد يحتوي ملفات .appxsym حقيقية (رموز عامة) لتحليل الأعطال في
  # Partner Center. الحزمة hosted PWA بلا كود مُصرَّف، لذلك لا رموز لها أصلًا،
  # وغياب الملف مسموح صراحةً في توثيق Microsoft. لا يُولَّد ملف وهمي أبدًا.
  [string]$SymbolsDirectory
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
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

# --- capability policy --------------------------------------------------------
$capPolicy = $identity.capabilities
if (-not $capPolicy -or -not $capPolicy.required) { throw 'package-identity.json has no capabilities policy.' }
$declaredCaps = @([regex]::Matches($manifestText, '<(?:rescap:)?Capability\s+Name="([^"]+)"') |
  ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
$expectedCaps = @($capPolicy.required | Sort-Object -Unique)
if (($declaredCaps -join ',') -ne ($expectedCaps -join ',')) {
  throw "Capabilities mismatch. Manifest: [$($declaredCaps -join ', ')] / identity: [$($expectedCaps -join ', ')]."
}
if ($declaredCaps -notcontains 'internetClient') { throw 'internetClient is required for the app surface.' }
if ($declaredCaps -contains 'runFullTrust') {
  $justification = $capPolicy.restricted.runFullTrust
  if (-not $justification -or $justification.required -ne $true) {
    throw 'runFullTrust is declared but package-identity.json does not mark it as required with a justification.'
  }
  if (([string]$justification.partnerCenterJustification).Length -lt 120) {
    throw 'The Partner Center justification for runFullTrust is missing or too short.'
  }
  $repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
  $reviewPath = Join-Path $repoRoot ([string]$justification.reviewFile)
  if (-not (Test-Path -LiteralPath $reviewPath)) {
    throw "runFullTrust review file is missing: $($justification.reviewFile)"
  }
  Write-Host "runFullTrust: justified ($($justification.reviewFile), reviewed $($justification.reviewedAt))"
}
foreach ($restrictedCap in @($declaredCaps | Where-Object { $_ -ne 'internetClient' -and $_ -ne 'runFullTrust' })) {
  throw "Unexpected restricted capability: $restrictedCap"
}

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

  # .msixupload is a plain ZIP at whose root sits exactly one .msixbundle plus,
  # optionally, real .appxsym symbol archives (Microsoft: optional, crash analytics
  # only). It is built entry by entry so the archive contains no directory entries,
  # no raw .pdb, no certificate and no nested archive — the mistakes that make
  # Partner Center reject an upload.
  $symbolFiles = @()
  if ($SymbolsDirectory) {
    if (-not (Test-Path -LiteralPath $SymbolsDirectory)) { throw "Symbols directory not found: $SymbolsDirectory" }
    $symbolFiles = @(Get-ChildItem -LiteralPath $SymbolsDirectory -File | Where-Object { $_.Extension -eq '.appxsym' })
    $rawPdb = @(Get-ChildItem -LiteralPath $SymbolsDirectory -File | Where-Object { $_.Extension -eq '.pdb' })
    if ($rawPdb.Count -gt 0) {
      throw "A .msixupload must not contain raw .pdb files ($($rawPdb[0].Name)). Convert public symbols to .appxsym or omit them."
    }
    if ($symbolFiles.Count -eq 0) { Write-Warning "No .appxsym files in $SymbolsDirectory; the upload will contain the bundle only (valid)." }
  }

  Write-Host "Creating $uploadPath"
  $uploadZip = Join-Path $work "$baseName.zip"
  if (Test-Path -LiteralPath $uploadZip) { Remove-Item -LiteralPath $uploadZip -Force }
  $zipStream = [System.IO.File]::Open($uploadZip, [System.IO.FileMode]::Create, [System.IO.FileAccess]::ReadWrite)
  try {
    $archive = [System.IO.Compression.ZipArchive]::new($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    try {
      $payloads = @()
      $payloads += @{ Path = $bundlePath }
      foreach ($symbol in $symbolFiles) { $payloads += @{ Path = $symbol.FullName } }
      foreach ($payload in $payloads) {
        $entry = $archive.CreateEntry([System.IO.Path]::GetFileName($payload.Path), [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        try {
          $sourceStream = [System.IO.File]::OpenRead($payload.Path)
          try { $sourceStream.CopyTo($entryStream) } finally { $sourceStream.Dispose() }
        }
        finally { $entryStream.Dispose() }
      }
    }
    finally { $archive.Dispose() }
  }
  finally { $zipStream.Dispose() }
  Copy-Item -LiteralPath $uploadZip -Destination $uploadPath -Force

  # Post-conditions: exactly one bundle at the root, nothing else unexpected.
  $uploadCheck = [System.IO.Compression.ZipFile]::OpenRead($uploadPath)
  try {
    $uploadNames = @($uploadCheck.Entries | ForEach-Object { $_.FullName })
  }
  finally { $uploadCheck.Dispose() }
  $bundleEntries = @($uploadNames | Where-Object { $_ -match '\.msixbundle$' })
  if ($bundleEntries.Count -ne 1) { throw "The .msixupload must contain exactly one .msixbundle (found $($bundleEntries.Count))." }
  foreach ($forbidden in @($uploadNames | Where-Object { $_ -match '\.(p7x|pdb|cer|pfx|zip|msixupload|appxupload)$' -or $_ -match '[\\/]' })) {
    throw "Forbidden entry in the .msixupload: $forbidden"
  }
  $symbolCount = @($uploadNames | Where-Object { $_ -match '\.appxsym$' }).Count
  Write-Host "Upload entries: $($uploadNames -join ', ') (symbols: $symbolCount)" 

  Write-Host 'Verifying .msixupload content (bundle -> msix -> manifest/blockmap/PRI)'
  $uploadVerify = Join-Path $work 'upload-verify'
  New-Item -ItemType Directory -Path $uploadVerify -Force | Out-Null
  Expand-Archive -LiteralPath $uploadZip -DestinationPath $uploadVerify -Force
  $bundleInUpload = Get-ChildItem -LiteralPath $uploadVerify -Filter '*.msixbundle' | Select-Object -First 1
  if (-not $bundleInUpload) { throw 'The .msixupload does not contain a .msixbundle.' }
  $bundleVerify = Join-Path $work 'bundle-verify'
  $bundleZip = Join-Path $work 'bundle-verify.zip'
  Copy-Item -LiteralPath $bundleInUpload.FullName -Destination $bundleZip -Force
  New-Item -ItemType Directory -Path $bundleVerify -Force | Out-Null
  Expand-Archive -LiteralPath $bundleZip -DestinationPath $bundleVerify -Force
  $bundleManifestPath = Join-Path $bundleVerify 'AppxMetadata\AppxBundleManifest.xml'
  if (-not (Test-Path -LiteralPath $bundleManifestPath)) { throw 'AppxBundleManifest.xml is missing from the bundle.' }
  [xml]$bundleManifest = Get-Content -LiteralPath $bundleManifestPath -Raw
  if ($bundleManifest.Bundle.Identity.Name -ne $identity.identityName) {
    throw "Bundle identity does not match: $($bundleManifest.Bundle.Identity.Name)"
  }
  $msixInBundle = Get-ChildItem -LiteralPath $bundleVerify -Filter '*.msix' | Select-Object -First 1
  if (-not $msixInBundle) { throw 'The .msixbundle does not contain a .msix.' }
  $msixVerify = Join-Path $work 'msix-verify'
  $msixZip = Join-Path $work 'msix-verify.zip'
  Copy-Item -LiteralPath $msixInBundle.FullName -Destination $msixZip -Force
  New-Item -ItemType Directory -Path $msixVerify -Force | Out-Null
  Expand-Archive -LiteralPath $msixZip -DestinationPath $msixVerify -Force
  foreach ($required in @('AppxManifest.xml', 'AppxBlockMap.xml', '[Content_Types].xml', 'resources.pri')) {
    if (-not (Test-Path -LiteralPath (Join-Path $msixVerify $required))) { throw "Missing package file: $required" }
  }
  if (Test-Path -LiteralPath (Join-Path $msixVerify 'AppxSignature.p7x')) {
    throw 'The Store upload must stay unsigned; unexpected AppxSignature.p7x inside the package.'
  }

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
NEXORA AI by BECETTI Windows package
====================================
Display name:       $($identity.displayName)
Identity name:      $($identity.identityName)
Publisher:          $($identity.publisher)
Version:            $($identity.version)
Web App Manifest ID:$manifestId
Web App ID:         $appId
Fallback URL:       $($identity.startPage)
Target family:      Windows.Desktop, MinVersion $($identity.minWindowsVersion)
Host:               Microsoft.MicrosoftEdge.Stable (HostId PWA)
Capabilities:       $($declaredCaps -join ', ')
Built (UTC):        $([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))

Store upload:  $([System.IO.Path]::GetFileName($uploadPath)) (UNSIGNED; Store re-signs it)
Bundle:        $([System.IO.Path]::GetFileName($bundlePath)) (UNSIGNED)
Package:       $([System.IO.Path]::GetFileName($msixPath)) (UNSIGNED)
Test package:  $([System.IO.Path]::GetFileName($testMsixPath)) (self-signed, local sideload only)
Symbols:        $symbolCount .appxsym file(s) (optional; 0 means no crash analytics)
Test cert:     $([System.IO.Path]::GetFileName($testCerPath)) (public certificate, no private key)

Do NOT upload the test-signed package or the test certificate to Partner Center.
"@ | Set-Content -LiteralPath (Join-Path $OutputDirectory 'BUILD-INFO.txt') -Encoding UTF8

  Write-Host ''
  Write-Host 'SHA-256:'
  Get-Content -LiteralPath (Join-Path $OutputDirectory 'SHA256SUMS.txt') | ForEach-Object { Write-Host "  $_" }
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
