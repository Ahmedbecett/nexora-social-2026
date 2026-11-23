<#
  NEXORA AI by BECETTI — Build the native Windows Store MSIX package on Windows.
  ------------------------------------------------------------------------------
  Upgraded from the legacy Hosted App Model to a Native C# (.NET Framework 4.7.2)
  + WebView2 + Official MG Ads C# SDK V1.2.1 Desktop Bridge host (NexoraWindows.exe):

    1. Restores the official MG Ads C# SDK V1.2.1 (SHA-256 verified) if missing;
    2. Optionally generates an ephemeral, gitignored native secret vault from
       $env:MG_ADS_SECRET_KEY (deleted immediately after compilation);
    3. Compiles windows/host/NexoraWindows/NexoraWindows.csproj (Release|x64);
    4. Runs NexoraWindows.exe --smoke-check and saves smoke-check.json;
    5. Stages NexoraWindows.exe, MG Ads & WebView2 binaries, mgads-config.json,
       AppxManifest.xml, and the 53 PNG Store assets;
    6. Generates resources.pri with makepri.exe;
    7. Packs NEXORA-AI_<version>_x64.msix with makeappx.exe and verifies with
       Test-MsixPackage.ps1;
    8. Bundles into .msixbundle and .msixupload (UNSIGNED; Microsoft Store signs);
    9. Creates a self-signed test copy (.test-signed.msix + .cer) for local QA.

  Requirements: Windows 10/11 or Windows Server (windows-latest), .NET SDK 8+,
  Windows 10/11 SDK (makeappx.exe, makepri.exe, signtool.exe), PowerShell 5.1+.
#>
[CmdletBinding()]
param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\dist\windows'),
  [string]$IdentityFile = (Join-Path $PSScriptRoot '..\package-identity.json'),
  [string]$ManifestPath = (Join-Path $PSScriptRoot '..\msix\AppxManifest.reference.xml'),
  [string]$AssetsDirectory = (Join-Path $PSScriptRoot '..\msix\Assets'),
  [string]$HostProjectPath = (Join-Path $PSScriptRoot '..\host\NexoraWindows\NexoraWindows.csproj'),
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

function Assert-TextContains([string]$Text, [string]$Needle, [string]$Message) {
  if (-not $Text.Contains($Needle)) { throw $Message }
}

if (-not (Test-Path -LiteralPath $IdentityFile)) { throw "Identity file not found: $IdentityFile" }
if (-not (Test-Path -LiteralPath $ManifestPath)) { throw "Manifest not found: $ManifestPath" }
if (-not (Test-Path -LiteralPath $AssetsDirectory)) { throw "Assets folder not found: $AssetsDirectory" }
if (-not (Test-Path -LiteralPath $HostProjectPath)) { throw "Native host project not found: $HostProjectPath" }

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
Assert-TextContains $manifestText 'ProcessorArchitecture="x64"' 'Manifest must declare ProcessorArchitecture="x64" for native WebView2 + MG Ads binaries.'
Assert-TextContains $manifestText 'Executable="NexoraWindows.exe"' 'Manifest must target native executable NexoraWindows.exe.'
Assert-TextContains $manifestText 'EntryPoint="Windows.FullTrustApplication"' 'Manifest must declare Desktop Bridge entry point Windows.FullTrustApplication.'

$makeappx = Find-WindowsSdkTool 'makeappx.exe'
$makepri = Find-WindowsSdkTool 'makepri.exe'
$signtool = if ($SkipTestSignature) { $null } else { Find-WindowsSdkTool 'signtool.exe' }

# 1. Restore official MG Ads C# SDK V1.2.1 (SHA-256 verified)
$global:LASTEXITCODE = 0
& (Join-Path $PSScriptRoot 'Restore-MgAdsSdk.ps1')
if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "Restore-MgAdsSdk.ps1 failed with exit code $LASTEXITCODE" }

$work = Join-Path ([System.IO.Path]::GetTempPath()) ('nx-msix-' + [guid]::NewGuid().ToString('N'))
$hostOut = Join-Path $work 'host-out'
$layout = Join-Path $work 'layout'
$verify = Join-Path $work 'verify'
$bundleInput = Join-Path $work 'bundle'
New-Item -ItemType Directory -Path $hostOut, $layout, $verify, $bundleInput, $OutputDirectory -Force | Out-Null

