$ErrorActionPreference = "Stop"

$consoleRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$configPath = [IO.Path]::GetFullPath((Join-Path $consoleRoot ".env.local"))
$rootPrefix = $consoleRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $configPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Local Console config path is outside the OIC Console directory."
}
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf)) {
  throw "The ignored apps/oic-console/.env.local file must exist before resetting the password."
}

git -C $consoleRoot check-ignore --quiet -- .env.local
if ($LASTEXITCODE -ne 0) { throw "Refusing to write: .env.local is not Git-ignored." }

$first = Read-Host "Choose a new human Operator password (16-1024 letters, digits, _ or -)" -AsSecureString
$second = Read-Host "Enter the new human Operator password again" -AsSecureString
$firstPointer = [IntPtr]::Zero
$secondPointer = [IntPtr]::Zero
$password = $null
$confirmation = $null

try {
  $firstPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
  $secondPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstPointer)
  $confirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secondPointer)

  if ($password -cne $confirmation) { throw "The entries did not match; no config was changed." }
  if ($password -notmatch '^[A-Za-z0-9_-]{16,1024}$') {
    throw "Choose 16-1024 URL-safe characters (letters, digits, _ or -); no config was changed."
  }

  $contents = [IO.File]::ReadAllText($configPath)
  $newline = if ($contents.Contains("`r`n")) { "`r`n" } else { "`n" }
  $lines = @([Regex]::Split($contents, "\r\n|\n|\r") | Where-Object { $_ -notmatch '^\s*OIC_CONSOLE_OPERATOR_PASSWORD\s*=' })
  $lines += "OIC_CONSOLE_OPERATOR_PASSWORD=$password"
  [IO.File]::WriteAllText($configPath, [string]::Join($newline, $lines), [Text.UTF8Encoding]::new($false))

  $client = [Net.Sockets.TcpClient]::new()
  $consoleRunning = $false
  try {
    $connect = $client.ConnectAsync("127.0.0.1", 3002)
    $consoleRunning = $connect.Wait(750) -and $client.Connected
  }
  catch {
    $consoleRunning = $false
  }
  finally {
    $client.Dispose()
  }

  Write-Output "Password updated successfully."
  if ($consoleRunning) {
    Write-Output "Restart OIC Console, then sign in with the new password."
  }
  else {
    Write-Output "Start OIC Console and sign in with the new password."
  }
}
finally {
  if ($firstPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstPointer) }
  if ($secondPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secondPointer) }
  if ($first) { $first.Dispose() }
  if ($second) { $second.Dispose() }
  $password = $null
  $confirmation = $null
}
