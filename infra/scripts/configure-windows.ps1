param([Parameter(Mandatory=$true)][string]$CertificatePath)
$ErrorActionPreference = 'Stop'
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = @('-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`"",'-CertificatePath',"`"$CertificatePath`"")
    $process = Start-Process -FilePath "$PSHOME\powershell.exe" -Verb RunAs -ArgumentList $arguments -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw 'Administrator host setup did not complete.' }
    exit
}
$path = "$env:SystemRoot\System32\drivers\etc\hosts"
$aliases = @('heroassociation.test','auth.heroassociation.test','identity.lab.test','auth.lab.test','pix.lab.test','app.e2e.heroassociation.test','auth.e2e.heroassociation.test')
$lines = [System.Collections.Generic.List[string]]::new()
foreach ($line in [System.IO.File]::ReadAllLines($path)) {
    $split = $line.Split('#',2)
    $parts = @($split[0].Trim() -split '\s+' | Where-Object { $_ })
    if ($parts.Count -gt 1) {
        $names = @($parts[1..($parts.Count-1)] | Where-Object { $_ -notin $aliases })
        if ($names.Count -eq 0) { continue }
        $updated = $parts[0] + "`t" + ($names -join ' ')
        if ($split.Count -gt 1) { $updated += ' #' + $split[1] }
        $lines.Add($updated)
    } else { $lines.Add($line) }
}
$lines.Add('127.0.0.2 heroassociation.test identity.lab.test auth.lab.test pix.lab.test app.e2e.heroassociation.test auth.e2e.heroassociation.test # cluster-lab')
[System.IO.File]::WriteAllLines($path, $lines, [System.Text.Encoding]::ASCII)
Import-Certificate -FilePath $CertificatePath -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
ipconfig /flushdns | Out-Null
Write-Output 'Configured Windows lab aliases and trusted the development CA for the current user.'
