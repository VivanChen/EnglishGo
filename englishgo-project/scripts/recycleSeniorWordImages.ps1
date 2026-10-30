param([Parameter(Mandatory=$true)][string]$ManifestPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName Microsoft.VisualBasic
$taskManifest = (Resolve-Path -LiteralPath $ManifestPath).Path
$taskTargets = @(Get-Content -Raw -LiteralPath $taskManifest | ConvertFrom-Json)
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskAllowedRoots = @(
    'C:\Users\vevanchen\.codex\generated_images\',
    (Join-Path $taskRoot 'public\images\vocabulary\senior\'),
    (Join-Path $taskRoot 'dist\images\vocabulary\senior\'),
    (Join-Path $taskRoot '.superpowers\word-art\')
)
# Validate every exact file before sending any of them to the Recycle Bin.
foreach ($taskEntry in $taskTargets) {
    $taskPath = (Resolve-Path -LiteralPath $taskEntry.path).ProviderPath
    $taskAllowed = $false
    foreach ($taskAllowedRoot in $taskAllowedRoots) {
        if ($taskPath.StartsWith($taskAllowedRoot, [StringComparison]::OrdinalIgnoreCase)) { $taskAllowed = $true; break }
    }
    if (-not $taskAllowed -or -not (Test-Path -LiteralPath $taskPath -PathType Leaf)) { throw "Unsafe cleanup target: $taskPath" }
    $taskHasher = [Security.Cryptography.SHA256]::Create()
    try { $taskStream = [IO.File]::OpenRead($taskPath) }
    catch { throw "Cannot read exact cleanup target '$taskPath': $($_.Exception.Message)" }
    try { $taskHash = [BitConverter]::ToString($taskHasher.ComputeHash($taskStream)).Replace('-', '').ToLowerInvariant() }
    finally { $taskStream.Dispose(); $taskHasher.Dispose() }
    if ($taskHash -ne $taskEntry.sha256) { throw "Cleanup hash changed: $taskPath" }
}
foreach ($taskEntry in $taskTargets) {
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($taskEntry.path, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)
}
