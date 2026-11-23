<#
  NEXORA AI by BECETTI — Restore official MG Ads C# SDK V1.2.1
  ------------------------------------------------------------
  Downloads the official Miracle Games Win32/C# Ads SDK V1.2.1 archive from
  MiracleGames/sdk on GitHub, verifies its pinned SHA-256 checksum, and
  extracts the DLLs into windows/host/vendor/mgads-sdk (gitignored).
#>
[CmdletBinding()]
param(
  [string]$Destination = (Join-Path $PSScriptRoot '..\host\vendor\mgads-sdk'),
  [string]$SdkUrl = 'https://github.com/MiracleGames/sdk/raw/main/win32/1.2.1/C++SDK1.2.1.zip',
  [string]$ExpectedSha256 = 'dc04de9bec8e67aa5ebb424c8219a425c65fe5bdfd0df446c128e58ff1ba1e49',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$requiredFiles = @(
  'MiracleGamesAd.dll',
  'Microsoft.Web.WebView2.Core.dll',
  'Microsoft.Web.WebView2.WinForms.dll',
  'AxInterop.WMPLib.dll',
  'Interop.WMPLib.dll',
  'x64\MgAdSDKCSharpDLL.dll',
  'runtimes\win-x64\native\WebView2Loader.dll'
)

function Test-SdkComplete([string]$Dir) {
  foreach ($rel in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $Dir $rel))) { return $false }
  }
  return $true
}

if (-not $Force -and (Test-SdkComplete $Destination)) {
  Write-Host "MG Ads C# SDK V1.2.1 already restored at: $Destination"
  exit 0
}

$work = Join-Path ([System.IO.Path]::GetTempPath()) ('nx-mgsdk-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $work -Force | Out-Null
$zipPath = Join-Path $work 'mgads-sdk-1.2.1.zip'

try {
  Write-Host "Downloading official MG Ads C# SDK V1.2.1 from $SdkUrl"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $SdkUrl -OutFile $zipPath -UseBasicParsing

  $actualSha = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualSha -ne $ExpectedSha256.ToLowerInvariant()) {
    throw "MG Ads SDK SHA-256 mismatch! Expected $ExpectedSha256, got $actualSha"
  }
  Write-Host "Verified MG Ads C# SDK V1.2.1 SHA-256: $actualSha"

  if (Test-Path -LiteralPath $Destination) {
    Remove-Item -LiteralPath $Destination -Recurse -Force
  }
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $Destination)

  if (-not (Test-SdkComplete $Destination)) {
    throw "Extracted MG Ads SDK is missing one or more required binaries in $Destination"
  }

  Write-Host "MG Ads C# SDK V1.2.1 restored cleanly to: $Destination"
}
finally {
  if (Test-Path -LiteralPath $work) {
    Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
  }
}
