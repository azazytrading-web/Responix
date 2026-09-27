$ErrorActionPreference = "Continue"
$base = "http://localhost:4000"
function Get-RequiredEnvironmentVariable([string]$Name) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required environment variable $Name. Set it before running this validation script."
  }
  return $value
}
$email = Get-RequiredEnvironmentVariable 'RESPONIX_E2E_EMAIL'
$password = Get-RequiredEnvironmentVariable 'RESPONIX_E2E_PASSWORD'

function Read-Body($resp) {
  try { return (New-Object IO.StreamReader($resp.Stream)).ReadToEnd() } catch { return "(no body)" }
}

function Call($method, $url, $hdr, $body) {
  try {
    if ($null -ne $body) {
      $r = Invoke-WebRequest -Method $method -Uri $url -Headers $hdr -Body $body -ContentType "application/json" -UseBasicParsing
    } else {
      $r = Invoke-WebRequest -Method $method -Uri $url -Headers $hdr -UseBasicParsing
    }
    Write-Output ("[OK " + $r.StatusCode + "] " + $method + " " + $url)
    Write-Output $r.Content
  } catch {
    $code = if ($_.Exception.Response) { $_.Exception.Response.StatusCode.value__ } else { "CONN" }
    Write-Output ("[ERR " + $code + "] " + $method + " " + $url)
    Write-Output (Read-Body $_.Exception.Response)
  }
}

$login = Invoke-RestMethod -Method Post -Uri "$base/api/v1/auth/login" -ContentType "application/json" -Body (@{ email = $email; password = $password } | ConvertTo-Json)
$hdr = @{ Authorization = "Bearer " + $login.accessToken }

Write-Output "===== SPACES ====="
$spacesRes = Call "GET" "$base/api/v1/knowledge-base/spaces" $hdr $null
$spaces = ($spacesRes | Out-String | ConvertFrom-Json) 2>$null
$spaceId = $null
try { $spaceId = ((Invoke-RestMethod -Uri "$base/api/v1/knowledge-base/spaces" -Headers $hdr))[0].id } catch {}
Write-Output ("SPACE_ID=" + $spaceId)

Write-Output "===== DOCUMENTS (no spaceId) ====="
Call "GET" "$base/api/v1/knowledge-base/documents?page=1&limit=25" $hdr $null

if ($spaceId) {
  Write-Output "===== DOCUMENTS (spaceId) ====="
  Call "GET" "$base/api/v1/knowledge-base/documents?page=1&limit=25&spaceId=$spaceId" $hdr $null
}
