param([string]$DataRoot = "C:\Users\bb-we\Documents\Crystal-master\Next\NextClient\Data")
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
if (-not ("ProbeLib2" -as [type])) {
  Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.IO; using System.IO.Compression; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public sealed class ProbeLib2 : IDisposable {
  BinaryReader r; FileStream s; int[] o;
  public ProbeLib2(string p){ s=new FileStream(p,FileMode.Open,FileAccess.Read,FileShare.ReadWrite); r=new BinaryReader(s); r.ReadInt32(); int c=r.ReadInt32(); o=new int[c]; for(int i=0;i<c;i++) o[i]=r.ReadInt32(); }
  public string Info(int i){
    if(i<0||i>=o.Length||o[i]<=0) return "MISS";
    s.Position=o[i]; short w=r.ReadInt16(), h=r.ReadInt16(), ox=r.ReadInt16(), oy=r.ReadInt16();
    return w+"x"+h+" @"+ox+","+oy;
  }
  public void Dispose(){ r.Dispose(); s.Dispose(); }
}
"@
}
$lib = [ProbeLib2]::new((Join-Path $DataRoot "Magic2.Lib"))
foreach ($f in 0..40) { Write-Host ("{0,3}: {1}" -f $f, $lib.Info($f)) }
$lib.Dispose()
