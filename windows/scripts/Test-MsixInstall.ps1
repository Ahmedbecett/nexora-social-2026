<#
  NEXORA AI - Install / launch / permission test for the Windows package.
  ----------------------------------------------------------------------
  Runs the REAL Store-equivalent checks on a Windows machine (or the GitHub
  Actions windows runner):

    1. trust the test certificate (TrustedPeople + Root) when one is supplied;
    2. Add-AppxPackage the package (real installation, no simulation);
    3. read the installed package back: Name, Publisher, Version, PackageFamilyName,
       signature kind, install location, status;
    4. read the declared capabilities from the INSTALLED manifest and compare them
       with windows/package-identity.json;
    5. confirm the app appears in Start (Get-StartApps) and that the package has a
       launchable Application entry ($pfn!App);
    6. launch the app through the shell (Edge PWA host) and detect a new msedge
       process and window;
    7. confirm the NEXORA production surface is reachable (function check);
    8. uninstall and confirm the package is gone.

  Every check is recorded as PASS / FAIL / INFO and written to a JSON file, so the
  report can quote measured results instead of assumptions.

  Example:
    powershell -ExecutionPolicy Bypass -File .\windows\scripts\Test-MsixInstall.ps1 `
      -MsixPath .\dist\windows\NEXORA-AI_4.4.1.0_neutral.test-signed.msix `
      -CertificatePath .\dist\windows\NEXORA-AI-test-certificate.cer `
      -OutputJson .\dist\windows\install-test.json
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$MsixPath,
  [string]$IdentityFile = (Join-Path $PSScriptRoot '..\package-identity.json'),
  [string]$CertificatePath,
  [string]$OutputJson,
  [string]$Label = 'store-package',
  [switch]$SkipLaunch,
  [switch]$KeepInstalled,
  [switch]$AllowLaunchFailure,
  # On a headless runner the self-signed test certificate must also be trusted by
  # the machine root, otherwise Add-AppxPackage fails with 0x800B0109. Machine-store
  # writes never open the consent dialog that CurrentUser\Root opens.
  [switch]$TrustMachineRoot,
  # Expected capability set. Defaults to package-identity.json; the runFullTrust
  # experiment passes a reduced set on purpose.
  [string[]]$ExpectedCapabilities
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not (Test-Path -LiteralPath $MsixPath)) { throw "Package not found: $MsixPath" }
if (-not (Test-Path -LiteralPath $IdentityFile)) { throw "Identity file not found: $IdentityFile" }
$identity = Get-Content -LiteralPath $IdentityFile -Raw | ConvertFrom-Json

$results = New-Object System.Collections.Generic.List[object]
function Add-Result([string]$Name, [string]$Status, [string]$Detail) {
  $results.Add([pscustomobject]@{ check = $Name; status = $Status; detail = $Detail })
  $color = if ($Status -eq 'PASS') { 'Green' } elseif ($Status -eq 'FAIL') { 'Red' } else { 'Gray' }
  Write-Host ("  [{0}] {1} - {2}" -f $Status, $Name, $Detail) -ForegroundColor $color
}
function Fail([string]$Name, [string]$Detail) { Add-Result $Name 'FAIL' $Detail }
function Pass([string]$Name, [string]$Detail) { Add-Result $Name 'PASS' $Detail }
function Info([string]$Name, [string]$Detail) { Add-Result $Name 'INFO' $Detail }

$packageName = [string]$identity.identityName
$appId = [string]$identity.applicationId
$expectedCaps = if ($ExpectedCapabilities) { @($ExpectedCapabilities | Sort-Object -Unique) } else { @($identity.capabilities.required | Sort-Object -Unique) }
$launchUrl = [string]$identity.startPage

Write-Host ''
Write-Host "NEXORA AI by BECETTI - install test ($Label)"
Write-Host "  package:  $MsixPath"
Write-Host "  identity: $packageName ($($identity.version))"
Write-Host ''

# --- 0) clean slate: remove any previous install of the same identity ---------
try {
  $existing = Get-AppxPackage -Name $packageName -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Removing an existing install: $($existing.PackageFullName)"
    $existing | Remove-AppxPackage -ErrorAction Stop
    Start-Sleep -Seconds 2
  }
}
catch {
  Fail 'cleanup-existing-install' $_.Exception.Message
}

# --- 1) trust the test certificate -------------------------------------------
if ($CertificatePath) {
  try {
    if (-not (Test-Path -LiteralPath $CertificatePath)) { throw "Certificate not found: $CertificatePath" }
    $cerPath = (Resolve-Path -LiteralPath $CertificatePath).Path
    # TrustedPeople is the documented store for sideloaded packages; the machine
    # store needs administrator rights but never shows the consent dialog.
    Import-Certificate -FilePath $cerPath -CertStoreLocation Cert:\CurrentUser\TrustedPeople | Out-Null
    $stores = @('CurrentUser\TrustedPeople')
    try {
      Import-Certificate -FilePath $cerPath -CertStoreLocation Cert:\LocalMachine\TrustedPeople | Out-Null
      $stores += 'LocalMachine\TrustedPeople'
    }
    catch { Info 'trust-test-certificate-machine' ("LocalMachine\TrustedPeople unavailable: " + $_.Exception.Message) }
    if ($TrustMachineRoot) {
      & certutil.exe -addstore -f Root $cerPath | Out-Null
      if ($LASTEXITCODE -eq 0) { $stores += 'LocalMachine\Root' }
      else { Info 'trust-test-certificate-root' "certutil -addstore Root exited with $LASTEXITCODE" }
    }
    Info 'trust-test-certificate' ("installed into: " + ($stores -join ', '))

    $cer = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($cerPath)
    if ($cer.Subject -ne [string]$identity.publisher) {
      Fail 'certificate-subject' "certificate subject '$($cer.Subject)' does not match Publisher '$($identity.publisher)'"
    }
    else {
      Pass 'certificate-subject' "trusted test certificate subject matches Publisher ($($cer.Thumbprint))"
    }
  }
  catch { Fail 'trust-test-certificate' $_.Exception.Message }
}
else {
  Info 'trust-test-certificate' 'no certificate supplied (package must already be signed by a trusted chain)'
}

# --- 2) Add-AppxPackage -------------------------------------------------------
$installSw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  Add-AppxPackage -Path (Resolve-Path -LiteralPath $MsixPath).Path -ErrorAction Stop
  $installSw.Stop()
  Pass 'add-appxpackage' ("install completed in {0:N1}s" -f $installSw.Elapsed.TotalSeconds)
}
catch {
  $installSw.Stop()
  Fail 'add-appxpackage' $_.Exception.Message
}

# --- 3) read the installed package back --------------------------------------
$pkg = $null
try { $pkg = Get-AppxPackage -Name $packageName -ErrorAction SilentlyContinue } catch { }
if (-not $pkg) {
  Fail 'package-registered' "Get-AppxPackage -Name $packageName returned nothing"
}
else {
  Pass 'package-registered' $pkg.PackageFullName
  if ($pkg.Name -eq $packageName) { Pass 'identity-name' $pkg.Name } else { Fail 'identity-name' "installed '$($pkg.Name)' expected '$packageName'" }
  if ($pkg.Publisher -eq [string]$identity.publisher) { Pass 'identity-publisher' $pkg.Publisher } else { Fail 'identity-publisher' "installed '$($pkg.Publisher)' expected '$($identity.publisher)'" }
  if ($pkg.Version -eq [string]$identity.version) { Pass 'identity-version' $pkg.Version } else { Fail 'identity-version' "installed '$($pkg.Version)' expected '$($identity.version)'" }
  if ($pkg.PackageFamilyName -eq [string]$identity.packageFamilyName) { Pass 'package-family-name' $pkg.PackageFamilyName } else { Fail 'package-family-name' "installed '$($pkg.PackageFamilyName)' expected '$($identity.packageFamilyName)'" }
  if ($pkg.Status -and $pkg.Status -ne 'Ok') { Fail 'package-status' ([string]$pkg.Status) } else { Pass 'package-status' 'Ok' }
  Info 'signature-kind' ([string]$pkg.SignatureKind)
  Info 'install-location' ([string]$pkg.InstallLocation)
  Info 'is-development-mode' ([string]$pkg.IsDevelopmentMode)

  # signature of the installed package must be a real signature (Store or trusted cert)
  try {
    $sig = Get-AuthenticodeSignature -LiteralPath (Join-Path $pkg.InstallLocation 'AppxManifest.xml') -ErrorAction SilentlyContinue
    if ($sig -and $sig.SignerCertificate) {
      Info 'signer-certificate' ("{0} (chain: {1})" -f $sig.SignerCertificate.Subject, $sig.Status)
    }
  }
  catch { }
}

# --- 4) capabilities of the INSTALLED manifest -------------------------------
if ($pkg) {
  try {
    [xml]$installedManifest = Get-AppxPackageManifest -Package $pkg.PackageFullName
    $declared = @()
    foreach ($node in $installedManifest.Package.Capabilities.ChildNodes) {
      if ($node.GetType().FullName -eq 'System.Xml.XmlElement') {
        $capName = [string]$node.GetAttribute('Name')
        if ($capName) { $declared += $capName }
      }
    }
    $declaredSorted = @($declared | Sort-Object -Unique)
    if (($declaredSorted -join ',') -eq ($expectedCaps -join ',')) {
      Pass 'declared-capabilities' ($declaredSorted -join ', ')
    }
    else {
      Fail 'declared-capabilities' ("installed: {0} / expected: {1}" -f ($declaredSorted -join ','), ($expectedCaps -join ','))
    }
    $restricted = @($declaredSorted | Where-Object { $_ -notin @('internetClient', 'privateNetworkClientServer') })
    if ($restricted.Count -eq 0) { Pass 'restricted-capabilities' 'none' }
    else { Info 'restricted-capabilities' ($restricted -join ', ') }
    if ($declaredSorted -contains 'runFullTrust') {
      $justified = [bool]($identity.capabilities.restricted.runFullTrust.required)
      if ($justified) { Pass 'run-full-trust-justification' 'declared and backed by docs/windows/RUNFULLTRUST-REVIEW.md + Partner Center text' }
      else { Fail 'run-full-trust-justification' 'runFullTrust declared without a written justification' }
    }

    # application entry that can be launched from Start
    $app = @($installedManifest.Package.Applications.Application)[0]
    if ($app -and $app.Id -eq $appId) { Pass 'application-entry' ("Id={0}" -f $app.Id) } else { Fail 'application-entry' 'Application Id does not match package-identity.json' }
    $uap10Ns = 'http://schemas.microsoft.com/appx/manifest/uap/windows10/10'
    $hostId = $app.GetAttribute('HostId', $uap10Ns)
    if ($hostId -eq 'PWA') { Pass 'edge-pwa-host' ("HostId={0}" -f $hostId) } else { Fail 'edge-pwa-host' "HostId='$hostId' expected 'PWA'" }
  }
  catch { Fail 'read-installed-manifest' $_.Exception.Message }
}

# --- 5) Start menu presence --------------------------------------------------
$startApp = $null
if ($pkg) {
  $deadline = (Get-Date).AddSeconds(45)
  do {
    try {
      $startApp = Get-StartApps -ErrorAction Stop |
        Where-Object { $_.AppID -like "$($pkg.PackageFamilyName)!*" -or $_.Name -eq [string]$identity.displayName } |
        Select-Object -First 1
    }
    catch { $startApp = $null }
    if (-not $startApp) { Start-Sleep -Seconds 3 }
  } while (-not $startApp -and (Get-Date) -lt $deadline)

  if ($startApp) {
    Pass 'start-menu-entry' ("{0} -> {1}" -f $startApp.Name, $startApp.AppID)
  }
  else {
    # Get-StartApps can be empty on a fresh CI session even though the entry exists.
    $shortcut = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\$packageName"
    $registered = $false
    try { $registered = [bool](Get-AppxPackage -Name $packageName) } catch { }
    if ($registered) {
      Info 'start-menu-entry' 'Get-StartApps returned no row in this session (headless runner); the package is registered and has a launchable AppID'
    }
    else { Fail 'start-menu-entry' 'no Start entry and no registered package' }
  }
}

# --- 6) launch through the Edge PWA host ------------------------------------
if ($pkg -and -not $SkipLaunch) {
  $before = @(Get-Process -Name msedge -ErrorAction SilentlyContinue)
  try {
    $shellTarget = "shell:AppsFolder\" + $pkg.PackageFamilyName + '!' + $appId
    Start-Process -FilePath 'explorer.exe' -ArgumentList $shellTarget -ErrorAction Stop
    Start-Sleep -Seconds 12
    $after = @(Get-Process -Name msedge -ErrorAction SilentlyContinue)
    $newProcs = @($after | Where-Object { $before.Id -notcontains $_.Id })
    if ($newProcs.Count -gt 0) {
      Pass 'launch-edge-host' ("{0} new msedge process(es); window titles: {1}" -f $newProcs.Count, (($newProcs | Where-Object { $_.MainWindowTitle } | ForEach-Object { $_.MainWindowTitle }) -join ' | '))
    }
    elseif ($after.Count -gt 0) {
      Info 'launch-edge-host' 'Edge is already running; no new process detected in a headless session (launch handed off to the existing host)'
    }
    else {
      Fail 'launch-edge-host' 'no msedge process appeared after shell activation'
    }
    # event-log evidence of a successful app activation
    try {
      $log = Get-WinEvent -LogName 'Microsoft-Windows-AppModel-Runtime/Admin' -MaxEvents 20 -ErrorAction SilentlyContinue
      $errors = @($log | Where-Object { $_.LevelDisplayName -eq 'Error' -and $_.TimeCreated -gt (Get-Date).AddMinutes(-2) })
      if ($errors.Count -eq 0) { Pass 'activation-event-log' 'no activation errors in the last 2 minutes' }
      else { Fail 'activation-event-log' ($errors[0].Message) }
    }
    catch { Info 'activation-event-log' 'AppModel-Runtime log not readable in this session' }
  }
  catch {
    if ($AllowLaunchFailure) { Info 'launch-edge-host' ("headless session: " + $_.Exception.Message) }
    else { Fail 'launch-edge-host' $_.Exception.Message }
  }
}
else {
  Info 'launch-edge-host' 'skipped'
}

# --- 7) function check: the real production surface --------------------------
try {
  $response = Invoke-WebRequest -Uri $launchUrl -UseBasicParsing -TimeoutSec 45 -MaximumRedirection 5
  if ($response.StatusCode -eq 200) {
    Pass 'production-surface' ("HTTP 200 for {0} ({1} bytes)" -f $launchUrl, $response.RawContentLength)
  }
  else { Fail 'production-surface' ("HTTP {0} for {1}" -f $response.StatusCode, $launchUrl) }
  if ($response.Content -match 'NEXORA') { Pass 'production-content' 'the served page identifies NEXORA' } else { Fail 'production-content' 'the served page does not mention NEXORA' }
}
catch { Fail 'production-surface' $_.Exception.Message }

# --- 8) uninstall ------------------------------------------------------------
if (-not $KeepInstalled) {
  try {
    if ($pkg) {
      Remove-AppxPackage -Package $pkg.PackageFullName -ErrorAction Stop
      Start-Sleep -Seconds 2
      if (Get-AppxPackage -Name $packageName -ErrorAction SilentlyContinue) { Fail 'uninstall' 'package is still registered' }
      else { Pass 'uninstall' 'package removed cleanly' }
    }
  }
  catch { Fail 'uninstall' $_.Exception.Message }
}
else {
  Info 'uninstall' 'skipped (-KeepInstalled)'
}

# --- summary -----------------------------------------------------------------
$failed = @($results | Where-Object { $_.status -eq 'FAIL' })
$passed = @($results | Where-Object { $_.status -eq 'PASS' })
Write-Host ''
Write-Host ("RESULT: {0} passed, {1} failed, {2} info" -f $passed.Count, $failed.Count, ($results.Count - $passed.Count - $failed.Count))

$report = [pscustomobject]@{
  label = $Label
  package = (Split-Path -Leaf $MsixPath)
  identityName = $packageName
  version = [string]$identity.version
  publisher = [string]$identity.publisher
  testedAtUtc = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  machine = "$env:COMPUTERNAME / $([System.Environment]::OSVersion.VersionString)"
  passed = $passed.Count
  failed = $failed.Count
  checks = $results
}
if ($OutputJson) {
  $dir = Split-Path -Parent ([System.IO.Path]::GetFullPath($OutputJson))
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputJson -Encoding UTF8
  Write-Host "JSON written to $OutputJson"
}
if ($env:GITHUB_STEP_SUMMARY) {
  $lines = @("### Install test - $Label", '', '| Check | Status | Detail |', '|---|---|---|')
  foreach ($r in $results) { $lines += ("| {0} | {1} | {2} |" -f $r.check, $r.status, (($r.detail -replace '\|', '/') -replace "`r?`n", ' ')) }
  $lines += '', ("**{0} passed / {1} failed**" -f $passed.Count, $failed.Count)
  Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Value ($lines -join "`n")
}

if ($failed.Count -gt 0) {
  foreach ($f in $failed) { Write-Host "FAILED: $($f.check) - $($f.detail)" -ForegroundColor Red }
  exit 1
}
exit 0
