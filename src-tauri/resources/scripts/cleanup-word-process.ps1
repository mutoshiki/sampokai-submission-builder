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
    $processId = [int]$Identity.pid
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    do {
        $current = Get-Process -Id $processId -ErrorAction SilentlyContinue
        if ($null -eq $current) { return $true }
        Start-Sleep -Milliseconds 200
    } while ([DateTime]::UtcNow -lt $deadline)

    # Word can remain briefly while Windows tears down its COM host even after
    # the owning PowerShell process has ended. Re-check exact PID/start time so
    # a recycled PID is never touched; report a recoverable deferred cleanup
    # instead of turning already-complete document generation into a failure.
    try {
        $currentIdentity = Get-ProcessIdentity -ProcessId $processId
        if (-not (Test-SameIdentity $currentIdentity $Identity)) { return $true }
    }
    catch { return $true }
    return $false
}

function Add-TerminationResult {
    param($Identity, [bool]$Stopped, [ref]$Terminated, [ref]$Deferred)
    if ($Stopped) {
        $Terminated.Value += [int]$Identity.pid
    }
    else {
        $Deferred.Value += [int]$Identity.pid
    }
}

if (-not (Test-Path -LiteralPath $ProcessInfoPath)) {
    [Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
    [pscustomobject]@{ terminated = @(); status = "no-process-started" } | ConvertTo-Json -Compress
    exit 0
}

$state = Get-Content -Raw -Encoding UTF8 -LiteralPath $ProcessInfoPath | ConvertFrom-Json
$terminated = @()
$deferred = @()
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
        Add-TerminationResult $current (Stop-VerifiedProcess $current) ([ref]$terminated) ([ref]$deferred)
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
        Add-TerminationResult $candidate (Stop-VerifiedProcess $candidate) ([ref]$terminated) ([ref]$deferred)
    }
}

[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
[pscustomobject]@{ terminated = @($terminated); deferred = @($deferred); status = if ($deferred.Count -gt 0) { "deferred" } else { "clean" } } | ConvertTo-Json -Compress
