param(
  [string]$DatabasePath = "C:/Users/bb-we/Documents/Crystal-master/Build/Server/Release/Server.MirDB",
  [string]$MapsOutputPath = "../src/data/crystal-maps.json",
  [string]$MonstersOutputPath = "../src/data/crystal-monsters.json"
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

function Read-Stats($reader) {
  $stats = [ordered]@{}
  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) {
    $id = [int]$reader.ReadByte()
    $value = $reader.ReadInt32()
    $name = $statNames[$id]
    if (-not $name) { $name = "Stat$id" }
    $stats[$name] = $value
  }
  return $stats
}

function Get-StatValue($stats, $name) {
  if ($stats.Contains($name)) { return [int]$stats[$name] }
  return 0
}

function To-IdleStats($stats) {
  return [ordered]@{
    ac = @((Get-StatValue $stats "MinAC"), (Get-StatValue $stats "MaxAC"))
    amc = @((Get-StatValue $stats "MinAMC"), (Get-StatValue $stats "MaxAMC"))
    dc = @((Get-StatValue $stats "MinDC"), (Get-StatValue $stats "MaxDC"))
    mc = @((Get-StatValue $stats "MinMC"), (Get-StatValue $stats "MaxMC"))
    sc = @((Get-StatValue $stats "MinSC"), (Get-StatValue $stats "MaxSC"))
    hp = Get-StatValue $stats "HP"
    mp = Get-StatValue $stats "MP"
    accuracy = Get-StatValue $stats "Accuracy"
    agility = Get-StatValue $stats "Agility"
    luck = Get-StatValue $stats "Luck"
    attackSpeed = Get-StatValue $stats "AttackSpeed"
  }
}

function Read-SafeZone($reader) {
  return [ordered]@{
    x = $reader.ReadInt32()
    y = $reader.ReadInt32()
    size = [int]$reader.ReadUInt16()
    startPoint = $reader.ReadBoolean()
  }
}

function Read-Respawn($reader, $version) {
  $respawn = [ordered]@{
    monsterIndex = $reader.ReadInt32()
    x = $reader.ReadInt32()
    y = $reader.ReadInt32()
    count = [int]$reader.ReadUInt16()
    spread = [int]$reader.ReadUInt16()
    delay = [int]$reader.ReadUInt16()
    direction = [int]$reader.ReadByte()
    routePath = $reader.ReadString()
    randomDelay = 0
    respawnIndex = 0
    saveRespawnTime = $false
    respawnTicks = 0
  }
  if ($version -gt 67) {
    $respawn.randomDelay = [int]$reader.ReadUInt16()
    $respawn.respawnIndex = $reader.ReadInt32()
    $respawn.saveRespawnTime = $reader.ReadBoolean()
    $respawn.respawnTicks = [int]$reader.ReadUInt16()
  }
  return $respawn
}

function Read-Movement($reader, $version) {
  $movement = [ordered]@{
    mapIndex = $reader.ReadInt32()
    sourceX = $reader.ReadInt32()
    sourceY = $reader.ReadInt32()
    destinationX = $reader.ReadInt32()
    destinationY = $reader.ReadInt32()
    needHole = $reader.ReadBoolean()
    needMove = $reader.ReadBoolean()
    conquestIndex = 0
    showOnBigMap = $false
    icon = 0
  }
  if ($version -ge 69) { $movement.conquestIndex = $reader.ReadInt32() }
  if ($version -ge 95) {
    $movement.showOnBigMap = $reader.ReadBoolean()
    $movement.icon = $reader.ReadInt32()
  }
  return $movement
}

function Read-MineZone($reader) {
  return [ordered]@{
    x = $reader.ReadInt32()
    y = $reader.ReadInt32()
    size = [int]$reader.ReadUInt16()
    direction = [int]$reader.ReadByte()
  }
}

