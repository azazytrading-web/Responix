[CmdletBinding()]
param(
  [ValidateSet("backend", "dashboard", "client", "all", "stop")]
  [string]$Target = "all",
  [switch]$InternalRun,
  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$stateDirectory = Join-Path $root ".dev-runtime"
$logDirectory = Join-Path $stateDirectory "logs"
$minimumNode = [version]"20.11.0"

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
function Write-Step([string]$Message) { Write-Host "[Responix] $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message)   { Write-Host "[Responix] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "[Responix] $Message" -ForegroundColor Yellow }
function Fail([string]$Message) { throw "[Responix] $Message" }

function Invoke-Checked([string]$Command, [string[]]$Arguments) {
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { Fail "Command failed: $Command $($Arguments -join ' ')" }
}

# ---------------------------------------------------------------------------
# Tooling checks
# ---------------------------------------------------------------------------
function Assert-Tooling {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { Fail "Node.js is missing. Install Node.js $minimumNode or newer." }
  $rawVersion = (& node --version).Trim().TrimStart("v")
  try { $version = [version]$rawVersion } catch { Fail "Unable to parse Node.js version '$rawVersion'." }
  if ($version -lt $minimumNode) { Fail "Node.js $minimumNode or newer is required; found $rawVersion." }
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { Fail "pnpm is missing. Run 'corepack enable' and install pnpm 9.15.4." }
  $pnpmVersion = (& pnpm --version).Trim()
  if ([version]$pnpmVersion -lt [version]"9.0.0") { Fail "pnpm 9 or newer is required; found $pnpmVersion." }
  Write-Ok "Tooling ready (Node $rawVersion, pnpm $pnpmVersion)."
}

# ---------------------------------------------------------------------------
# Dependencies & environment
# ---------------------------------------------------------------------------
function Ensure-Dependencies {
  if (-not (Test-Path (Join-Path $root "node_modules/.modules.yaml"))) {
    Write-Step "Installing workspace dependencies..."
    Invoke-Checked "pnpm" @("install", "--frozen-lockfile")
  }
}

function New-Secret([int]$Bytes, [switch]$Base64) {
  $buffer = New-Object byte[] $Bytes
  $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $generator.GetBytes($buffer) } finally { $generator.Dispose() }
  if ($Base64) { return [Convert]::ToBase64String($buffer) }
  return ([BitConverter]::ToString($buffer) -replace "-", "").ToLowerInvariant()
}

