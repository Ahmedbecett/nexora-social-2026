<#
  NEXORA AI - Is runFullTrust really required by the Edge PWA host?
  ----------------------------------------------------------------
  Evidence-only experiment, run automatically by the Windows workflow and never
  shipped to the Store:

    1. unpack the already-built, real .msix;
    2. delete the <rescap:Capability Name="runFullTrust" /> declaration;
    3. repack with makeappx and sign with a throw-away certificate whose subject is
       the real Partner Center Publisher;
    4. install it with Add-AppxPackage, read the registered package, check the Start
       entry and attempt to launch the Edge PWA host;
    5. uninstall, delete the certificate and report PASS/FAIL per step.

  Result of this script never blocks the build: the shipping package keeps
  runFullTrust (see docs/windows/RUNFULLTRUST-REVIEW.md), and this run documents
  what would happen without it.

  Example:
    powershell -ExecutionPolicy Bypass -File .\windows\scripts\Test-RunFullTrustNecessity.ps1 `
      -SourceMsix .\dist\windows\NEXORA-AI_4.4.1.0_neutral.msix `
      -OutputDirectory .\dist\runfulltrust-experiment
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$SourceMsix,
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\dist\runfulltrust-experiment'),
  [string]$IdentityFile = (Join-Path $PSScriptRoot '..\package-identity.json')
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
      Where-Object { $_.FullName -match '\\\(x64\|x86\|arm64\)\\' } |
      Sort-Object FullName -Descending | Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
  }
  throw "$Name was not found. Install the Windows 10/11 SDK."
}

if (-not (Test-Path -LiteralPath $SourceMsix)) { throw "Source package not found: $SourceMsix" }
$identity = Get-Content -LiteralPath $IdentityFile -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null

$makeappx = Find-WindowsSdkTool 'makeappx.exe'
$signtool = Find-WindowsSdkTool 'signtool.exe'
$work = Join-Path ([System.IO.Path]::GetTempPath()) ('nx-noft-' + [guid]::NewGuid().ToString('N'))
$layout = Join-Path $work 'layout'
$pfxPath = Join-Path $work 'experiment.pfx'
$experimentalPath = Join-Path $OutputDirectory 'NEXORA-AI_experimental-no-runFullTrust.msix'
$cerPath = Join-Path $OutputDirectory 'experiment-certificate.cer'
$jsonPath = Join-Path $OutputDirectory 'install-test-no-fulltrust.json'
$cert = $null

New-Item -ItemType Directory -Path $layout -Force | Out-Null
try {
  Write-Host "Unpacking $SourceMsix"
  & $makeappx unpack /p (Resolve-Path -LiteralPath $SourceMsix).Path /d $layout /o | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "makeappx unpack failed with exit code $LASTEXITCODE" }

  $manifestPath = Join-Path $layout 'AppxManifest.xml'
  $manifestText = Get-Content -LiteralPath $manifestPath -Raw
  if ($manifestText -notmatch '<rescap:Capability\s+Name="runFullTrust"\s*/>') {
    throw 'The source package does not declare runFullTrust; nothing to remove.'
  }
  # remove the capability together with its explanatory comment block
  $pattern = '(?s)\s*<!--\s*runFullTrust.*?-->\s*<rescap:Capability\s+Name="runFullTrust"\s*/>'
  $without = [regex]::Replace($manifestText, $pattern, '')
  if ($without -eq $manifestText) {
    $without = [regex]::Replace($manifestText, '\s*<rescap:Capability\s+Name="runFullTrust"\s*/>', '')
  }
  if ($without -match 'runFullTrust') {
    # the comment may use another wording; strip any remaining declaration line
    $without = [regex]::Replace($without, '\s*<rescap:Capability\s+Name="runFullTrust"\s*/>', '')
  }
  if ($without -match '<rescap:Capability\s+Name="runFullTrust"') { throw 'Could not remove runFullTrust from the manifest.' }
  Set-Content -LiteralPath $manifestPath -Value $without -Encoding UTF8
  Write-Host 'runFullTrust removed from the experimental manifest'

  Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $OutputDirectory 'AppxManifest.no-runFullTrust.xml') -Force

  Write-Host "Repacking $experimentalPath"
  & $makeappx pack /d $layout /p $experimentalPath /o | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "makeappx pack failed with exit code $LASTEXITCODE" }

  Write-Host 'Creating a throw-away certificate with the real Publisher subject'
  $cert = New-SelfSignedCertificate -Type CodeSigningCert `
    -Subject ([string]$identity.publisher) `
    -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 `
    -KeyExportPolicy Exportable `
    -CertStoreLocation Cert:\CurrentUser\My `
    -NotAfter (Get-Date).AddDays(2)
  $password = [guid]::NewGuid().ToString('N') + 'Aa1!'
  $secure = ConvertTo-SecureString -String $password -AsPlainText -Force
  Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $secure | Out-Null
  Export-Certificate -Cert $cert -FilePath $cerPath -Type CERT | Out-Null

  & $signtool sign /fd SHA256 /f $pfxPath /p $password /tr http://timestamp.digicert.com /td SHA256 $experimentalPath
  if ($LASTEXITCODE -ne 0) { throw "signtool sign failed with exit code $LASTEXITCODE" }

  Write-Host ''
  Write-Host 'Installing and launching the package WITHOUT runFullTrust'
  & (Join-Path $PSScriptRoot 'Test-MsixInstall.ps1') `
    -MsixPath $experimentalPath `
    -IdentityFile $IdentityFile `
    -CertificatePath $cerPath `
    -ExpectedCapabilities 'internetClient' `
    -AllowLaunchFailure `
    -OutputJson $jsonPath
  $installExit = $LASTEXITCODE
  Write-Host "install test exit code: $installExit (1 means at least one check failed)"
}
catch {
  Write-Host "EXPERIMENT ERROR: $($_.Exception.Message)" -ForegroundColor Yellow
}
finally {
  if ($pfxPath -and (Test-Path -LiteralPath $pfxPath)) { Remove-Item -LiteralPath $pfxPath -Force -ErrorAction SilentlyContinue }
  if ($cert) { Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force -ErrorAction SilentlyContinue }
  if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
}

# The experiment is evidence, not a build gate.
exit 0
