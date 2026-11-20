<#
  NEXORA AI - Sign the Windows package with a REAL publisher certificate.
  ---------------------------------------------------------------------
  Two different signatures exist for MSIX, and mixing them breaks submissions:

    * Store submission (.msixupload): Microsoft Store signs the package during
      certification. Upload the UNSIGNED file produced by Build-Msix.ps1.
    * Direct distribution / sideload / enterprise deployment: the package must be
      signed with a code-signing certificate whose Subject equals
      Package/Identity/Publisher, and whose chain is trusted on the target PCs.

  This script performs the second case and produces a signature you can verify:

    1. refuses a certificate whose Subject is not the Partner Center Publisher;
    2. signs the .msixbundle with SHA-256 and an RFC 3161 timestamp;
    3. verifies the signature with signtool /pa (fails on an untrusted chain);
    4. re-wraps the signed bundle into a .msixupload when asked, clearly labelled.

  Requirements: Windows with the Windows SDK (signtool.exe), a .pfx produced by a
  public CA (or the certificate Partner Center issues for your account).

  Example:
    powershell -ExecutionPolicy Bypass -File .\windows\scripts\Sign-StorePackage.ps1 `
      -BundlePath .\dist\windows\NEXORA-AI_4.4.1.0_neutral.msixbundle `
      -CertificatePath .\certs\nexora-store.pfx `
      -CertificatePassword (Read-Host -AsSecureString) `
      -OutputDirectory .\dist\windows\signed
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$BundlePath,
  [Parameter(Mandatory = $true)][string]$CertificatePath,
  [System.Security.SecureString]$CertificatePassword,
  [string]$IdentityFile = (Join-Path $PSScriptRoot '..\package-identity.json'),
  [string]$OutputDirectory,
  [string]$TimestampUrl = 'http://timestamp.digicert.com',
  [switch]$WrapUpload,
  [switch]$AllowUntrustedChain
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Security

function Find-WindowsSdkTool([string]$Name) {
  $cmd = Get-Command $Name -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $roots = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'),
    (Join-Path $env:ProgramFiles 'Windows Kits\10\bin')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  foreach ($root in $roots) {
    $candidate = Get-ChildItem -LiteralPath $root -Filter $Name -Recurse -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match '\\x64\\|\\x86\\|\\arm64\\' } |
      Sort-Object FullName -Descending | Select-Object -First 1
    if ($candidate) { return $candidate.FullName }
  }
  throw "$Name was not found. Install the Windows 10/11 SDK."
}

if (-not (Test-Path -LiteralPath $BundlePath)) { throw "Bundle not found: $BundlePath" }
if (-not (Test-Path -LiteralPath $CertificatePath)) { throw "Certificate not found: $CertificatePath" }
if (-not (Test-Path -LiteralPath $IdentityFile)) { throw "Identity file not found: $IdentityFile" }
$identity = Get-Content -LiteralPath $IdentityFile -Raw | ConvertFrom-Json

if ([System.IO.Path]::GetExtension($BundlePath) -notin @('.msixbundle', '.msix', '.appxbundle', '.appx')) {
  throw "Unsupported package type: $BundlePath"
}

# Never sign a test package with a production intent; never sign a production
# package with an unreviewed identity.
if ([System.IO.Path]::GetFileName($BundlePath) -match 'test-signed') {
  throw 'This is a test-signed artifact. Sign the unsigned bundle from Build-Msix.ps1 instead.'
}
if ($identity.identityName -match 'REPLACE|TODO' -or $identity.publisher -match 'REPLACE|TODO') {
  throw 'Package identity is still a placeholder.'
}

# --- certificate must match Package/Identity/Publisher -----------------------
$password = $null
if ($CertificatePassword) {
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($CertificatePassword)
  try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}
