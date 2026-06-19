param(
  [string]$DatabasePath = "C:/Users/bb-we/Documents/Crystal-master/Build/Server/Release/Server.MirDB",
  [string]$OutputPath = "../src/data/crystal-items.json"
)

$itemTypes = @{
  0 = "Nothing"; 1 = "Weapon"; 2 = "Armour"; 4 = "Helmet"; 5 = "Necklace"; 6 = "Bracelet"; 7 = "Ring"; 8 = "Amulet";
  9 = "Belt"; 10 = "Boots"; 11 = "Stone"; 12 = "Torch"; 13 = "Potion"; 14 = "Ore"; 15 = "Meat"; 16 = "CraftingMaterial";
  17 = "Scroll"; 18 = "Gem"; 19 = "Mount"; 20 = "Book"; 21 = "Script"; 22 = "Reins"; 23 = "Bells"; 24 = "Saddle";
  25 = "Ribbon"; 26 = "Mask"; 27 = "Food"; 28 = "Hook"; 29 = "Float"; 30 = "Bait"; 31 = "Finder"; 32 = "Reel";
  33 = "Fish"; 34 = "Quest"; 35 = "Awakening"; 36 = "Pets"; 37 = "Transform"; 38 = "Deco"; 39 = "Socket";
  40 = "MonsterSpawn"; 41 = "SiegeAmmo"; 42 = "SealedHero";
}

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
  $reader.ReadInt32() | Out-Null
  $reader.ReadInt32() | Out-Null
  $reader.ReadInt32() | Out-Null
  $reader.ReadInt32() | Out-Null
  $reader.ReadInt32() | Out-Null
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
  $reader.ReadBoolean() | Out-Null
  $reader.ReadBoolean() | Out-Null
  $reader.ReadBoolean() | Out-Null
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

function Read-ItemInfo($reader, $version, $customVersion) {
  $index = $reader.ReadInt32()
  $name = $reader.ReadString()
  $typeId = [int]$reader.ReadByte()
  $grade = [int]$reader.ReadByte()
  $requiredType = [int]$reader.ReadByte()
  $requiredClass = [int]$reader.ReadByte()
  $requiredGender = [int]$reader.ReadByte()
  $set = [int]$reader.ReadByte()
  $shape = $reader.ReadInt16()
  $weight = [int]$reader.ReadByte()
  $light = [int]$reader.ReadByte()
  $requiredAmount = [int]$reader.ReadByte()
  $image = [int]$reader.ReadUInt16()
  $durability = [int]$reader.ReadUInt16()
  if ($version -le 84) { $stackSize = [int]$reader.ReadUInt32() } else { $stackSize = [int]$reader.ReadUInt16() }
  $price = [uint32]$reader.ReadUInt32()

  $legacyStats = [ordered]@{}
  if ($version -le 84) { throw "Legacy item DB versions are not supported by this exporter yet." }

  $startItem = $reader.ReadBoolean()
  $effect = [int]$reader.ReadByte()
  $bools = [int]$reader.ReadByte()
  $bind = [int]$reader.ReadInt16()
  $unique = [int]$reader.ReadInt16()
  $randomStatsId = [int]$reader.ReadByte()
  $canFastRun = $reader.ReadBoolean()
  $canAwakening = $reader.ReadBoolean()
  $slots = [int]$reader.ReadByte()
  $stats = Read-Stats $reader
  $hasTooltip = $reader.ReadBoolean()
  $tooltip = if ($hasTooltip) { $reader.ReadString() } else { "" }

  return [ordered]@{
    crystalIndex = $index
    id = ($name.ToLowerInvariant() -replace '[^a-z0-9]+', '-' -replace '(^-|-$)', '')
    name = $name
    type = $(if ($itemTypes.ContainsKey($typeId)) { $itemTypes[$typeId] } else { "Type$typeId" })
    typeId = $typeId
    grade = $grade
    requiredType = $requiredType
    requiredClass = $requiredClass
    requiredGender = $requiredGender
    set = $set
    shape = $shape
    icon = [ordered]@{
      library = "Items"
      frame = $image
    }
    durability = $durability
    weight = $weight
    light = $light
    requiredAmount = $requiredAmount
    stackSize = $stackSize
    price = $price
    startItem = $startItem
    effect = $effect
    flags = [ordered]@{
      needIdentify = (($bools -band 0x01) -ne 0)
      showGroupPickup = (($bools -band 0x02) -ne 0)
      classBased = (($bools -band 0x04) -ne 0)
      levelBased = (($bools -band 0x08) -ne 0)
      canMine = (($bools -band 0x10) -ne 0)
      globalDropNotify = (($bools -band 0x20) -ne 0)
      canFastRun = $canFastRun
      canAwakening = $canAwakening
    }
    bind = $bind
    unique = $unique
    randomStatsId = $randomStatsId
    slots = $slots
    stats = To-IdleStats $stats
    rawStats = $stats
    tooltip = $tooltip
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
  for ($i = 0; $i -lt $mapCount; $i++) { Skip-MapInfo $reader $version }

  $itemCount = $reader.ReadInt32()
  $items = New-Object System.Collections.Generic.List[object]
  for ($i = 0; $i -lt $itemCount; $i++) {
    $items.Add((Read-ItemInfo $reader $version $customVersion))
  }

  $out = [ordered]@{
    source = $db.Path
    version = $version
    customVersion = $customVersion
    exported = $items.Count
    items = @($items.ToArray())
  }
  $fullOut = Join-Path $PSScriptRoot $OutputPath
  New-Item -ItemType Directory -Force -Path (Split-Path $fullOut -Parent) | Out-Null
  $out | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $fullOut
  Write-Output "Exported $($items.Count) items from DB v$version"
  Write-Output $fullOut
}
finally {
  $reader.Dispose()
  $stream.Dispose()
}
