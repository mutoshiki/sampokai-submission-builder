param(
    [Parameter(Mandatory = $true)][string]$PayloadPath,
    [Parameter(Mandatory = $true)][string]$TemplateDirectory,
    [Parameter(Mandatory = $true)][string]$OutputRoot,
    [Parameter(Mandatory = $true)][string]$ProgressPath,
    [Parameter(Mandatory = $true)][string]$ProcessInfoPath
)

$ErrorActionPreference = "Stop"
$wdCharacter = 1
$wdCollapseStart = 1
$wdAlignParagraphCenter = 1
$wdAlignParagraphRight = 2
$wdExportFormatPdf = 17
$wdFindStop = 0
$wdColorBlack = 0
$wdColorRed = 255
$wdColorGreen = 65280
$wdColorBlue = 16711680

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class SampokaiWordNative {
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

function Write-JsonAtomic {
    param([string]$Path, $Value)
    $temporaryPath = "$Path.$PID.tmp"
    $json = $Value | ConvertTo-Json -Depth 6 -Compress
    [IO.File]::WriteAllText($temporaryPath, $json, [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
}

function Set-GenerationStage {
    param([string]$Stage)
    $script:currentGenerationStage = $Stage
    Write-JsonAtomic -Path $ProgressPath -Value ([ordered]@{
        stage = $Stage
        updatedAtUtc = [DateTime]::UtcNow.ToString("o")
    })
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
    $results = @()
    Get-CimInstance Win32_Process -Filter "Name = 'WINWORD.EXE'" -ErrorAction SilentlyContinue |
        Where-Object { [string]$_.CommandLine -match '(?i)(^|\s)/Automation(\s|$)' } |
        ForEach-Object {
            try { $results += ,(Get-ProcessIdentity -ProcessId ([int]$_.ProcessId)) } catch {}
        }
    return @($results)
}

function Get-OfficeWriterProcesses {
    $results = @()
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { [string]$_.Name -in @("WINWORD.EXE", "wps.exe") } |
        ForEach-Object {
            try { $results += ,(Get-ProcessIdentity -ProcessId ([int]$_.ProcessId)) } catch {}
        }
    return @($results)
}

function Save-WordProcessState {
    Write-JsonAtomic -Path $ProcessInfoPath -Value $script:wordProcessState
}

function Set-WordProcessOwner {
    param([int]$ProcessId, [string]$Source)
    try {
        $identity = Get-ProcessIdentity -ProcessId $ProcessId
        $identity.source = $Source
        $script:wordProcessState.ownedWord = $identity
        Save-WordProcessState
    }
    catch {}
}

function Register-NewAutomationWordProcess {
    $candidates = @(Get-AutomationWordProcesses | Where-Object {
        $candidate = $_
        @($script:wordProcessState.baselineAutomation | Where-Object {
            [int]$_.pid -eq [int]$candidate.pid -and [int64]$_.startTimeUtcTicks -eq [int64]$candidate.startTimeUtcTicks
        }).Count -eq 0
    })
    if ($candidates.Count -eq 1) {
        Set-WordProcessOwner -ProcessId ([int]$candidates[0].pid) -Source "automationDiff"
    }
}

function Register-DocumentWordProcess {
    param($Document)
    try {
        [uint32]$processId = 0
        $windowHandle = [IntPtr][int64]$Document.ActiveWindow.Hwnd
        [void][SampokaiWordNative]::GetWindowThreadProcessId($windowHandle, [ref]$processId)
        if ($processId -gt 0) {
            Set-WordProcessOwner -ProcessId ([int]$processId) -Source "windowHwnd"
        }
    }
    catch {}
}

function Convert-PlanToPdfSafely {
    param([string]$PlanPath, [string]$PdfPath)
    $workerScript = Join-Path $PSScriptRoot "convert-plan-to-pdf.ps1"
    $cleanupScript = Join-Path $PSScriptRoot "cleanup-word-process.ps1"
    if (-not (Test-Path -LiteralPath $workerScript) -or -not (Test-Path -LiteralPath $cleanupScript)) {
        throw "SAMP_PDF_FAILED: PDF conversion helper files are missing."
    }

    $token = [guid]::NewGuid().ToString("N")
    $workerInfoPath = Join-Path $env:TEMP "sampokai-pdf-$token-process.json"
    $stdoutPath = Join-Path $env:TEMP "sampokai-pdf-$token-out.txt"
    $stderrPath = Join-Path $env:TEMP "sampokai-pdf-$token-error.txt"
    $arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$workerScript`" -PlanPath `"$PlanPath`" -PdfPath `"$PdfPath`" -ProcessInfoPath `"$workerInfoPath`""
    $worker = $null
    try {
        $worker = Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
        if (-not $worker.WaitForExit(60000)) {
            try { Stop-Process -Id $worker.Id -Force -ErrorAction Stop } catch {}
            try { & $cleanupScript -ProcessInfoPath $workerInfoPath | Out-Null } catch {}
            throw "SAMP_PDF_TIMEOUT: PDF conversion did not complete within 60 seconds. The PDF Word process was stopped; retry generation."
        }
        $worker.Refresh()
        $exitCode = $worker.ExitCode
        if ($null -ne $exitCode -and [int]$exitCode -ne 0) {
            $detail = if (Test-Path -LiteralPath $stderrPath) { ([string](Get-Content -Raw -LiteralPath $stderrPath)).Trim() } else { "" }
            if ([string]::IsNullOrWhiteSpace($detail)) { $detail = "Word could not convert the plan to PDF." }
            throw "SAMP_PDF_FAILED: $detail"
        }
        if (-not (Test-Path -LiteralPath $PdfPath) -or (Get-Item -LiteralPath $PdfPath).Length -eq 0) {
            throw "SAMP_PDF_FAILED: PDF was not created."
        }
    }
    finally {
        if (Test-Path -LiteralPath $workerInfoPath) {
            try { & $cleanupScript -ProcessInfoPath $workerInfoPath | Out-Null } catch {}
        }
        foreach ($path in @($workerInfoPath, $stdoutPath, $stderrPath)) {
            if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
        }
    }
}

function Get-JapaneseDay {
    param([datetime]$Date)
    return @("日", "月", "火", "水", "木", "金", "土")[[int]$Date.DayOfWeek]
}

function Get-ReiwaDate {
    param([datetime]$Date, [switch]$WithDay)
    $value = "令和 $($Date.Year - 2018) 年 $($Date.Month) 月 $($Date.Day) 日"
    if ($WithDay) { $value += "（$(Get-JapaneseDay $Date)）" }
    return $value
}

function Get-OfficeDate {
    param([datetime]$Date)
    return "$($Date.Year)年$($Date.Month)月$($Date.Day)日（$(Get-JapaneseDay $Date)）"
}

function Get-UniqueOutputDirectory {
    param([string]$Root, [string]$BaseName)
    $candidate = Join-Path $Root $BaseName
    $suffix = 2
    while (Test-Path -LiteralPath $candidate) {
        $candidate = Join-Path $Root "${BaseName}_$suffix"
        $suffix++
    }
    New-Item -ItemType Directory -Path $candidate | Out-Null
    return (Resolve-Path -LiteralPath $candidate).Path
}

function Get-NormalFileSystemPath {
    param([string]$Path)
    $resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).ProviderPath
    if ($resolved.StartsWith("\\\\?\\UNC\\", [StringComparison]::OrdinalIgnoreCase)) {
        return "\\\\" + $resolved.Substring(8)
    }
    if ($resolved.StartsWith("\\\\?\\", [StringComparison]::OrdinalIgnoreCase)) {
        return $resolved.Substring(4)
    }
    return $resolved
}

function Set-XmlRunFormat {
    param($Run, $NamespaceManager, [string]$Color, [switch]$Underline)
    $properties = $Run.SelectSingleNode("w:rPr", $NamespaceManager)
    if ($null -eq $properties) { $properties = $Run.OwnerDocument.CreateElement("w", "rPr", "http://schemas.openxmlformats.org/wordprocessingml/2006/main"); [void]$Run.PrependChild($properties) }
    $colorNode = $properties.SelectSingleNode("w:color", $NamespaceManager)
    if ($null -eq $colorNode) { $colorNode = $Run.OwnerDocument.CreateElement("w", "color", "http://schemas.openxmlformats.org/wordprocessingml/2006/main"); [void]$properties.AppendChild($colorNode) }
    [void]$colorNode.SetAttribute("val", "http://schemas.openxmlformats.org/wordprocessingml/2006/main", $Color)
    if ($Underline) {
        $underlineNode = $properties.SelectSingleNode("w:u", $NamespaceManager)
        if ($null -eq $underlineNode) { $underlineNode = $Run.OwnerDocument.CreateElement("w", "u", "http://schemas.openxmlformats.org/wordprocessingml/2006/main"); [void]$properties.AppendChild($underlineNode) }
        [void]$underlineNode.SetAttribute("val", "http://schemas.openxmlformats.org/wordprocessingml/2006/main", "single")
    }
}

function Normalize-OoxmlPackage {
    param([string]$DocumentPath, [string]$MeetingTime = "", [string]$Itinerary = "", $Points = @())
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $parent = [IO.Path]::GetDirectoryName($DocumentPath)
    $work = Join-Path $parent (".sampokai-ooxml-" + [guid]::NewGuid().ToString("N"))
    $replacement = Join-Path $parent (".sampokai-ooxml-" + [guid]::NewGuid().ToString("N") + ".docx")
    try {
        [IO.Compression.ZipFile]::ExtractToDirectory($DocumentPath, $work)
        Get-ChildItem -LiteralPath (Join-Path $work "word") -Filter "*.xml" -Recurse | ForEach-Object {
            $xml = [IO.File]::ReadAllText($_.FullName, [Text.UTF8Encoding]::new($false))
            $xml = $xml -replace 'w:val="00B0F0"', 'w:val="000000"' -replace 'w:val="0070C0"', 'w:val="000000"'
            [IO.File]::WriteAllText($_.FullName, $xml, [Text.UTF8Encoding]::new($false))
        }
        if (-not [string]::IsNullOrWhiteSpace($Itinerary)) {
            $path = Join-Path $work "word\document.xml"
            [xml]$xmlDocument = [IO.File]::ReadAllText($path, [Text.UTF8Encoding]::new($false))
            $manager = New-Object Xml.XmlNamespaceManager($xmlDocument.NameTable)
            $manager.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
            foreach ($run in @($xmlDocument.SelectNodes("//w:r[w:t]", $manager))) {
                $textNode = $run.SelectSingleNode("w:t", $manager)
                if ($textNode.InnerText -eq $MeetingTime -or $textNode.InnerText.Contains("※時間厳守")) { Set-XmlRunFormat $run $manager "FF0000" -Underline }
                if ($textNode.InnerText -notmatch '[ⓈⓅⒼ]') { continue }
                $text = $textNode.InnerText
                $nameRanges = @()
                foreach ($point in @($Points)) {
                    $name = [string]$point.name
                    if ([string]::IsNullOrWhiteSpace($name)) { continue }
                    $from = $text.IndexOf($name)
                    if ($from -ge 0) { $nameRanges += ,@($from, $from + $name.Length - 1) }
                }
                $chunks = @(); $current = ""; $style = ""
                for ($i = 0; $i -lt $text.Length; $i++) {
                    $character = $text[$i]
                    $nextStyle = "base"
                    if ($character -eq 'Ⓢ') { $nextStyle = "blue" }
                    elseif ($character -eq 'Ⓟ') { $nextStyle = "green" }
                    elseif ($character -eq 'Ⓖ') { $nextStyle = "red" }
                    elseif (@($nameRanges | Where-Object { $i -ge $_[0] -and $i -le $_[1] }).Count -gt 0) { $nextStyle = "underlined" }
                    if ($current.Length -gt 0 -and $nextStyle -ne $style) { $chunks += [pscustomobject]@{ style = $style; text = $current }; $current = "" }
                    $style = $nextStyle; $current += $character
                }
                if ($current.Length -gt 0) { $chunks += [pscustomobject]@{ style = $style; text = $current } }
                foreach ($chunk in $chunks) {
                    $clone = $run.CloneNode($true)
                    $clone.SelectSingleNode("w:t", $manager).InnerText = $chunk.text
                    if ($chunk.style -eq "blue") { Set-XmlRunFormat $clone $manager "0000FF" -Underline }
                    elseif ($chunk.style -eq "green") { Set-XmlRunFormat $clone $manager "00B050" -Underline }
                    elseif ($chunk.style -eq "red") { Set-XmlRunFormat $clone $manager "FF0000" -Underline }
                    elseif ($chunk.style -eq "underlined") { Set-XmlRunFormat $clone $manager "000000" -Underline }
                    [void]$run.ParentNode.InsertBefore($clone, $run)
                }
                [void]$run.ParentNode.RemoveChild($run)
            }
            $settings = [Text.UTF8Encoding]::new($false)
            [IO.File]::WriteAllText($path, $xmlDocument.OuterXml, $settings)
        }
        $archive = [IO.Compression.ZipFile]::Open($replacement, [IO.Compression.ZipArchiveMode]::Create)
        try {
            Get-ChildItem -LiteralPath $work -Recurse -File | ForEach-Object {
                $relative = $_.FullName.Substring($work.Length + 1).Replace('\', '/')
                $entry = $archive.CreateEntry($relative, [IO.Compression.CompressionLevel]::Optimal)
                $input = [IO.File]::OpenRead($_.FullName); $output = $entry.Open()
                try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
            }
        }
        finally { $archive.Dispose() }
        [IO.File]::Copy($replacement, $DocumentPath, $true)
    }
    finally {
        if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force }
        if (Test-Path -LiteralPath $replacement) { Remove-Item -LiteralPath $replacement -Force }
    }
}

function Open-Document {
    param($Word, [string]$Path)
    return $Word.Documents.Open($Path, $false, $false)
}

# Replacing a copied template range directly keeps its paragraph, run, tab,
# underline, table and section formatting.  Never rebuild whole documents.
function Set-RangeTextPreserving {
    param($Range, [string]$Text, [int]$Color = -1, [switch]$Cell)
    $target = $Range.Duplicate
    $target.MoveEnd($wdCharacter, -1) | Out-Null
    $start = $target.Start
    $target.Text = ($Text -replace "`r?`n", [char]11)
    if ($Color -ge 0) {
        $target.SetRange($start, $start + $Text.Length)
        $target.Font.Color = $Color
    }
}

function Set-CellTextPreserving {
    param($Cell, [string]$Text)
    Set-RangeTextPreserving -Range $Cell.Range -Text $Text -Cell
}

function Set-ParagraphByPrefixPreserving {
    param($Document, [string]$Prefix, [string]$Text, [switch]$OutsideTable, [int]$Occurrence = 1, [int]$Color = -1)
    $seen = 0
    for ($index = 1; $index -le $Document.Paragraphs.Count; $index++) {
        $range = $Document.Paragraphs.Item($index).Range
        if ($OutsideTable) {
            try { if ($range.Information(12)) { continue } } catch {}
        }
        $value = ($range.Text -replace "`r|`a", "").Trim()
        if ($value.StartsWith($Prefix)) {
            $seen++
            if ($seen -eq $Occurrence) {
                Set-RangeTextPreserving -Range $range -Text $Text -Color $Color
                return $true
            }
        }
    }
    return $false
}

# Use this only for a source-template placeholder or its existing blank field.
# It deliberately never replaces the containing paragraph: adjacent runs retain
# their original underline, tabs, spacing, and position.
function Replace-FoundTextPreserving {
    param($Document, [string]$FindText, [string]$Text, [switch]$OutsideTable, [int]$Color = -1)
    $range = $Document.Content.Duplicate
    $find = $range.Find
    $find.ClearFormatting(); $find.Replacement.ClearFormatting()
    $find.Text = $FindText; $find.Forward = $true; $find.Wrap = $wdFindStop
    while ($find.Execute()) {
        if ($OutsideTable) {
            try { if ($range.Information(12)) { $range.SetRange($range.End, $Document.Content.End); $find = $range.Find; $find.ClearFormatting(); $find.Text = $FindText; $find.Forward = $true; $find.Wrap = $wdFindStop; continue } } catch {}
        }
        $range.Text = $Text
        if ($Color -ge 0) { $range.Font.Color = $Color }
        return $true
    }
    return $false
}

function Set-ExistingBlankField {
    param($Document, [string]$Prefix, [string]$Text, [switch]$OutsideTable)
    for ($index = 1; $index -le $Document.Paragraphs.Count; $index++) {
        $paragraph = $Document.Paragraphs.Item($index).Range
        if ($OutsideTable) {
            try { if ($paragraph.Information(12)) { continue } } catch {}
        }
        $raw = $paragraph.Text
        $prefixAt = $raw.IndexOf($Prefix)
        if ($prefixAt -lt 0) { continue }
        $tail = $raw.Substring($prefixAt + $Prefix.Length)
        if ($tail -notmatch '^[　 ]+') { continue }
        $slotLength = $matches[0].Length
        $replaceLength = [Math]::Min($Text.Length, $slotLength)
        $slot = $Document.Range($paragraph.Start + $prefixAt + $Prefix.Length, $paragraph.Start + $prefixAt + $Prefix.Length + $replaceLength)
        # Source paragraph/run already supplies the underline. Do not set it here.
        $slot.Text = $Text
        $slot.Font.Color = $wdColorBlack; $slot.Font.ColorIndex = 1
        return $true
    }
    return $false
}

function Find-MarkerRange {
    param($Document, [string]$Marker)
    $range = $Document.Content.Duplicate
    $find = $range.Find
    $find.ClearFormatting()
    $find.Replacement.ClearFormatting()
    $find.Text = $Marker
    $find.Forward = $true
    $find.Wrap = $wdFindStop
    if (-not $find.Execute()) { throw "generated plan template marker missing: $Marker" }
    return $range
}

function Set-MarkerText {
    param($Document, [string]$Marker, [string]$Text, [int]$Color = -1, [int]$Underline = -1, [int]$FontSize = 0)
    $range = Find-MarkerRange -Document $Document -Marker $Marker
    $start = $range.Start
    $range.Text = ($Text -replace "`r?`n", [char]11)
    $range.SetRange($start, $start + $Text.Length)
    if ($Color -ge 0) {
        $range.Font.Color = $Color
        if ($Color -eq $wdColorBlack) { $range.Font.ColorIndex = 1 }
        elseif ($Color -eq $wdColorRed) { $range.Font.ColorIndex = 6 }
        elseif ($Color -eq $wdColorGreen) { $range.Font.ColorIndex = 4 }
        elseif ($Color -eq $wdColorBlue) { $range.Font.ColorIndex = 2 }
    }
    if ($Underline -ge 0) { $range.Font.Underline = $Underline }
    if ($FontSize -gt 0) { $range.Font.Size = $FontSize }
    return $range
}

function Set-MarkerParagraphText {
    param($Document, [string]$Marker, [string]$Text, [int]$Color = -1, [int]$FontSize = 0)
    $range = Find-MarkerRange -Document $Document -Marker $Marker
    $start = $range.Start
    # Real paragraphs allow paragraph-level alignment of fixed notes while
    # remaining inside the original equipment-table cell.
    $range.Text = ($Text -replace "`r?`n", "`r")
    $range.SetRange($start, $start + $Text.Length)
    if ($Color -ge 0) {
        $range.Font.Color = $Color
        if ($Color -eq $wdColorBlack) { $range.Font.ColorIndex = 1 }
    }
    if ($FontSize -gt 0) { $range.Font.Size = $FontSize }
    $range.ParagraphFormat.SpaceAfter = 0
    return $range
}

function Set-ItineraryFormatting {
    param($Range, $Points)
    foreach ($point in @($Points)) {
        $name = [string]$point.name
        if ([string]::IsNullOrWhiteSpace($name)) { continue }
        $found = $Range.Duplicate
        $find = $found.Find
        $find.ClearFormatting(); $find.Text = $name; $find.Forward = $true; $find.Wrap = $wdFindStop
        if ($find.Execute()) { $found.Font.Underline = 1 }
    }
    foreach ($pair in @(@("Ⓢ", $wdColorBlue), @("Ⓟ", $wdColorGreen), @("Ⓖ", $wdColorRed))) {
        $found = $Range.Duplicate
        $find = $found.Find
        $find.ClearFormatting(); $find.Text = $pair[0]; $find.Forward = $true; $find.Wrap = $wdFindStop
        while ($find.Execute()) {
            $found.Font.Color = $pair[1]
            if ($pair[1] -eq $wdColorRed) { $found.Font.ColorIndex = 6 }
            elseif ($pair[1] -eq $wdColorGreen) { $found.Font.ColorIndex = 4 }
            elseif ($pair[1] -eq $wdColorBlue) { $found.Font.ColorIndex = 2 }
            $found.Font.Underline = 1
            $found.SetRange($found.End, $Range.End)
            $find = $found.Find
            $find.ClearFormatting(); $find.Text = $pair[0]; $find.Forward = $true; $find.Wrap = $wdFindStop
        }
    }
}

function Add-RouteImage {
    param($Document, [string]$ImagePath)
    $range = Find-MarkerRange -Document $Document -Marker "[[ROUTE_IMAGE]]"
    $range.Text = ""
    $range.Collapse($wdCollapseStart)
    try { $picture = $Document.InlineShapes.AddPicture($ImagePath, $false, $true, $range) }
    catch { throw "SAMP_IMAGE_INSERT: ルート画像を登山計画書へ追加できません。別のPNG、JPEG、BMP画像を選択してください。詳細: $($_.Exception.Message)" }
    $picture.LockAspectRatio = -1
    # Use page width first, then only constrain height needed by escape text.
    # This keeps route-map/altitude images readable without fixed small boxes.
    if ($picture.Width -ne 465) { $picture.Width = 465 }
    if ($picture.Height -gt 540) { $picture.Height = 540 }
    try { $picture.Range.ParagraphFormat.Alignment = $wdAlignParagraphCenter } catch {}
}

function Get-EquipmentText {
    param($Plan)
    $drink = [string]$Plan.drinkQuantity
    if ([string]::IsNullOrWhiteSpace($drink) -and ([string]$Plan.equipmentText) -match '飲料（([^）]+)）') { $drink = $matches[1] }
    $lines = @(
        "□ザック　□登山靴　□雨具（レインウェアやザックカバー等）",
        "□登山に適した服　□防寒着　□帽子　□飲料（$drink）　□昼食",
        "□ゴミ袋（5~10L程度のビニール袋）　□行動食　□お金　□携帯電話",
        "□この登山計画書（印刷したもの）　□学生証　□保険証　□時計",
        "□モバイルバッテリー　□日焼け止め　□紙地図※　□コンパス※",
        "□常備薬※　□ファーストエイドキット※　□ヘッドライト※",
        "□その他必要な物※　□温泉セット（タオルと着替え）"
    )
    $fixed = @("ザック", "登山靴", "雨具", "登山に適した服", "防寒着", "帽子", "昼食", "ゴミ袋", "行動食", "お金", "携帯電話", "この登山計画書", "学生証", "保険証", "時計", "モバイルバッテリー", "日焼け止め", "紙地図", "コンパス", "常備薬", "ファーストエイドキット", "ヘッドライト", "その他必要な物", "温泉セット", "飲料")
    $extra = @($Plan.equipment | Where-Object {
        $item = [string]$_
        -not [string]::IsNullOrWhiteSpace($item) -and -not ($fixed | Where-Object { $item.StartsWith($_) })
    } | ForEach-Object { "□$($_)" })
    if ($extra.Count -gt 0) { $lines += ($extra -join "　") }
    $lines += "（※ある人は持参する）"
    $lines += "（登山靴は駐車場で普段履きの靴と履き替えると良い。）"
    return ($lines -join "`n")
}

function Format-PlanLabels {
    param($Document)
    foreach ($label in @("【団体名】", "【企画者】", "【入山エリア】", "【日時】", "【集合場所】", "【集合時間】")) {
        $range = $Document.Content.Duplicate
        $find = $range.Find; $find.ClearFormatting(); $find.Text = $label; $find.Forward = $true; $find.Wrap = $wdFindStop
        if ($find.Execute()) { $range.Font.Bold = -1; $range.Font.ColorIndex = 1 }
    }
}

function Get-ContactText {
    param($Payload)
    $lines = @(
        "信州大学学生総合支援センター課外活動：0263-37-2197",
        "長野県警察本部地域部山岳安全対策課：026-233-0110"
    )
    $lines += @($Payload.plan.policeContacts | ForEach-Object { "$($_.label)：$($_.phone)" })
    $lines += @($Payload.plan.lodgeContacts | ForEach-Object { "$($_.label)：$($_.phone)" })
    $lines += "企画者（$($Payload.project.organizer.name)）：$($Payload.project.organizer.phone)"
    $lines += "留守本部（$($Payload.plan.homeBaseName)）：$($Payload.plan.homeBasePhone)"
    return ($lines -join "`n")
}

Set-GenerationStage "入力内容を確認中"
$script:wordProcessState = [ordered]@{
    generationStartUtcTicks = [DateTime]::UtcNow.Ticks
    baselineAutomation = @(Get-AutomationWordProcesses)
    baselineWriters = @(Get-OfficeWriterProcesses)
    ownedWord = $null
}
Save-WordProcessState

$payload = Get-Content -Raw -Encoding UTF8 -LiteralPath $PayloadPath | ConvertFrom-Json
$templateDirectory = (Resolve-Path -LiteralPath $TemplateDirectory).Path
$outputRoot = (Resolve-Path -LiteralPath $OutputRoot).Path
$eventDate = [datetime]::ParseExact([string]$payload.project.date, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
$submissionDate = [datetime]::ParseExact([string]$payload.project.submissionDate, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
$safeMountain = ([string]$payload.project.mountainName -replace '[<>:"/\\|?*]', '_' -replace '\s+', '')
if ([string]::IsNullOrWhiteSpace($safeMountain)) { throw "invalid mountain name" }
$outputDirectory = Get-UniqueOutputDirectory -Root $outputRoot -BaseName ("{0:yyyy-MM-dd}_{1}登山" -f $eventDate, $safeMountain)
$participantPath = Join-Path $outputDirectory "01_${safeMountain}登山企画参加者名簿.docx"
$planPath = Join-Path $outputDirectory "02_${safeMountain}登山計画書.docx"
$planPdfPath = Join-Path $outputDirectory "02_${safeMountain}登山計画書.pdf"
$noticePath = Join-Path $outputDirectory "03_${safeMountain}_登山等届.docx"

try {
    Set-GenerationStage "ルート画像を確認中"
    # Tauri can return Windows extended-length paths (\\?\C:\...).  Resolve-Path
    # represents these with a PowerShell provider prefix, which System.Drawing and
    # Word cannot open. Convert back to a normal filesystem path before probing.
    $routeImage = Get-NormalFileSystemPath ([string]$payload.plan.routeImagePath)
    $extension = [IO.Path]::GetExtension($routeImage).ToLowerInvariant()
    if ($extension -notin @(".png", ".jpg", ".jpeg", ".bmp")) { throw "unsupported extension: $extension" }
    Add-Type -AssemblyName System.Drawing
    $probe = [Drawing.Image]::FromFile($routeImage); $probe.Dispose()
}
catch { throw "SAMP_IMAGE_READ: ルート画像を読み込めません。PNG、JPEG、BMP形式の壊れていない画像を選択してください。詳細: $($_.Exception.Message)" }

Set-GenerationStage "テンプレートを準備中"
Copy-Item -LiteralPath (Join-Path $templateDirectory "participant-roster.docx") -Destination $participantPath
Copy-Item -LiteralPath (Join-Path $templateDirectory "plan-generation-template.docx") -Destination $planPath
Copy-Item -LiteralPath (Join-Path $templateDirectory "hiking-notice.docx") -Destination $noticePath

$word = $null
$document = $null
try {
    Set-GenerationStage "Wordを起動中"
    $word = New-Object -ComObject Word.Application
    Register-NewAutomationWordProcess
    $word.Visible = $false; $word.DisplayAlerts = 0

    # Participant roster: preserve supplied source template's layout and runs.
    Set-GenerationStage "参加者名簿を作成中"
    $document = Open-Document $word $participantPath
    Register-DocumentWordProcess $document
    Replace-FoundTextPreserving $document "（山名）" ([string]$payload.project.mountainName) -Color $wdColorBlack | Out-Null
    Set-ParagraphByPrefixPreserving $document "企画者：" "企画者：$($payload.project.organizer.studentId) $($payload.project.organizer.name)" -Color $wdColorBlack | Out-Null
    Set-ParagraphByPrefixPreserving $document "年　月" "$($eventDate.Year)年 $($eventDate.Month)月 $($eventDate.Day)日実施" -Color $wdColorBlack | Out-Null
    Set-ParagraphByPrefixPreserving $document "計　名" "計$($payload.participants.Count)名" | Out-Null
    $facultyOrder = @("人文学部", "教育学部", "経法学部", "理学部", "医学部", "工学部", "農学部", "繊維学部", "その他")
    $table = $document.Tables.Item(1)
    foreach ($facultyIndex in 0..($facultyOrder.Count - 1)) {
        $faculty = $facultyOrder[$facultyIndex]
        $members = @($payload.participants | Where-Object { if ($faculty -eq "その他") { $facultyOrder[0..7] -notcontains [string]$_.faculty } else { [string]$_.faculty -eq $faculty } })
        $row = $table.Rows.Item($facultyIndex + 2)
        $privacyMode = [string]$payload.privacyMode
        $addresses = if ($privacyMode -eq "full") { ($members | ForEach-Object { [string]$_.address }) -join [char]11 } else { "" }
        $phones = if ($privacyMode -eq "minimal") { "" } else { ($members | ForEach-Object { [string]$_.phone }) -join [char]11 }
        $emergency = if ($privacyMode -eq "full") { ($members | ForEach-Object { [string]$_.emergencyPhone }) -join [char]11 } else { "" }
        Set-CellTextPreserving $row.Cells.Item(2) (($members | ForEach-Object { [string]$_.studentId }) -join [char]11)
        Set-CellTextPreserving $row.Cells.Item(3) (($members | ForEach-Object { [string]$_.name }) -join [char]11)
        Set-CellTextPreserving $row.Cells.Item(4) $addresses
        Set-CellTextPreserving $row.Cells.Item(5) $phones
        Set-CellTextPreserving $row.Cells.Item(6) $emergency
    }
    $document.Save(); $document.Close($false); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document); $document = $null
    Normalize-OoxmlPackage $participantPath

    # App-specific hiking-plan template: only replace documented slots.
    Set-GenerationStage "登山計画書を作成中"
    $document = Open-Document $word $planPath
    Register-DocumentWordProcess $document
    $document.Content.Font.ColorIndex = 1
    Set-MarkerText $document "[[MOUNTAIN]]" ([string]$payload.project.mountainName) $wdColorBlack | Out-Null
    Set-MarkerText $document "[[ORGANIZER]]" "$($payload.project.organizer.studentId) $($payload.project.organizer.name)" $wdColorBlack | Out-Null
    Set-MarkerText $document "[[AREA]]" ([string]$payload.project.area) $wdColorBlack | Out-Null
    Set-MarkerText $document "[[DATE]]" "$(Get-OfficeDate $eventDate) $($payload.project.weatherPolicy)" $wdColorBlack | Out-Null
    Set-MarkerText $document "[[MEETING_PLACE]]" ([string]$payload.project.meetingPlace) $wdColorBlack | Out-Null
    Set-MarkerText $document "[[MEETING_TIME]]" ([string]$payload.project.meetingTime) $wdColorRed 1 | Out-Null
    Set-MarkerText $document "[[ENTRY_EXIT]]" "入山予定時刻 $($payload.plan.entryTime) / 下山予定時刻 $($payload.plan.exitTime)" $wdColorBlack | Out-Null
    Set-MarkerText $document "[[TOTALS]]" "合計時間：約$($payload.plan.totalDurationText)　上り：$($payload.plan.ascent)m / 下り：$($payload.plan.descent)m　距離：$($payload.plan.distance)km" $wdColorBlack | Out-Null
    $itineraryRange = Set-MarkerText $document "[[ITINERARY]]" ([string]$payload.plan.itineraryText) $wdColorBlack 0 13
    Set-ItineraryFormatting $itineraryRange $payload.plan.itinerary
    $pageOneIsDense = ([string]$payload.project.mountainName).Length -gt 18 -or ([string]$payload.project.area).Length -gt 35 -or ([string]$payload.plan.itineraryText).Length -gt 170
    if ($pageOneIsDense) {
        $document.Tables.Item(1).Rows.Item(1).HeightRule = 1
        $document.Tables.Item(1).Rows.Item(1).Height = 118
        $itineraryRange.Font.Size = 11
        foreach ($paragraphIndex in 3..11) { $document.Paragraphs.Item($paragraphIndex).Range.ParagraphFormat.SpaceAfter = 3 }
    }
    Add-RouteImage $document $routeImage
    Set-MarkerText $document "[[ESCAPE_PLAN]]" ([string]$payload.plan.escapePlan) $wdColorBlack 0 12 | Out-Null
    $contactCount = @($payload.plan.policeContacts).Count + @($payload.plan.lodgeContacts).Count
    $compactPageThree = $contactCount -gt 5
    $equipmentFont = if ($compactPageThree) { 11 } else { 13 }
    $equipmentRange = Set-MarkerParagraphText $document "[[EQUIPMENT]]" (Get-EquipmentText $payload.plan) $wdColorBlack $equipmentFont
    $noteRange = $document.Content.Duplicate
    $noteFind = $noteRange.Find; $noteFind.ClearFormatting(); $noteFind.Text = "（※ある人は持参する）"; $noteFind.Forward = $true; $noteFind.Wrap = $wdFindStop
    if ($noteFind.Execute()) { $noteRange.ParagraphFormat.Alignment = $wdAlignParagraphRight }
    if ($compactPageThree) {
        # Keep all contacts on page 3 for unusually long, but still readable,
        # contact lists. Normal documents retain reference-sized typography.
        $equipmentRange.ParagraphFormat.LineSpacing = 18
        $document.Tables.Item(3).Rows.Item(1).Height = 285
    }
    $contactText = Get-ContactText $payload
    $contactFont = if ($compactPageThree) { 11 } else { 13 }
    $contactsRange = Set-MarkerText $document "[[CONTACTS]]" $contactText $wdColorBlack 0 $contactFont
    if ($compactPageThree) { $contactsRange.ParagraphFormat.LineSpacing = 16 }
    Format-PlanLabels $document
    $document.Save(); $document.Close($false); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document); $document = $null
    Normalize-OoxmlPackage $planPath ([string]$payload.project.meetingTime) ([string]$payload.plan.itineraryText) $payload.plan.itinerary
    Set-GenerationStage "PDF変換用Wordを準備中"
    if ($null -ne $word) {
        try { $word.Quit() } catch {}
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
        $word = $null
        [GC]::Collect(); [GC]::WaitForPendingFinalizers()
    }
    Set-GenerationStage "登山計画書をPDF変換中"
    Convert-PlanToPdfSafely -PlanPath $planPath -PdfPath $planPdfPath

    # Hiking notice: direct, format-preserving edits to supplied source template.
    Set-GenerationStage "Wordを再起動中"
    $word = New-Object -ComObject Word.Application
    Register-NewAutomationWordProcess
    $word.Visible = $false; $word.DisplayAlerts = 0
    Set-GenerationStage "登山等届を作成中"
    $document = Open-Document $word $noticePath
    Register-DocumentWordProcess $document
    Set-ParagraphByPrefixPreserving $document "令和" (Get-ReiwaDate $submissionDate) -OutsideTable | Out-Null
    Set-ExistingBlankField $document "学籍番号" ([string]$payload.project.organizer.studentId) -OutsideTable | Out-Null
    Set-ParagraphByPrefixPreserving $document "学部" "　　 $($payload.project.organizer.faculty)　　　　　　$($payload.project.organizer.department)" -OutsideTable | Out-Null
    Set-ParagraphByPrefixPreserving $document "氏名" "氏名　$($payload.project.organizer.name)　　　　　　　　　印" -OutsideTable | Out-Null
    Set-ExistingBlankField $document "　下記のとおり" "登山" -OutsideTable | Out-Null
    $noticeTable = $document.Tables.Item(2)
    Set-CellTextPreserving $noticeTable.Range.Cells.Item(6) ([string]$payload.project.noticePlace)
    $period = "$(Get-ReiwaDate $eventDate -WithDay)～$(Get-ReiwaDate $eventDate -WithDay)"
    if ([string]::IsNullOrWhiteSpace([string]$payload.project.reserveDate)) { $period += "`n(予備日) なし" }
    else { $reserve = [datetime]::ParseExact([string]$payload.project.reserveDate, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture); $period += "`n(予備日) $(Get-ReiwaDate $reserve -WithDay)～$(Get-ReiwaDate $reserve -WithDay)" }
    Set-CellTextPreserving $noticeTable.Range.Cells.Item(8) $period
    $noticeFaculties = @("人文学部", "教育学部", "経法学部", "理学部", "医学部", "工学部", "農学部", "繊維学部")
    $male = @(); $female = @(); $totals = @()
    foreach ($faculty in $noticeFaculties) {
        $members = @($payload.participants | Where-Object { [string]$_.faculty -eq $faculty })
        $male += @($members | Where-Object { ([string]$_.gender).StartsWith("男") }).Count
        $female += @($members | Where-Object { ([string]$_.gender).StartsWith("女") }).Count
        $totals += $members.Count
    }
    $male += ($male | Measure-Object -Sum).Sum; $female += ($female | Measure-Object -Sum).Sum; $totals += $payload.participants.Count
    foreach ($index in 0..8) {
        Set-CellTextPreserving $noticeTable.Range.Cells.Item(21 + $index) ([string]$male[$index])
        Set-CellTextPreserving $noticeTable.Range.Cells.Item(31 + $index) ([string]$female[$index])
        Set-CellTextPreserving $noticeTable.Range.Cells.Item(41 + $index) ([string]$totals[$index])
    }
    $document.Save(); $document.Close($false); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document); $document = $null
    Normalize-OoxmlPackage $noticePath
}
finally {
    $stageBeforeCleanup = $script:currentGenerationStage
    Set-GenerationStage "Wordを終了中"
    if ($null -ne $document) { try { $document.Close($false) } catch {}; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document) }
    if ($null -ne $word) { try { $word.Quit() } catch {}; [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
    Set-GenerationStage $stageBeforeCleanup
}

Set-GenerationStage "生成完了"
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
[pscustomobject]@{ outputDir = $outputDirectory; files = @($participantPath, $planPath, $planPdfPath, $noticePath) } | ConvertTo-Json -Compress
