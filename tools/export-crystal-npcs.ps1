param(
  [string]$DatabasePath = "C:/Users/bb-we/Documents/Crystal-master/Build/Server/Release/Server.MirDB",
  [string]$OutputPath = "../src/data/crystal-npcs.json"
)

$statNames = @{
  0 = "MinAC"; 1 = "MaxAC"; 2 = "MinAMC"; 3 = "MaxAMC"; 4 = "MinDC"; 5 = "MaxDC"; 6 = "MinMC"; 7 = "MaxMC";
  8 = "MinSC"; 9 = "MaxSC"; 10 = "Accuracy"; 11 = "Agility"; 12 = "HP"; 13 = "MP"; 14 = "AttackSpeed"; 15 = "Luck";
  16 = "BagWeight"; 17 = "HandWeight"; 18 = "WearWeight"; 19 = "Reflect"; 20 = "Strong"; 21 = "Holy"; 22 = "Freezing";
  23 = "PoisonAttack"; 30 = "MagicResist"; 31 = "PoisonResist"; 32 = "HealthRecovery"; 33 = "SpellRecovery";
  34 = "PoisonRecovery"; 35 = "CriticalRate"; 36 = "CriticalDamage"; 40 = "MaxACRatePercent"; 41 = "MaxAMCRatePercent";
  42 = "MaxDCRatePercent"; 43 = "MaxMCRatePercent"; 44 = "MaxSCRatePercent"; 45 = "AttackSpeedRatePercent";
  46 = "HPRatePercent"; 47 = "MPRatePercent"; 48 = "HPDrainRatePercent"; 100 = "ExpRatePercent";
  101 = "ItemDropRatePercent"; 102 = "GoldDropRatePercent"; 103 = "MineRatePercent"; 104 = "GemRatePercent";
  105 = "FishRatePercent"; 106 = "CraftRatePercent"; 107 = "SkillGainMultiplier"; 108 = "AttackBonus";
  120 = "LoverExpRatePercent"; 121 = "MentorDamageRatePercent"; 123 = "MentorExpRatePercent";
  124 = "DamageReductionPercent"; 125 = "EnergyShieldPercent"; 126 = "EnergyShieldHPGain"; 127 = "ManaPenaltyPercent";
  128 = "TeleportManaPenaltyPercent"; 129 = "Hero";
}

function Skip-SafeZone($reader) {
  $reader.ReadInt32() | Out-Null
  $reader.ReadInt32() | Out-Null
  $reader.ReadUInt16() | Out-Null
  $reader.ReadBoolean() | Out-Null
}

function Skip-Respawn($reader, $version) {
  $reader.ReadInt32() | Out-Null
  $reader.ReadInt32() | Out-Null
  $reader.ReadInt32() | Out-Null
  $reader.ReadUInt16() | Out-Null
  $reader.ReadUInt16() | Out-Null
  $reader.ReadUInt16() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadString() | Out-Null
  if ($version -gt 67) {
    $reader.ReadUInt16() | Out-Null
    $reader.ReadInt32() | Out-Null
    $reader.ReadBoolean() | Out-Null
    $reader.ReadUInt16() | Out-Null
  }
}

function Skip-Movement($reader, $version) {
  foreach ($n in 1..5) { $reader.ReadInt32() | Out-Null }
  $reader.ReadBoolean() | Out-Null
  $reader.ReadBoolean() | Out-Null
  if ($version -ge 69) { $reader.ReadInt32() | Out-Null }
  if ($version -ge 95) {
    $reader.ReadBoolean() | Out-Null
    $reader.ReadInt32() | Out-Null
  }
}

function Skip-MineZone($reader) {
  $reader.ReadInt32() | Out-Null
  $reader.ReadInt32() | Out-Null
  $reader.ReadUInt16() | Out-Null
  $reader.ReadByte() | Out-Null
}