function Read-MapInfo($reader, $version) {
  $index = $reader.ReadInt32()
  $fileName = $reader.ReadString()
  $title = $reader.ReadString()
  $miniMap = [int]$reader.ReadUInt16()
  $light = [int]$reader.ReadByte()
  $bigMap = [int]$reader.ReadUInt16()

  $safeZones = New-Object System.Collections.Generic.List[object]
  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) { $safeZones.Add((Read-SafeZone $reader)) }

  $respawns = New-Object System.Collections.Generic.List[object]
  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) { $respawns.Add((Read-Respawn $reader $version)) }

  $movements = New-Object System.Collections.Generic.List[object]
  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) { $movements.Add((Read-Movement $reader $version)) }

  $flags = [ordered]@{
    noTeleport = $reader.ReadBoolean()
    noReconnect = $reader.ReadBoolean()
    noReconnectMap = $reader.ReadString()
    noRandom = $reader.ReadBoolean()
    noEscape = $reader.ReadBoolean()
    noRecall = $reader.ReadBoolean()
    noDrug = $reader.ReadBoolean()
    noPosition = $reader.ReadBoolean()
    noThrowItem = $reader.ReadBoolean()
    noDropPlayer = $reader.ReadBoolean()
    noDropMonster = $reader.ReadBoolean()
    noNames = $reader.ReadBoolean()
    fight = $reader.ReadBoolean()
    fire = $reader.ReadBoolean()
    fireDamage = $reader.ReadInt32()
    lightning = $reader.ReadBoolean()
    lightningDamage = $reader.ReadInt32()
    mapDarkLight = [int]$reader.ReadByte()
  }

  $mineZones = New-Object System.Collections.Generic.List[object]
  $count = $reader.ReadInt32()
  for ($i = 0; $i -lt $count; $i++) { $mineZones.Add((Read-MineZone $reader)) }

  $mineIndex = [int]$reader.ReadByte()
  $flags.noMount = $reader.ReadBoolean()
  $flags.needBridle = $reader.ReadBoolean()
  $flags.noFight = $reader.ReadBoolean()
  $music = [int]$reader.ReadUInt16()

  if ($version -ge 78) { $flags.noTownTeleport = $reader.ReadBoolean() }
  if ($version -ge 79) { $flags.noReincarnation = $reader.ReadBoolean() }

  $weatherParticles = 0
  if ($version -ge 110) { $weatherParticles = [int]$reader.ReadUInt16() }
  $gt = $false
  $gtIndex = 0
  if ($version -ge 111) {
    $gt = $reader.ReadBoolean()
    $gtIndex = [int]$reader.ReadByte()
  }
  if ($version -ge 114) {
    $flags.noExperience = $reader.ReadBoolean()
    $flags.noGroup = $reader.ReadBoolean()
    $flags.noPets = $reader.ReadBoolean()
    $flags.noIntelligentCreatures = $reader.ReadBoolean()
    $flags.noHero = $reader.ReadBoolean()
    $flags.requiredGroupSize = $reader.ReadInt32()
    $flags.requiredGroup = $reader.ReadBoolean()
    $flags.fireWallLimit = $reader.ReadBoolean()
    $flags.fireWallCount = $reader.ReadInt32()
  }

  return [ordered]@{
    index = $index
    fileName = $fileName
    title = $title
    miniMap = $miniMap
    bigMap = $bigMap
    light = $light
    music = $music
    mineIndex = $mineIndex
    weatherParticles = $weatherParticles
    gt = $gt
    gtIndex = $gtIndex
    flags = $flags
    safeZones = @($safeZones.ToArray())
    respawns = @($respawns.ToArray())
    movements = @($movements.ToArray())
    mineZones = @($mineZones.ToArray())
  }
}

function Skip-ItemInfo($reader, $version) {
  $reader.ReadInt32() | Out-Null
  $reader.ReadString() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadInt16() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadUInt16() | Out-Null
  $reader.ReadUInt16() | Out-Null
  if ($version -le 84) { throw "Legacy item DB versions are not supported by this exporter yet." } else { $reader.ReadUInt16() | Out-Null }
  $reader.ReadUInt32() | Out-Null
  $reader.ReadBoolean() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadInt16() | Out-Null
  $reader.ReadInt16() | Out-Null
  $reader.ReadByte() | Out-Null
  $reader.ReadBoolean() | Out-Null
  $reader.ReadBoolean() | Out-Null
  $reader.ReadByte() | Out-Null
  Read-Stats $reader | Out-Null
  $hasTooltip = $reader.ReadBoolean()
  if ($hasTooltip) { $reader.ReadString() | Out-Null }
}

