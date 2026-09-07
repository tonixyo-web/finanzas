# Generates PNG icons for the PWA using System.Drawing (no external tools).
Add-Type -AssemblyName System.Drawing

function New-AppIcon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::FromArgb(255, 10, 132, 255))
  $font = New-Object System.Drawing.Font("Segoe UI", [int]($size * 0.6), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center
  $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF 0, ($size * 0.02), $size, $size
  $g.DrawString([string][char]0x20AC, $font, [System.Drawing.Brushes]::White, $rect, $fmt)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

$out = Join-Path $PSScriptRoot "..\icons"
New-Item -ItemType Directory -Force $out | Out-Null
New-AppIcon 192 (Join-Path $out "icon-192.png")
New-AppIcon 512 (Join-Path $out "icon-512.png")
New-AppIcon 180 (Join-Path $out "apple-touch-icon.png")
Write-Output "Iconos generados en $out"
