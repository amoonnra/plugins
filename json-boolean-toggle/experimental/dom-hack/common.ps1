function Get-VisualStudioCodeWorkbenchDirectory {
    [CmdletBinding()]
    param()

    $codeVersionOutput = @(& code --version)

    if ($LASTEXITCODE -ne 0 -or $codeVersionOutput.Count -lt 2) {
        throw 'Unable to resolve the installed Visual Studio Code commit.'
    }

    $commit = $codeVersionOutput[1].Trim()
    $installRoot = Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code'
    $versionDirectory = Get-ChildItem -Directory -LiteralPath $installRoot |
        Where-Object { $commit.StartsWith($_.Name, [System.StringComparison]::OrdinalIgnoreCase) } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($null -eq $versionDirectory) {
        throw "Unable to find the Visual Studio Code installation for commit $commit."
    }

    $workbenchDirectory = Join-Path $versionDirectory.FullName 'resources\app\out\vs\code\electron-browser\workbench'

    if (-not (Test-Path -LiteralPath $workbenchDirectory -PathType Container)) {
        throw "Visual Studio Code workbench directory was not found: $workbenchDirectory"
    }

    return (Resolve-Path -LiteralPath $workbenchDirectory).Path
}