function Read-MonsterInfo($reader, $version) {
  $index = $reader.ReadInt32()
  $name = $reader.ReadString()
  $image = [int]$reader.ReadUInt16()
  $ai = [int]$reader.ReadByte()
  $effect = [int]$reader.ReadByte()
  $level = if ($version -lt 62) { [int]$reader.ReadByte() } else { [int]$reader.ReadUInt16() }
  $viewRange = [int]$reader.ReadByte()
  $coolEye = [int]$reader.ReadByte()
  $stats = if ($version -gt 84) { Read-Stats $reader } else { [ordered]@{} }

  if ($version -le 84) {
    $stats["HP"] = [int]$reader.ReadUInt32()
    if ($version -lt 62) {
      $stats["MinAC"] = [int]$reader.ReadByte()
      $stats["MaxAC"] = [int]$reader.ReadByte()
      $stats["MinAMC"] = [int]$reader.ReadByte()
      $stats["MaxAMC"] = [int]$reader.ReadByte()
      $stats["MinDC"] = [int]$reader.ReadByte()
      $stats["MaxDC"] = [int]$reader.ReadByte()
      $stats["MinMC"] = [int]$reader.ReadByte()
      $stats["MaxMC"] = [int]$reader.ReadByte()
      $stats["MinSC"] = [int]$reader.ReadByte()
      $stats["MaxSC"] = [int]$reader.ReadByte()
    }
    else {
      $stats["MinAC"] = [int]$reader.ReadUInt16()
      $stats["MaxAC"] = [int]$reader.ReadUInt16()
      $stats["MinAMC"] = [int]$reader.ReadUInt16()
      $stats["MaxAMC"] = [int]$reader.ReadUInt16()
      $stats["MinDC"] = [int]$reader.ReadUInt16()
      $stats["MaxDC"] = [int]$reader.ReadUInt16()
      $stats["MinMC"] = [int]$reader.ReadUInt16()
      $stats["MaxMC"] = [int]$reader.ReadUInt16()
      $stats["MinSC"] = [int]$reader.ReadUInt16()
      $stats["MaxSC"] = [int]$reader.ReadUInt16()
    }
    $stats["Accuracy"] = [int]$reader.ReadByte()
    $stats["Agility"] = [int]$reader.ReadByte()
  }

  $light = [int]$reader.ReadByte()
  $attackSpeed = [int]$reader.ReadUInt16()
  $moveSpeed = [int]$reader.ReadUInt16()
  $experience = [uint32]$reader.ReadUInt32()
  $canPush = $reader.ReadBoolean()
  $canTame = $reader.ReadBoolean()
  $autoRev = $false
  $undead = $false
  if ($version -ge 18) {
    $autoRev = $reader.ReadBoolean()
    $undead = $reader.ReadBoolean()
  }
  $dropPath = ""
  if ($version -ge 89) { $dropPath = $reader.ReadString() }
  $canRecall = $false
  if ($version -ge 115) { $canRecall = $reader.ReadBoolean() }
  $isBoss = $false
  if ($version -ge 116) { $isBoss = $reader.ReadBoolean() }

  return [ordered]@{
    crystalIndex = $index
    name = $name
    image = $image
    ai = $ai
    effect = $effect
    level = $level
    viewRange = $viewRange
    coolEye = $coolEye
    light = $light
    attackSpeed = $attackSpeed
    moveSpeed = $moveSpeed
    experience = $experience
    canPush = $canPush
    canTame = $canTame
    autoRev = $autoRev
    undead = $undead
    canRecall = $canRecall
    isBoss = $isBoss
    dropPath = $dropPath
    stats = To-IdleStats $stats
    rawStats = $stats
  }
}

$db = Resolve-Path $DatabasePath
$stream = [System.IO.File]::OpenRead($db)
$reader = [System.IO.BinaryReader]::new($stream)
try {
  $version = $reader.ReadInt32()
  $customVersion = $reader.ReadInt32()
  $mapIndex = $reader.ReadInt32()
  $itemIndex = $reader.ReadInt32()
  $monsterIndex = $reader.ReadInt32()
  $npcIndex = $reader.ReadInt32()
  $questIndex = $reader.ReadInt32()
  if ($version -ge 63) { $reader.ReadInt32() | Out-Null }
  if ($version -ge 66) { $reader.ReadInt32() | Out-Null }
  if ($version -ge 68) { $reader.ReadInt32() | Out-Null }

  $mapCount = $reader.ReadInt32()
  $maps = New-Object System.Collections.Generic.List[object]
  for ($i = 0; $i -lt $mapCount; $i++) { $maps.Add((Read-MapInfo $reader $version)) }

  $itemCount = $reader.ReadInt32()
  for ($i = 0; $i -lt $itemCount; $i++) { Skip-ItemInfo $reader $version }

  $monsterCount = $reader.ReadInt32()
  $monsters = New-Object System.Collections.Generic.List[object]
  for ($i = 0; $i -lt $monsterCount; $i++) { $monsters.Add((Read-MonsterInfo $reader $version)) }

  $mapOut = [ordered]@{
    source = $db.Path
    version = $version
    customVersion = $customVersion
    nextIndexes = [ordered]@{
      map = $mapIndex
      item = $itemIndex
      monster = $monsterIndex
      npc = $npcIndex
      quest = $questIndex
    }
    exported = $maps.Count
    maps = @($maps.ToArray())
  }
  $monsterOut = [ordered]@{
    source = $db.Path
    version = $version
    customVersion = $customVersion
    exported = $monsters.Count
    monsters = @($monsters.ToArray())
  }

  $fullMapsOut = Join-Path $PSScriptRoot $MapsOutputPath
  New-Item -ItemType Directory -Force -Path (Split-Path $fullMapsOut -Parent) | Out-Null
  $mapOut | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $fullMapsOut

  $fullMonstersOut = Join-Path $PSScriptRoot $MonstersOutputPath
  New-Item -ItemType Directory -Force -Path (Split-Path $fullMonstersOut -Parent) | Out-Null
  $monsterOut | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $fullMonstersOut

  Write-Output "Exported $($maps.Count) maps and $($monsters.Count) monsters from DB v$version"
  Write-Output $fullMapsOut
  Write-Output $fullMonstersOut
}
finally {
  $reader.Dispose()
  $stream.Dispose()
}
