param(
  [string]$HostName = 'github.com'
)

Write-Host ''
Write-Host 'GitHub token setup' -ForegroundColor Cyan
Write-Host 'This will save your token in Windows Credential Manager.' -ForegroundColor DarkGray
Write-Host ''

$username = Read-Host 'GitHub username'
if ([string]::IsNullOrWhiteSpace($username)) {
  throw 'GitHub username is required.'
}

$secureToken = Read-Host 'GitHub token' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
  $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  if ([string]::IsNullOrWhiteSpace($token)) {
    throw 'GitHub token is required.'
  }

  $payload = @"
protocol=https
host=$HostName
username=$username
password=$token

"@

  $payload | git credential-manager store --no-ui
  Write-Host ''
  Write-Host "Token saved for $HostName." -ForegroundColor Green
  Write-Host 'You can now run git push without typing the token again.' -ForegroundColor Green
}
finally {
  if ($bstr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}
