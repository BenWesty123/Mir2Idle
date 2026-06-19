param(
  [string]$MonsterJson = "$PSScriptRoot\..\public\monsters\monster\140.json",
  [string]$MonsterSheet = "$PSScriptRoot\..\public\monsters\monster\140.png",
  [string]$OutputRoot = "$PSScriptRoot\..\public\npcs\trainer",
  [string]$Action = "standing"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$atlas = Get-Content -LiteralPath $MonsterJson -Raw | ConvertFrom-Json
$frames = @($atlas.actions.$Action.frames)
if (-not $frames.Count) { throw "No frames for action $Action in $MonsterJson" }

$slotWidth = [int]$atlas.slotWidth
$slotHeight = [int]$atlas.slotHeight
New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null

$monsterBmp = [System.Drawing.Bitmap]::FromFile((Resolve-Path $MonsterSheet))
$sheet = New-Object System.Drawing.Bitmap ($slotWidth * $frames.Count), $slotHeight, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
try {
  $graphics.Clear([System.Drawing.Color]::Transparent)
  foreach ($frame in $frames) {
    $slot = [int]$frame.slot
    $graphics.DrawImage(
      $monsterBmp,
      (New-Object System.Drawing.Rectangle ($slot * $slotWidth), 0, $slotWidth, $slotHeight),
      (New-Object System.Drawing.Rectangle ($slot * $slotWidth), 0, $slotWidth, $slotHeight),
      [System.Drawing.GraphicsUnit]::Pixel
    )
  }
  $sheetPath = Join-Path $OutputRoot "standing.png"
  $sheet.Save($sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
}
finally {
  $graphics.Dispose()
  $sheet.Dispose()
  $monsterBmp.Dispose()
}

$jsonFrames = @($frames | ForEach-Object {
  [ordered]@{
    slot = [int]($_.slot - $frames[0].slot)
    srcFrame = [int]$_.srcFrame
    w = [int]$_.w
    h = [int]$_.h
    offsetX = [int]$_.offsetX
    offsetY = [int]$_.offsetY
    empty = $false
  }
})

$atlasOut = [ordered]@{
  npcId = "trainer"
  source = "Crystal Trainer monster (crystalIndex 7, image 140, map 0110 dummy) standing frames from Monster/140.Lib"
  layers = @([ordered]@{
    sheet = "standing.png"
    interval = [int]$atlas.actions.$Action.interval
    slotWidth = $slotWidth
    slotHeight = $slotHeight
    library = "140"
    baseIndex = 0
    anchor = "player"
    delayMs = 0
    frames = $jsonFrames
  })
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $OutputRoot "atlas.json"), ($atlasOut | ConvertTo-Json -Depth 20), $utf8NoBom)
Write-Output "Exported trainer NPC to $OutputRoot"