$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(
  (Resolve-Path -LiteralPath $CertificatePath).Path,
  $password,
  [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet)

Write-Host "Certificate: $($cert.Subject)"
Write-Host "Publisher:   $($identity.publisher)"
if ($cert.Subject -ne [string]$identity.publisher) {
  throw "Certificate subject does not match the Partner Center Publisher. Windows will reject this signature."
}
if (-not $cert.HasPrivateKey) { throw 'The .pfx contains no private key; it cannot sign.' }

$chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
$chain.TrustMode = [System.Security.Cryptography.X509Certificates.X509ChainTrustMode]::System
$chainOk = $chain.Build($cert)
if (-not $chainOk) {
  $reason = ($chain.ChainStatus | ForEach-Object { $_.StatusInformation.Trim() }) -join '; '
  if ($AllowUntrustedChain) { Write-Warning "Untrusted chain: $reason (allowed for local testing only)" }
  else { throw "Certificate chain is not trusted: $reason. Use a CA certificate, or the -AllowUntrustedChain switch for local testing only." }
}
else {
  Write-Host 'Certificate chain: trusted' -ForegroundColor Green
}

$signtool = Find-WindowsSdkTool 'signtool.exe'
$outDir = if ($OutputDirectory) { $OutputDirectory } else { Split-Path -Parent ([System.IO.Path]::GetFullPath($BundlePath)) }
if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

$base = [System.IO.Path]::GetFileNameWithoutExtension($BundlePath)
$signedPath = Join-Path $outDir ("$base.signed" + [System.IO.Path]::GetExtension($BundlePath))
Copy-Item -LiteralPath $BundlePath -Destination $signedPath -Force

$signArgs = @('sign', '/fd', 'SHA256', '/f', (Resolve-Path -LiteralPath $CertificatePath).Path)
if ($password) { $signArgs += @('/p', $password) }
$signArgs += @('/tr', $TimestampUrl, '/td', 'SHA256', '/a', $signedPath)
Write-Host 'Signing with signtool...'
& $signtool @signArgs
if ($LASTEXITCODE -ne 0) { throw "signtool sign failed with exit code $LASTEXITCODE" }

& $signtool verify /pa /v $signedPath
if ($LASTEXITCODE -ne 0) {
  if ($AllowUntrustedChain) { Write-Warning 'signtool verify reports an untrusted chain (local testing only).' }
  else { throw "signtool verify failed with exit code $LASTEXITCODE" }
}

$hash = (Get-FileHash -LiteralPath $signedPath -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host ''
Write-Host "Signed:   $signedPath"
Write-Host "SHA-256:  $hash"
Write-Host "Signer:   $($cert.Subject)"
Write-Host "Thumbprint: $($cert.Thumbprint)"

if ($WrapUpload) {
  $uploadPath = Join-Path $outDir ("$base.signed.msixupload")
  $tmpZip = Join-Path ([System.IO.Path]::GetTempPath()) ($base + '.signed.zip')
  if (Test-Path -LiteralPath $tmpZip) { Remove-Item -LiteralPath $tmpZip -Force }
  Compress-Archive -LiteralPath $signedPath -DestinationPath $tmpZip -Force
  Copy-Item -LiteralPath $tmpZip -Destination $uploadPath -Force
  Remove-Item -LiteralPath $tmpZip -Force
  Write-Host "Upload:   $uploadPath (signed bundle inside a .msixupload)"
}

@"
Signature record
================
Package:      $([System.IO.Path]::GetFileName($BundlePath))
Signed file:  $([System.IO.Path]::GetFileName($signedPath))
SHA-256:      $hash
Signer:       $($cert.Subject)
Thumbprint:   $($cert.Thumbprint)
Timestamp:    $TimestampUrl
Identity:     $($identity.identityName)
Version:      $($identity.version)
SignedAtUtc:  $([DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'))

Reminder: for Microsoft Store submission upload the UNSIGNED .msixupload built by
Build-Msix.ps1; Store certification applies the Microsoft signature. Use this
signed artifact for sideloading, enterprise deployment or direct distribution only.
"@ | Set-Content -LiteralPath (Join-Path $outDir 'SIGNATURE-INFO.txt') -Encoding UTF8

exit 0
