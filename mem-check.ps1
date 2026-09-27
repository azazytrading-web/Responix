$gc = [System.GC]::GetGCMemoryInfo()
"TotalPhysicalMB={0:N0} AvailableMB={1:N0} Load={2:N2}" -f ($gc.TotalPhysicalMemory / 1MB), ($gc.AvailablePhysicalMemory / 1MB), $gc.MemoryLoad
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object { "node pid={0} mem={1:N0}MB" -f $_.Id, ($_.WorkingSet64 / 1MB) }