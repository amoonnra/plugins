[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$markerStart = '<!-- JSON_BOOLEAN_TOGGLE_DOM_START -->'
$markerEnd = '<!-- JSON_BOOLEAN_TOGGLE_DOM_END -->'
$scriptName = 'json-boolean-toggle-dom.js'
. (Join-Path $PSScriptRoot 'common.ps1')

$workbenchDirectory = Get-VisualStudioCodeWorkbenchDirectory
$workbenchHtml = Join-Path $workbenchDirectory 'workbench.html'
$backupHtml = "$workbenchHtml.json-boolean-toggle.bak"
$targetScript = Join-Path $workbenchDirectory $scriptName
$sourceScript = Join-Path $PSScriptRoot $scriptName

if (-not (Test-Path -LiteralPath $workbenchHtml -PathType Leaf)) {
    throw "Visual Studio Code workbench was not found: $workbenchHtml"
}

if (-not (Test-Path -LiteralPath $sourceScript -PathType Leaf)) {
    throw "DOM bridge source was not found: $sourceScript"
}

$resolvedWorkbench = (Resolve-Path -LiteralPath $workbenchDirectory).Path
$expectedRoot = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code'))

if (-not $resolvedWorkbench.StartsWith($expectedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to patch an unexpected directory: $resolvedWorkbench"
}

$html = Get-Content -Raw -LiteralPath $workbenchHtml

if ($html.Contains($markerStart)) {
    Copy-Item -LiteralPath $sourceScript -Destination $targetScript -Force
    Write-Output 'JSON Boolean Toggle DOM hack is already installed; the renderer bridge was updated.'
    exit 0
}

if (-not (Test-Path -LiteralPath $backupHtml)) {
    Copy-Item -LiteralPath $workbenchHtml -Destination $backupHtml
}

Copy-Item -LiteralPath $sourceScript -Destination $targetScript -Force

$injection = @"
$markerStart
<script src="./$scriptName"></script>
$markerEnd
"@

$patchedHtml = $html.Replace('</body>', "$injection`r`n`t</body>")

if ($patchedHtml -eq $html) {
    throw 'Unable to find the workbench body closing tag.'
}

$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($workbenchHtml, $patchedHtml, $utf8WithoutBom)

Write-Output "Patched Visual Studio Code workbench: $workbenchHtml"
Write-Output 'Close every Visual Studio Code window and start it again to activate the DOM hack.'
Write-Warning 'Visual Studio Code may report that the installation is corrupt. Run npm run dom-hack:uninstall to restore the original workbench.'
