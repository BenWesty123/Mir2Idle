param(
  [string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not ("ProbeLib" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.IO; using System.IO.Compression;
public sealed class ProbeLib : IDisposable {
  BinaryReader r; FileStream s; int[] o;
  public ProbeLib(string p){ s=new FileStream(p,FileMode.Open,FileAccess.Read,FileShare.ReadWrite); r=new BinaryReader(s); r.ReadInt32(); int c=r.ReadInt32(); o=new int[c]; for(int i=0;i<c;i++) o[i]=r.ReadInt32(); }
  public bool Has(int i){ if(i<0||i>=o.Length||o[i]<=0) return false; s.Position=o[i]; short w=r.ReadInt16(), h=r.ReadInt16(); return w>0&&h>0; }
  public void Dispose(){ r.Dispose(); s.Dispose(); }
}
"@
}

function Show-Frames($label, $path, [int[]]$frames) {
  Write-Host $label
  $lib = [ProbeLib]::new($path)
  foreach ($f in $frames) {
    $status = if ($lib.Has($f)) { "ok" } else { "MISS" }
    Write-Host ("  {0,4}: {1}" -f $f, $status)
  }
  $lib.Dispose()
}

$lib99 = Join-Path $DataRoot "Monster\099.Lib"
$magic2 = Join-Path $DataRoot "Magic2.Lib"
$lib100 = Join-Path $DataRoot "Monster\100.Lib"
Show-Frames "Monster 099 dir6 body (260-265)" $lib99 @(260,261,262,263,264,265)
Show-Frames "Monster 099 blend RG (296-300)" $lib99 @(296,297,298,299,300)
Show-Frames "Monster 100 dir6 body (260-265)" $lib100 @(260,261,262,263,264,265)
Show-Frames "Monster 100 blend LG dir6 (326-330)" $lib100 @(326,327,328,329,330)
Show-Frames "Monster 099 frames 301-360" $lib99 (301..360)
Show-Frames "Monster 099 frames 560-640" $lib99 (560..640)
Show-Frames "Magic2 projectile (8-16)" $magic2 @(8,9,10,11,12,13,14,15,16)