$safeName = 'NEXORA-AI'
$arch = 'x64'
$baseName = "${safeName}_$($identity.version)_${arch}"
$msixPath = Join-Path $OutputDirectory "$baseName.msix"
$bundlePath = Join-Path $OutputDirectory "$baseName.msixbundle"
$uploadPath = Join-Path $OutputDirectory "$baseName.msixupload"
$testMsixPath = Join-Path $OutputDirectory "$baseName.test-signed.msix"
$testCerPath = Join-Path $OutputDirectory 'NEXORA-AI-test-certificate.cer'
$smokeJsonPath = Join-Path $OutputDirectory 'smoke-check.json'

$vaultGeneratedPath = Join-Path (Split-Path -Parent $HostProjectPath) 'Config\NativeSecretVault.g.cs'

try {
  # 2. Generate ephemeral native secret vault ONLY if MG_ADS_SECRET_KEY is supplied in build env
  try {
    $global:LASTEXITCODE = 0
    & (Join-Path $PSScriptRoot 'Write-NativeSecretVault.ps1') -OutputFile $vaultGeneratedPath
    if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "Write-NativeSecretVault.ps1 failed with exit code $LASTEXITCODE" }

    Write-Host "Building native C# + WebView2 + MG Ads host ($($identity.version), x64)"
    $buildOut = & dotnet build $HostProjectPath -c Release -p:Platform=x64 -p:Version=$($identity.version) -o $hostOut 2>&1
    $buildCode = $LASTEXITCODE
    $buildOut | ForEach-Object { Write-Host $_ }
    if ($buildCode -ne 0) {
      ($buildOut | Select-String -Pattern 'error [A-Z]{2}\d+|error MSB|Build FAILED' | Select-Object -First 15) | ForEach-Object { Write-Host "::error::$($_.Line)" }
      throw "dotnet build failed with exit code $buildCode"
    }
  }
  finally {
    if (Test-Path -LiteralPath $vaultGeneratedPath) {
      Remove-Item -LiteralPath $vaultGeneratedPath -Force -ErrorAction SilentlyContinue
      Write-Host 'Removed ephemeral NativeSecretVault.g.cs immediately after build.'
    }
  }

  $hostExe = Join-Path $hostOut 'NexoraWindows.exe'
  if (-not (Test-Path -LiteralPath $hostExe)) { throw "Expected executable missing after build: $hostExe" }

  # 3. Verify compiled native host & MG Ads SDK assembly loading
  Write-Host 'Running native host --smoke-check'
  $smokeProc = Start-Process -FilePath $hostExe -ArgumentList @('--smoke-check', '--smoke-check-out', $smokeJsonPath) -Wait -PassThru -NoNewWindow
  if ($smokeProc.ExitCode -ne 0) { throw "NexoraWindows.exe --smoke-check failed with exit code $($smokeProc.ExitCode)" }
  if (-not (Test-Path -LiteralPath $smokeJsonPath)) { throw "Expected smoke-check report not written: $smokeJsonPath" }
  Get-Content -LiteralPath $smokeJsonPath | ForEach-Object { Write-Host $_ }

  # 4. Stage MSIX package layout
  Write-Host "Staging $($identity.displayName) $($identity.version) ($arch)"
  Copy-Item -Path (Join-Path $hostOut '*') -Destination $layout -Recurse -Force
  # Remove PDB debug symbols from Store package layout
  Get-ChildItem -Path $layout -Filter '*.pdb' -Recurse -File | Remove-Item -Force -ErrorAction SilentlyContinue

  New-Item -ItemType Directory -Path (Join-Path $layout 'Assets') -Force | Out-Null
  Copy-Item -Path (Join-Path $AssetsDirectory '*.png') -Destination (Join-Path $layout 'Assets') -Force
  Copy-Item -LiteralPath $ManifestPath -Destination (Join-Path $layout 'AppxManifest.xml') -Force

  # 5. Generate resources.pri with makepri.exe
  Write-Host 'Generating resources.pri with makepri.exe'
  $priConfig = Join-Path $work 'priconfig.xml'
  Push-Location $layout
  try {
    & $makepri createconfig /cf $priConfig /dq en-US /o /pv 10.0.0
    if ($LASTEXITCODE -ne 0) { throw "makepri createconfig failed with exit code $LASTEXITCODE" }
    $lines = @(Get-Content -LiteralPath $priConfig)
    $filtered = @($lines | Where-Object { $_ -notmatch 'autoResourcePackage\s+qualifier="Scale"' })
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

  # 6. Pack .msix
  Write-Host "Packing $msixPath"
  & $makeappx pack /d $layout /p $msixPath /o /v
  if ($LASTEXITCODE -ne 0) { throw "makeappx pack failed with exit code $LASTEXITCODE" }

  Write-Host 'Verifying the packed package structure'
  & $makeappx unpack /p $msixPath /d $verify /o
  if ($LASTEXITCODE -ne 0) { throw "makeappx unpack failed with exit code $LASTEXITCODE" }
  $global:LASTEXITCODE = 0
  & (Join-Path $PSScriptRoot 'Test-MsixPackage.ps1') -MsixPath $msixPath -IdentityFile $IdentityFile
  if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) { throw "Test-MsixPackage.ps1 failed with exit code $LASTEXITCODE" }

  # 7. Bundle .msixbundle + .msixupload
  Write-Host "Bundling $bundlePath"
  Copy-Item -LiteralPath $msixPath -Destination (Join-Path $bundleInput "$baseName.msix") -Force
  & $makeappx bundle /d $bundleInput /p $bundlePath /bv $identity.version /o /v
  if ($LASTEXITCODE -ne 0) { throw "makeappx bundle failed with exit code $LASTEXITCODE" }

  Write-Host "Creating $uploadPath"
  $uploadZip = Join-Path $work "$baseName.zip"
  Compress-Archive -LiteralPath $bundlePath -DestinationPath $uploadZip -Force
  Copy-Item -LiteralPath $uploadZip -Destination $uploadPath -Force

  # 8. Verify .msixupload contents (unsigned Store candidate)
  Write-Host 'Verifying .msixupload content (bundle -> msix -> manifest/blockmap/PRI/exe/SDK)'
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
  foreach ($required in @('AppxManifest.xml', 'AppxBlockMap.xml', '[Content_Types].xml', 'resources.pri', 'NexoraWindows.exe', 'MiracleGamesAd.dll', 'Config\mgads-config.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $msixVerify $required))) { throw "Missing package file: $required" }
  }
  if (Test-Path -LiteralPath (Join-Path $msixVerify 'AppxSignature.p7x')) {
    throw 'The Store upload must stay unsigned; unexpected AppxSignature.p7x inside the package.'
  }

  # 9. Create self-signed test package for local Windows sideload QA
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

  $files = @($msixPath, $bundlePath, $uploadPath, $smokeJsonPath)
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
NEXORA AI by BECETTI Windows package (Native C# + WebView2 + MG Ads C# SDK V1.2.1)
===================================================================================
Display name:       $($identity.displayName)
Identity name:      $($identity.identityName)
Publisher:          $($identity.publisher)
Version:            $($identity.version)
Architecture:       $arch
Target family:      Windows.Desktop, MinVersion $($identity.minWindowsVersion)
Host executable:    NexoraWindows.exe (Windows.FullTrustApplication + WebView2)
MG Ads SDK:         Miracle Games C# SDK V1.2.1 (AppId 6b03f6af1f812ea86a26de4f)
Built (UTC):        $([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))

Store upload:  $([System.IO.Path]::GetFileName($uploadPath)) (UNSIGNED; Store re-signs it)
Bundle:        $([System.IO.Path]::GetFileName($bundlePath)) (UNSIGNED)
Package:       $([System.IO.Path]::GetFileName($msixPath)) (UNSIGNED)
Test package:  $([System.IO.Path]::GetFileName($testMsixPath)) (self-signed, local sideload only)
Test cert:     $([System.IO.Path]::GetFileName($testCerPath)) (public certificate, no private key)
Smoke check:   smoke-check.json

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

exit 0
