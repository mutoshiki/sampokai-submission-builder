param(
    [Parameter(Mandatory = $true)][string]$ProcessInfoPath
)

$ErrorActionPreference = "Stop"

function Get-ProcessIdentity {
    param([int]$ProcessId)
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    $cim = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    return [pscustomobject]@{
        pid = $process.Id
        startTimeUtcTicks = $process.StartTime.ToUniversalTime().Ticks
        name = $process.ProcessName
        commandLine = if ($null -ne $cim) { [string]$cim.CommandLine } else { "" }
    }
}

function Test-SameIdentity {
    param($Left, $Right)
    return [int]$Left.pid -eq [int]$Right.pid -and
        [int64]$Left.startTimeUtcTicks -eq [int64]$Right.startTimeUtcTicks
}

function Test-IsAutomationWord {
    param($Identity)
    return [string]$Identity.name -ieq "WINWORD" -and
        [string]$Identity.commandLine -match '(?i)(^|\s)/Automation(\s|$)'
}

function Stop-VerifiedProcess {
    param($Identity)
    Stop-Process -Id ([int]$Identity.pid) -Force -ErrorAction Stop
    try { Wait-Process -Id ([int]$Identity.pid) -Timeout 10 -ErrorAction Stop } catch {}
    if ($null -ne (Get-Process -Id ([int]$Identity.pid) -ErrorAction SilentlyContinue)) {
        throw "Could not stop generated Word PID $($Identity.pid)."
    }
}

if (-not (Test-Path -LiteralPath $ProcessInfoPath)) {
    [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    [pscustomobject]@{ terminated = @(); status = "no-process-started" } | ConvertTo-Json -Compress
    exit 0
}

$state = Get-Content -Raw -Encoding UTF8 -LiteralPath $ProcessInfoPath | ConvertFrom-Json
$terminated = @()
$owned = $state.ownedWord

if ($null -ne $owned) {
    $current = $null
    try { $current = Get-ProcessIdentity -ProcessId ([int]$owned.pid) } catch {}
    if ($null -ne $current -and (Test-SameIdentity $current $owned)) {
        $wasRunningBeforeGeneration = @($state.baselineWriters | Where-Object {
            Test-SameIdentity $_ $current
        }).Count -gt 0
        if ($wasRunningBeforeGeneration) {
            throw "Word PID $($current.pid) existed before generation and was not stopped."
        }

        $safeOwnedProcess = if ([string]$owned.source -eq "windowHwnd") {
            (Test-IsAutomationWord $current) -or [string]$current.name -ieq "wps"
        }
        else {
            Test-IsAutomationWord $current
        }
        if (-not $safeOwnedProcess) {
            throw "PID $($current.pid) could not be verified as the generated Word process and was not stopped."
        }
        Stop-VerifiedProcess $current
        $terminated += [int]$current.pid
    }
}
else {
    $fallbackCandidates = @()
    Get-CimInstance Win32_Process -Filter "Name = 'WINWORD.EXE'" -ErrorAction SilentlyContinue |
        Where-Object { [string]$_.CommandLine -match '(?i)(^|\s)/Automation(\s|$)' } |
        ForEach-Object {
            try {
                $candidate = Get-ProcessIdentity -ProcessId ([int]$_.ProcessId)
                $wasRunningBeforeGeneration = @($state.baselineAutomation | Where-Object {
                    Test-SameIdentity $_ $candidate
                }).Count -gt 0
                $startedByThisAttempt = [int64]$candidate.startTimeUtcTicks -ge [int64]$state.generationStartUtcTicks -and
                    [int64]$candidate.startTimeUtcTicks -le ([int64]$state.generationStartUtcTicks + [TimeSpan]::FromSeconds(30).Ticks)
                if (-not $wasRunningBeforeGeneration -and $startedByThisAttempt) {
                    $fallbackCandidates += ,$candidate
                }
            }
            catch {}
        }
    foreach ($candidate in $fallbackCandidates) {
        Stop-VerifiedProcess $candidate
        $terminated += [int]$candidate.pid
    }
}

[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
[pscustomobject]@{ terminated = @($terminated); status = "clean" } | ConvertTo-Json -Compress
