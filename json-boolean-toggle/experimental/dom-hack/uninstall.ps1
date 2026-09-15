[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$scriptName = 'json-boolean-toggle-dom.js'
. (Join-Path $PSScriptRoot 'common.ps1')

$workbenchDirectory = Get-VisualStudioCodeWorkbenchDirectory
$workbenchHtml = Join-Path $workbenchDirectory 'workbench.html'
$backupHtml = "$workbenchHtml.json-boolean-toggle.bak"
$targetScript = Join-Path $workbenchDirectory $scriptName

if (-not (Test-Path -LiteralPath $backupHtml -PathType Leaf)) {
    throw "Backup workbench was not found: $backupHtml"
}

$resolvedWorkbench = (Resolve-Path -LiteralPath $workbenchDirectory).Path
$expectedRoot = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code'))

if (-not $resolvedWorkbench.StartsWith($expectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to restore an unexpected directory: $resolvedWorkbench"
}

Copy-Item -LiteralPath $backupHtml -Destination $workbenchHtml -Force

if (Test-Path -LiteralPath $targetScript -PathType Leaf) {
    Remove-Item -LiteralPath $targetScript -Force
}

Write-Output "Restored Visual Studio Code workbench: $workbenchHtml"
Write-Output 'Close every Visual Studio Code window and start it again to complete removal.'
