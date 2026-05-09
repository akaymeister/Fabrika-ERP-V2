$ErrorActionPreference = 'SilentlyContinue'
try {
  $resp = Invoke-WebRequest -Uri 'http://localhost:3000/api/hr/wage/preview' -Method POST -ContentType 'application/json' -Body '{"salary_amount":5000,"salary_currency":"USD","official_salary_amount":1500,"official_salary_currency":"USD","official_salary_fx_rate":1}' -UseBasicParsing
  Write-Output ("status=" + $resp.StatusCode)
  Write-Output $resp.Content
} catch [System.Net.WebException] {
  $r = $_.Exception.Response
  if ($r) {
    $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
    $body = $sr.ReadToEnd()
    Write-Output ("status=" + [int]$r.StatusCode)
    Write-Output $body
  } else {
    throw
  }
}