function Skip-MapInfo($reader, $version) {
  $reader.ReadInt32() | Out-Null
  $reader.ReadString() | Out-Null
  $reader.ReadString() | Out-Null
  $reader.ReadUInt16() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadUInt16() | Out-Null

  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) { Skip-SafeZone $reader }
  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) { Skip-Respawn $reader $version }
  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) { Skip-Movement $reader $version }

  $reader.ReadBoolean() | Out-Null
  $reader.ReadBoolean() | Out-Null
  $reader.ReadString() | Out-Null
  foreach ($n in 1..11) { $reader.ReadBoolean() | Out-Null }
  $reader.ReadInt32() | Out-Null
  $reader.ReadBoolean() | Out-Null
  $reader.ReadInt32() | Out-Null
  $reader.ReadByte() | Out-Null

  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) { Skip-MineZone $reader }

  $reader.ReadByte() | Out-Null
  foreach ($n in 1..3) { $reader.ReadBoolean() | Out-Null }
  $reader.ReadUInt16() | Out-Null
  if ($version -ge 78) { $reader.ReadBoolean() | Out-Null }
  if ($version -ge 79) { $reader.ReadBoolean() | Out-Null }
  if ($version -ge 110) { $reader.ReadUInt16() | Out-Null }
  if ($version -ge 111) {
    $reader.ReadBoolean() | Out-Null
    $reader.ReadByte() | Out-Null
  }
  if ($version -ge 114) {
    foreach ($n in 1..5) { $reader.ReadBoolean() | Out-Null }
    $reader.ReadInt32() | Out-Null
    $reader.ReadBoolean() | Out-Null
    $reader.ReadBoolean() | Out-Null
    $reader.ReadInt32() | Out-Null
  }
}

function Skip-Stats($reader) {
  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) {
    $reader.ReadByte() | Out-Null
    $reader.ReadInt32() | Out-Null
  }
}

function Skip-ItemInfo($reader, $version) {
  $reader.ReadInt32() | Out-Null
  $reader.ReadString() | Out-Null
  foreach ($n in 1..6) { $reader.ReadByte() | Out-Null }
  $reader.ReadInt16() | Out-Null
  foreach ($n in 1..3) { $reader.ReadByte() | Out-Null }
  $reader.ReadUInt16() | Out-Null
  $reader.ReadUInt16() | Out-Null
  if ($version -le 84) { $reader.ReadUInt32() | Out-Null } else { $reader.ReadUInt16() | Out-Null }
  $reader.ReadUInt32() | Out-Null
  if ($version -le 84) { throw "Legacy item DB versions are not supported." }
  $reader.ReadBoolean() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadInt16() | Out-Null
  $reader.ReadInt16() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadBoolean() | Out-Null
  $reader.ReadBoolean() | Out-Null
  $reader.ReadByte() | Out-Null
  Skip-Stats $reader
  $hasTooltip = $reader.ReadBoolean()
  if ($hasTooltip) { $reader.ReadString() | Out-Null }
}

function Skip-MonsterInfo($reader, $version) {
  $reader.ReadInt32() | Out-Null
  $reader.ReadString() | Out-Null
  $reader.ReadUInt16() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadByte() | Out-Null
  if ($version -lt 62) { $reader.ReadByte() | Out-Null } else { $reader.ReadUInt16() | Out-Null }
  $reader.ReadByte() | Out-Null
  $reader.ReadByte() | Out-Null
  if ($version -gt 84) { Skip-Stats $reader } else { $reader.ReadUInt32() | Out-Null }
  if ($version -lt 62) {
    foreach ($n in 1..10) { $reader.ReadByte() | Out-Null }
  } elseif ($version -le 84) {
    foreach ($n in 1..10) { $reader.ReadUInt16() | Out-Null }
  }
  if ($version -le 84) {
    $reader.ReadByte() | Out-Null
    $reader.ReadByte() | Out-Null
  }
  $reader.ReadByte() | Out-Null
  $reader.ReadUInt16() | Out-Null
  $reader.ReadUInt16() | Out-Null
  $reader.ReadUInt32() | Out-Null
  $reader.ReadBoolean() | Out-Null
  $reader.ReadBoolean() | Out-Null
  if ($version -lt 18) { return }
  $reader.ReadBoolean() | Out-Null
  $reader.ReadBoolean() | Out-Null
  if ($version -lt 89) { return }
  $reader.ReadString() | Out-Null
  if ($version -ge 115) { $reader.ReadBoolean() | Out-Null }
  if ($version -ge 116) { $reader.ReadBoolean() | Out-Null }
}

