Add-Type -AssemblyName System.Drawing
$stripPath = Join-Path $PSScriptRoot "../public/mapedges/red-cavern-wall-columns.png"
$userPath = "C:/Users/bb-we/.cursor/projects/c-Users-bb-we-Documents-LOM-Idle-Backup-lom-idle-v2-Cursor/assets/c__Users_bb-we_AppData_Roaming_Cursor_User_workspaceStorage_af339dc4e50f98291f1985f76babea91_images_image-cfde48cf-9cd0-4eb3-8818-0c071d1b15b7.png"
$strip = [Drawing.Bitmap]::FromFile($stripPath)
$user = [Drawing.Bitmap]::FromFile($userPath)
Write-Host "Strip: $($strip.Width)x$($strip.Height)"
Write-Host "User screenshot: $($user.Width)x$($user.Height)"
$cropY = 20
foreach ($mapY in @(23, 24)) {
  $stripY0 = ($mapY - $cropY) * 32
  Write-Host "map y=$mapY -> strip rows $stripY0..$($stripY0+31)"
  foreach ($col in 5..8) {
    $c = $strip.GetPixel($col * 48 + 24, $stripY0 + 16)
    Write-Host ("  col {0} mapX {1}: R{2} G{3} B{4}" -f $col, (21+$col), $c.R, $c.G, $c.B)
  }
}
# Compare user screenshot center colors
Write-Host "--- user screenshot samples ---"
for ($y = 0; $y -lt $user.Height; $y += [Math]::Max(1, [Math]::Floor($user.Height/4))) {
  $c = $user.GetPixel([Math]::Floor($user.Width/2), $y)
  Write-Host ("user mid x y={0}: R{1} G{2} B{3} A{4}" -f $y, $c.R, $c.G, $c.B, $c.A)
}
$strip.Dispose(); $user.Dispose()