function Ensure-Environment {
  $environment = Join-Path $root ".env"
  if (-not (Test-Path $environment)) {
    $example = Join-Path $root ".env.example"
    if (-not (Test-Path $example)) { Fail ".env and .env.example are both missing." }
    $content = Get-Content $example -Raw
    $content = $content -replace "replace-with-a-local-access-secret-at-least-32-characters", (New-Secret 32)
    $content = $content -replace "replace-with-a-local-refresh-secret-at-least-32-characters", (New-Secret 32)
    $content = $content -replace "replace-with-a-base64-encoded-32-byte-key", (New-Secret 32 -Base64)
    [IO.File]::WriteAllText($environment, $content, [Text.UTF8Encoding]::new($false))
    Write-Step "Created .env from .env.example with generated local secrets. Review external provider values before using those integrations."
  }
  $required = @("DATABASE_URL", "REDIS_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "AI_CREDENTIAL_ENCRYPTION_KEY")
  $keys = @{}
  foreach ($line in Get-Content $environment) {
    if ($line -match '^\s*([^#][A-Za-z0-9_]*)=(.*)$') { $keys[$matches[1]] = $matches[2].Trim() }
  }
  $missing = @($required | Where-Object { -not $keys.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($keys[$_]) })
  if ($missing.Count -gt 0) { Fail ".env is missing required values: $($missing -join ', ')." }
}

function Load-DotEnv {
  $environment = Join-Path $root ".env"
  if (-not (Test-Path $environment)) { return }
  foreach ($line in Get-Content $environment) {
    if ($line -match '^\s*([^#][A-Za-z0-9_]*)=(.*)$') {
      $key = $matches[1]
      $value = $matches[2].Trim()
      # Remove surrounding quotes if present
      if ($value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Substring(1, $value.Length - 2) }
      if ($value.StartsWith("'") -and $value.EndsWith("'")) { $value = $value.Substring(1, $value.Length - 2) }
      [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
  }
  Write-Ok "Loaded environment variables from .env"
}

# ---------------------------------------------------------------------------
# Prisma
# ---------------------------------------------------------------------------
function Ensure-Prisma {
  $schema = Join-Path $root "packages/database/prisma/schema.prisma"
  $generated = Get-ChildItem (Join-Path $root "node_modules/.pnpm") -Filter "default.d.ts" -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '@prisma\+client.*node_modules[\\/]\.prisma[\\/]client' } | Select-Object -First 1
  if (-not $generated -or $generated.LastWriteTimeUtc -lt (Get-Item $schema).LastWriteTimeUtc) {
    Write-Step "Generating Prisma Client..."
    Invoke-Checked "pnpm" @("db:generate")
  }
}

# ---------------------------------------------------------------------------
# Native Windows Service helpers
# ---------------------------------------------------------------------------
function Get-MatchingServices {
  param(
    [string[]]$NamePatterns,
    [string[]]$DisplayNamePatterns
  )
  $all = Get-Service -ErrorAction SilentlyContinue
  $matched = @()
  foreach ($svc in $all) {
    $nameMatch = $false
    $displayMatch = $false
    foreach ($p in $NamePatterns) {
      if ($svc.Name -match $p) { $nameMatch = $true; break }
    }
    foreach ($p in $DisplayNamePatterns) {
      if ($svc.DisplayName -match $p) { $displayMatch = $true; break }
    }
    if ($nameMatch -or $displayMatch) { $matched += $svc }
  }
  return $matched
}

function Get-PostgresVersion([string]$ServiceName) {
  if ($ServiceName -match '(\d+)$') { return [int]$matches[1] }
  if ($ServiceName -match '(\d+)') { return [int]$matches[1] }
  return 0
}

function Assert-PostgreSQL {
  $matches = Get-MatchingServices `
    -NamePatterns @('postgre', 'pgsql') `
    -DisplayNamePatterns @('postgre', 'pgsql')

  if ($matches.Count -eq 0) {
    Write-Warn "PostgreSQL Windows service was not found."
    $allSql = Get-MatchingServices -NamePatterns @('sql', 'db', 'data') -DisplayNamePatterns @('sql', 'db', 'data')
    if ($allSql.Count -gt 0) {
      Write-Host "[Responix] Discovered SQL-related services on this machine:" -ForegroundColor Yellow
      foreach ($s in $allSql) {
        Write-Host ("  - {0,-30} (DisplayName: {1})" -f $s.Name, $s.DisplayName) -ForegroundColor Yellow
      }
    } else {
      Write-Host "[Responix] No SQL-related services were discovered on this machine." -ForegroundColor Yellow
    }
    Write-Host "[Responix] Please install PostgreSQL for Windows from https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Fail "PostgreSQL is required for local development."
  }

  $running = $matches | Where-Object { $_.Status -eq 'Running' }
  if ($running.Count -gt 0) {
    $svc = $running | Sort-Object { Get-PostgresVersion $_.Name } -Descending | Select-Object -First 1
  } else {
    $svc = $matches | Sort-Object { Get-PostgresVersion $_.Name } -Descending | Select-Object -First 1
  }

  if ($svc.Status -ne 'Running') {
    Write-Step "Starting PostgreSQL service ($($svc.Name))..."
    Start-Service -Name $svc.Name
    Write-Ok "PostgreSQL service started."
  } else {
    Write-Ok "PostgreSQL service is already running ($($svc.Name))."
  }
}

function Assert-Redis {
  $matches = Get-MatchingServices `
    -NamePatterns @('redis', 'memurai', 'redisserver') `
    -DisplayNamePatterns @('redis', 'memurai', 'redis server')

  if ($matches.Count -eq 0) {
    Write-Warn "Redis Windows service was not found."
    $allRedis = Get-MatchingServices -NamePatterns @('redis', 'memurai', 'cache') -DisplayNamePatterns @('redis', 'memurai', 'cache')
    if ($allRedis.Count -gt 0) {
      Write-Host "[Responix] Discovered Redis/Memurai/cache-related services on this machine:" -ForegroundColor Yellow
      foreach ($s in $allRedis) {
        Write-Host ("  - {0,-30} (DisplayName: {1})" -f $s.Name, $s.DisplayName) -ForegroundColor Yellow
      }
    } else {
      Write-Host "[Responix] No Redis/Memurai services were discovered on this machine." -ForegroundColor Yellow
    }
    Write-Host "[Responix] Please install Redis for Windows (e.g., Memurai, Redis-Windows, or WSL Redis)." -ForegroundColor Yellow
    Fail "Redis is required for local development."
  }

  $running = $matches | Where-Object { $_.Status -eq 'Running' }
  if ($running.Count -gt 0) {
    $svc = $running | Select-Object -First 1
  } else {
    $svc = $matches | Select-Object -First 1
  }

  if ($svc.Status -ne 'Running') {
    Write-Step "Starting Redis service ($($svc.Name))..."
    Start-Service -Name $svc.Name
    Write-Ok "Redis service started."
  } else {
    Write-Ok "Redis service is already running ($($svc.Name))."
  }
}

# ---------------------------------------------------------------------------
# Port / health waiting
# ---------------------------------------------------------------------------
function Wait-ForPort {
  param(
    [string]$HostName = "localhost",
    [int]$Port,
    [int]$TimeoutSeconds = 120,
    [string]$ServiceName = "service"
  )
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
    try {
      $client = New-Object Net.Sockets.TcpClient
      $client.Connect($HostName, $Port)
      $client.Close()
      Write-Ok "$ServiceName is accepting connections on port $Port."
      return
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  Fail "$ServiceName did not become available on port $Port within ${TimeoutSeconds}s."
}

function Wait-ForHealth {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 120,
    [string]$ServiceName = "service"
  )
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
    try {
      $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
      if ($resp.StatusCode -eq 200) {
        Write-Ok "$ServiceName health check passed at $Url."
        return
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  Fail "$ServiceName health check at $Url did not pass within ${TimeoutSeconds}s."
}

# ---------------------------------------------------------------------------
# Retry helper
# ---------------------------------------------------------------------------
function Invoke-WithRetry {
  param(
    [scriptblock]$Action,
    [int]$MaxAttempts = 5,
    [int]$DelaySeconds = 3,
    [string]$Description = "operation"
  )
  for ($i = 1; $i -le $MaxAttempts; $i++) {
    try {
      & $Action
      return
    } catch {
      if ($i -eq $MaxAttempts) { throw }
      Write-Warn "$Description failed (attempt $i / $MaxAttempts). Retrying in ${DelaySeconds}s..."
      Start-Sleep -Seconds $DelaySeconds
    }
  }
}

# ---------------------------------------------------------------------------
# Build directories
# ---------------------------------------------------------------------------
function Ensure-BuildDirectories {
  New-Item -ItemType Directory -Force -Path (Join-Path $root "apps/api/dist") | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $root "apps/dashboard/.next-dashboard") | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $root "apps/dashboard/.next-client") | Out-Null
}

# ---------------------------------------------------------------------------
# Backend init (native Windows services)
# ---------------------------------------------------------------------------
function Initialize-Backend {
  if (-not $ValidateOnly) {
    Assert-PostgreSQL
    Assert-Redis

    New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null

    # Wait for TCP ports before attempting migrations
    Wait-ForPort -Port 5432 -ServiceName "PostgreSQL" -TimeoutSeconds 120
    Wait-ForPort -Port 6379 -ServiceName "Redis"      -TimeoutSeconds 120

    Write-Step "Applying database migrations..."
    Invoke-WithRetry -Description "Prisma migration deploy" -MaxAttempts 5 -DelaySeconds 3 -Action {
      Invoke-Checked "pnpm" @("db:deploy")
    }
  }
}

# ---------------------------------------------------------------------------
# Terminal / service launching
# ---------------------------------------------------------------------------
function Start-Terminal([string]$Name, [string]$Service) {
  New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null
  New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

  $pidFile = Join-Path $stateDirectory "$Service.pid"
  if (Test-Path $pidFile) {
    $tracked = $null
    try { $tracked = Get-Content $pidFile -Raw | ConvertFrom-Json } catch { $tracked = $null }
    if ($tracked -and $tracked.pid -and $tracked.startedAtUtcTicks) {
      $oldProcess = Get-Process -Id ([int]$tracked.pid) -ErrorAction SilentlyContinue
      if ($oldProcess -and $oldProcess.ProcessName -eq "powershell" -and
          $oldProcess.StartTime.ToUniversalTime().Ticks -eq [long]$tracked.startedAtUtcTicks) {
        Write-Warn "$Name is already running (PID $($tracked.pid))."
        return
      }
    }
    Remove-Item $pidFile -Force
  }

  $arguments = @(
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $PSCommandPath,
    "-Target", $Service,
    "-InternalRun"
  )
  $process = Start-Process powershell.exe -ArgumentList $arguments -WorkingDirectory $root -PassThru

  $identity = @{ pid = $process.Id; startedAtUtcTicks = $process.StartTime.ToUniversalTime().Ticks } | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($pidFile, $identity)
  Write-Ok "Started $Name in its own terminal (PID $($process.Id))."
}

function Invoke-Service([string]$Service) {
  Set-Location $root
  Load-DotEnv
  switch ($Service) {
    "backend" {
      $host.UI.RawUI.WindowTitle = "Responix Backend"
      Invoke-Checked "pnpm" @("--filter", "@responix/api", "dev")
    }
    "dashboard" {
      $host.UI.RawUI.WindowTitle = "Responix Dashboard"
      Invoke-Checked "pnpm" @("--filter", "@responix/dashboard", "dev")
    }
    "client" {
      $host.UI.RawUI.WindowTitle = "Responix Client Portal"
      if (-not (Test-Path (Join-Path $root "apps/client/package.json"))) {
        Fail "The @responix/client workspace package is not present at apps/client/package.json."
      }
      Invoke-Checked "pnpm" @("--filter", "@responix/client", "dev")
    }
  }
}

# ---------------------------------------------------------------------------
# Graceful shutdown (only project processes; never PostgreSQL/Redis)
# ---------------------------------------------------------------------------
function Stop-Services {
  if (-not (Test-Path $stateDirectory)) {
    Write-Warn "No tracked development processes are running."
    return
  }

  # Try graceful stop first (Ctrl+C equivalent via WM_CLOSE), then forceful
  foreach ($file in Get-ChildItem $stateDirectory -Filter "*.pid") {
    $tracked = $null
    try { $tracked = Get-Content $file.FullName -Raw | ConvertFrom-Json } catch { $tracked = $null }
    if (-not $tracked -or -not $tracked.pid) { Remove-Item $file.FullName -Force; continue }
    $trackedPid = [int]$tracked.pid
    $proc = Get-Process -Id $trackedPid -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -eq "powershell" -and
        $proc.StartTime.ToUniversalTime().Ticks -eq [long]$tracked.startedAtUtcTicks) {
      Write-Step "Stopping $($file.BaseName) (PID $trackedPid)..."
      try {
        # Graceful: send WM_CLOSE to the console window
        $proc.CloseMainWindow() | Out-Null
        if (-not $proc.WaitForExit(5000)) {
          Write-Warn "Graceful shutdown timed out for $($file.BaseName). Force stopping..."
          & taskkill.exe /PID $trackedPid /T /F | Out-Host
        } else {
          Write-Ok "$($file.BaseName) stopped gracefully."
        }
      } catch {
        Write-Warn "Error during graceful stop. Force stopping..."
        & taskkill.exe /PID $trackedPid /T /F | Out-Host
      }
    }
    Remove-Item $file.FullName -Force
  }

  Write-Ok "All tracked development processes stopped. PostgreSQL and Redis services were left running."
}

# ---------------------------------------------------------------------------
# Main entrypoint
# ---------------------------------------------------------------------------
try {
  if ($InternalRun) { Invoke-Service $Target; return }

  Set-Location $root

  if ($Target -eq "stop") { Stop-Services; exit 0 }

  Assert-Tooling
  Ensure-Dependencies
  Ensure-Environment
  Load-DotEnv
  Ensure-Prisma
  Ensure-BuildDirectories

  if ($Target -in @("backend", "all")) { Initialize-Backend }

  if ($ValidateOnly) {
    Write-Ok "Bootstrap validation completed for '$Target'."
    exit 0
  }

  if ($Target -in @("backend", "all")) {
    Start-Terminal "Backend" "backend"
    # Optionally wait for backend health before continuing
    if ($Target -eq "all") {
      Write-Step "Waiting for Backend API to be ready..."
      Wait-ForHealth -Url "http://localhost:4000/api/v1/health" -ServiceName "Backend API" -TimeoutSeconds 120
    }
  }

  if ($Target -in @("dashboard", "all")) { Start-Terminal "Dashboard" "dashboard" }
  if ($Target -in @("client", "all"))    { Start-Terminal "Client Portal" "client" }

  Write-Ok "Development environment started. Use 'stop-all.bat' to shut down."
}
catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  if ($Host.Name -eq "ConsoleHost" -and -not $ValidateOnly) {
    Read-Host "Press Enter to continue" | Out-Null
  }
  if ($InternalRun) { $global:LASTEXITCODE = 1; return }
  exit 1
}
