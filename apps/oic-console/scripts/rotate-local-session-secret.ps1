$ErrorActionPreference = "Stop"

$consoleRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$configPath = [IO.Path]::GetFullPath((Join-Path $consoleRoot ".env.local"))
$rootPrefix = $consoleRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $configPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Local Console config path is outside the OIC Console directory."
}
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  throw "The ignored apps/oic-console/.env.local file must exist before rotating the session secret."
}

git -C $consoleRoot check-ignore --quiet -- .env.local
if ($LASTEXITCODE -ne 0) { throw "Refusing to write: .env.local is not Git-ignored." }

$bytes = New-Object byte[] 48
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $rng.GetBytes($bytes)
} finally {
    $rng.Dispose()
}
$secret = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
[Array]::Clear($bytes, 0, $bytes.Length)
try {
  $contents = [IO.File]::ReadAllText($configPath)
  $newline = if ($contents.Contains("`r`n")) { "`r`n" } else { "`n" }
  $lines = @([Regex]::Split($contents, "\r\n|\n|\r") | Where-Object { $_ -notmatch '^\s*OIC_CONSOLE_SESSION_SECRET\s*=' })
  $lines += "OIC_CONSOLE_SESSION_SECRET=$secret"
  [IO.File]::WriteAllText($configPath, [string]::Join($newline, $lines), [Text.UTF8Encoding]::new($false))
  Write-Output "Console session secret rotated privately. Existing Console sessions are invalidated after restart."
}
finally {
  $secret = $null
}
