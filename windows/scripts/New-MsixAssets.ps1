<#
  NEXORA AI - Regenerate all MSIX logos, tiles and the splash screen from
  public/icon-1024.png using System.Drawing (no external tools required).

  Usage:
    powershell -ExecutionPolicy Bypass -File .\windows\scripts\New-MsixAssets.ps1
  Optional:
    -Source public\icon-1024.png -OutDir windows\msix\Assets

  The committed PNGs in windows/msix/Assets were produced from the same source.
  Re-run this script only when the official icon changes, then rebuild the
  package in PWABuilder.
#>
[CmdletBinding()]
param(
  [string]$Source = (Join-Path $PSScriptRoot '..\..\public\icon-1024.png'),
  [string]$OutDir = (Join-Path $PSScriptRoot '..\msix\Assets')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if (-not (Test-Path -LiteralPath $Source)) { throw "Icon not found: $Source" }
if (-not (Test-Path -LiteralPath $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

$script:sourceImage = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $Source))
$script:outDir = (Resolve-Path -LiteralPath $OutDir).Path

function Save-Bitmap([System.Drawing.Bitmap]$Bitmap, [string]$Name) {
  $path = Join-Path $script:outDir $Name
  $Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $Bitmap.Dispose()
  Write-Host "  $Name"
}

function New-Square([int]$Size, [string]$Name) {
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($script:sourceImage, 0, 0, $Size, $Size)
  }
  finally { $g.Dispose() }
  Save-Bitmap $bmp $Name
}

function New-Glyph([int]$Size, [string]$Name) {
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $Size, $Size)
    $g.SetClip($path)
    $g.DrawImage($script:sourceImage, 0, 0, $Size, $Size)
    $path.Dispose()
  }
  finally { $g.Dispose() }
  Save-Bitmap $bmp $Name
}

function New-Composite([int]$Width, [int]$Height, [string]$Name) {
  $bmp = New-Object System.Drawing.Bitmap -ArgumentList $Width, $Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $rect = New-Object System.Drawing.Rectangle -ArgumentList 0, 0, $Width, $Height
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $rect, ([System.Drawing.ColorTranslator]::FromHtml('#221452')), ([System.Drawing.ColorTranslator]::FromHtml('#090713')), 45.0
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()

    $glyphSize = [Math]::Min([int]($Height * 0.62), [int]($Width * 0.32))
    $glyph = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glyph.AddEllipse([int]($Width * 0.04), [int](($Height - $glyphSize) / 2), $glyphSize, $glyphSize)
    $state = $g.Save()
    $g.SetClip($glyph)
    $g.DrawImage($script:sourceImage, [int]($Width * 0.04), [int](($Height - $glyphSize) / 2), $glyphSize, $glyphSize)
    $g.Restore($state)
    $glyph.Dispose()

    $titleSize = [Math]::Max(16, [int]($Height * 0.125))
    $subSize = [Math]::Max(10, [int]($Height * 0.071))
    $titleFont = New-Object System.Drawing.Font -ArgumentList 'Segoe UI', $titleSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $subFont = New-Object System.Drawing.Font -ArgumentList 'Segoe UI', $subSize, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $lavender = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#c9b8ff'))
    $right = New-Object System.Drawing.StringFormat
    $right.Alignment = [System.Drawing.StringAlignment]::Far

    $textX = [int]($Width * 0.80)
    $titleRect = New-Object System.Drawing.RectangleF -ArgumentList 0, [float]($Height * 0.36), [float]$textX, [float]($Height * 0.28)
    $subRect = New-Object System.Drawing.RectangleF -ArgumentList 0, [float]($Height * 0.63), [float]$textX, [float]($Height * 0.20)
    $g.DrawString('NEXORA AI', $titleFont, $white, $titleRect, $right)
    $g.DrawString('WINDOWS EDITION', $subFont, $lavender, $subRect, $right)

    $right.Dispose(); $white.Dispose(); $lavender.Dispose(); $titleFont.Dispose(); $subFont.Dispose()
  }
  finally { $g.Dispose() }
  Save-Bitmap $bmp $Name
}

Write-Host "Generating MSIX assets in $script:outDir"

New-Square 50 'StoreLogo.png'
New-Square 44 'Square44x44Logo.png'
New-Square 150 'Square150x150Logo.png'
New-Square 71 'Square71x71Logo.png'
New-Square 310 'Square310x310Logo.png'
New-Square 48 'LockScreenLogo.scale-200.png'

foreach ($pair in @(@(100, 44), @(125, 55), @(150, 66), @(200, 88), @(400, 176))) {
  New-Square $pair[1] "Square44x44Logo.scale-$($pair[0]).png"
}
foreach ($size in @(16, 24, 32, 48, 256)) {
  New-Square $size "Square44x44Logo.targetsize-$size.png"
  New-Glyph $size "Square44x44Logo.altform-unplated_targetsize-$size.png"
  New-Glyph $size "Square44x44Logo.altform-lightunplated_targetsize-$size.png"
}
foreach ($pair in @(@(100, 71), @(125, 89), @(150, 107), @(200, 142), @(400, 284))) {
  New-Square $pair[1] "Square71x71Logo.scale-$($pair[0]).png"
}
foreach ($pair in @(@(100, 150), @(125, 188), @(150, 225), @(200, 300), @(400, 600))) {
  New-Square $pair[1] "Square150x150Logo.scale-$($pair[0]).png"
}
foreach ($pair in @(@(100, 310), @(125, 388), @(150, 465), @(200, 620), @(400, 1240))) {
  New-Square $pair[1] "Square310x310Logo.scale-$($pair[0]).png"
}

New-Composite 310 150 'Wide310x150Logo.png'
foreach ($pair in @(@(100, 310, 150), @(125, 388, 188), @(150, 465, 225), @(200, 620, 300), @(400, 1240, 600))) {
  New-Composite $pair[1] $pair[2] "Wide310x150Logo.scale-$($pair[0]).png"
}

New-Composite 620 300 'SplashScreen.png'
foreach ($pair in @(@(100, 620, 300), @(125, 775, 375), @(150, 930, 450), @(200, 1240, 600), @(400, 2480, 1200))) {
  New-Composite $pair[1] $pair[2] "SplashScreen.scale-$($pair[0]).png"
}

$script:sourceImage.Dispose()
Write-Host 'Done. Rebuild the MSIX in PWABuilder to pick up the new assets.'