function Read-NPCInfo($reader, $version) {
  $index = $reader.ReadInt32()
  $mapIndex = $reader.ReadInt32()
  $collect = @()
  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) { $collect += $reader.ReadInt32() }
  $finish = @()
  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) { $finish += $reader.ReadInt32() }
  $fileName = $reader.ReadString()
  $name = $reader.ReadString()
  $x = $reader.ReadInt32()
  $y = $reader.ReadInt32()
  $image = if ($version -ge 72) { [int]$reader.ReadUInt16() } else { [int]$reader.ReadByte() }
  $rate = [int]$reader.ReadUInt16()
  $timeVisible = $false
  $hourStart = 0
  $minuteStart = 0
  $hourEnd = 0
  $minuteEnd = 0
  $minLev = 0
  $maxLev = 0
  $dayOfWeek = ""
  $classRequired = ""
  $conquest = 0
  $flagNeeded = 0
  if ($version -ge 64) {
    $timeVisible = $reader.ReadBoolean()
    $hourStart = [int]$reader.ReadByte()
    $minuteStart = [int]$reader.ReadByte()
    $hourEnd = [int]$reader.ReadByte()
    $minuteEnd = [int]$reader.ReadByte()
    $minLev = [int]$reader.ReadInt16()
    $maxLev = [int]$reader.ReadInt16()
    $dayOfWeek = $reader.ReadString()
    $classRequired = $reader.ReadString()
    if ($version -ge 66) { $conquest = $reader.ReadInt32() } else { $reader.ReadBoolean() | Out-Null }
    $flagNeeded = $reader.ReadInt32()
  }
  $showOnBigMap = $false
  $bigMapIcon = 0
  if ($version -gt 95) {
    $showOnBigMap = $reader.ReadBoolean()
    $bigMapIcon = $reader.ReadInt32()
  }
  $canTeleportTo = $false
  if ($version -gt 96) { $canTeleportTo = $reader.ReadBoolean() }
  $conquestVisible = $true
  if ($version -ge 107) { $conquestVisible = $reader.ReadBoolean() }

  return [ordered]@{
    index = $index
    mapIndex = $mapIndex
    fileName = $fileName
    name = $name
    x = $x
    y = $y
    image = $image
    library = "NPC/$image.Lib"
    rate = $rate
    showOnBigMap = $showOnBigMap
    bigMapIcon = $bigMapIcon
    canTeleportTo = $canTeleportTo
    minLevel = $minLev
    maxLevel = $maxLev
    timeVisible = $timeVisible
    hourStart = $hourStart
    minuteStart = $minuteStart
    hourEnd = $hourEnd
    minuteEnd = $minuteEnd
    dayOfWeek = $dayOfWeek
    classRequired = $classRequired
    conquest = $conquest
    flagNeeded = $flagNeeded
    conquestVisible = $conquestVisible
    collectQuestIndexes = $collect
    finishQuestIndexes = $finish
  }
}

$db = Resolve-Path $DatabasePath
$stream = [System.IO.File]::OpenRead($db)
$reader = [System.IO.BinaryReader]::new($stream)
try {
  $version = $reader.ReadInt32()
  $customVersion = $reader.ReadInt32()
  $reader.ReadInt32() | Out-Null
  $reader.ReadInt32() | Out-Null
  $reader.ReadInt32() | Out-Null
  $reader.ReadInt32() | Out-Null
  $reader.ReadInt32() | Out-Null
  if ($version -ge 63) { $reader.ReadInt32() | Out-Null }
  if ($version -ge 66) { $reader.ReadInt32() | Out-Null }
  if ($version -ge 68) { $reader.ReadInt32() | Out-Null }

  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) { Skip-MapInfo $reader $version }
  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) { Skip-ItemInfo $reader $version }
  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) { Skip-MonsterInfo $reader $version }

  $count = $reader.ReadInt32()
  $npcs = New-Object System.Collections.Generic.List[object]
  for ($i = 0; $i -lt $count; $i++) {
    $npcs.Add((Read-NPCInfo $reader $version))
  }

  $out = [ordered]@{
    source = $db.Path
    version = $version
    customVersion = $customVersion
    exported = $npcs.Count
    npcs = @($npcs.ToArray())
  }
  $fullOut = Join-Path $PSScriptRoot $OutputPath
  New-Item -ItemType Directory -Force -Path (Split-Path $fullOut -Parent) | Out-Null
  $out | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $fullOut
  Write-Output "Exported $($npcs.Count) NPCs from DB v$version"
  Write-Output $fullOut
}
finally {
  $reader.Dispose()
  $stream.Dispose()
}
