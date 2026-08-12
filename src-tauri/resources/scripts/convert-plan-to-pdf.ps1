param(
    [Parameter(Mandatory = $true)][string]$PlanPath,
    [Parameter(Mandatory = $true)][string]$PdfPath,
    [Parameter(Mandatory = $true)][string]$ProcessInfoPath
)

$ErrorActionPreference = "Stop"
$wdExportFormatPdf = 17

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class SampokaiPdfWordNative {
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

function Write-JsonAtomic {
    param([string]$Path, $Value)
    $temporaryPath = "$Path.$PID.tmp"
    [IO.File]::WriteAllText($temporaryPath, ($Value | ConvertTo-Json -Depth 6 -Compress), [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
}

function Get-ProcessIdentity {
    param([int]$ProcessId)
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    return [ordered]@{
        pid = $process.Id
        startTimeUtcTicks = $process.StartTime.ToUniversalTime().Ticks
        name = $process.ProcessName
        commandLine = if ($null -ne $cim) { [string]$cim.CommandLine } else { "" }
    }
}

function Get-AutomationWordProcesses {
    return @(Get-CimInstance Win32_Process -Filter "Name = 'WINWORD.EXE'" -ErrorAction SilentlyContinue |
        Where-Object { [string]$_.CommandLine -match '(?i)(^|\s)/Automation(\s|$)' } |
        ForEach-Object { try { Get-ProcessIdentity -ProcessId ([int]$_.ProcessId) } catch {} })
}

function Get-OfficeWriterProcesses {
    return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { [string]$_.Name -in @("WINWORD.EXE", "wps.exe") } |
        ForEach-Object { try { Get-ProcessIdentity -ProcessId ([int]$_.ProcessId) } catch {} })
}

$state = [ordered]@{
    generationStartUtcTicks = [DateTime]::UtcNow.Ticks
    baselineAutomation = @(Get-AutomationWordProcesses)
    baselineWriters = @(Get-OfficeWriterProcesses)
    ownedWord = $null
}
Write-JsonAtomic -Path $ProcessInfoPath -Value $state

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($PlanPath, $false, $true, $false)
    [uint32]$processId = 0
    [void][SampokaiPdfWordNative]::GetWindowThreadProcessId([IntPtr][int64]$document.ActiveWindow.Hwnd, [ref]$processId)
    if ($processId -gt 0) {
        $state.ownedWord = Get-ProcessIdentity -ProcessId ([int]$processId)
        $state.ownedWord.source = "windowHwnd"
        Write-JsonAtomic -Path $ProcessInfoPath -Value $state
    }
    $document.ExportAsFixedFormat($PdfPath, $wdExportFormatPdf)
    if (-not (Test-Path -LiteralPath $PdfPath) -or (Get-Item -LiteralPath $PdfPath).Length -eq 0) {
        throw "PDF was not created."
    }
}
finally {
    if ($null -ne $document) { try { $document.Close($false) } catch {}; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document) }
    if ($null -ne $word) { try { $word.Quit() } catch {}; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
