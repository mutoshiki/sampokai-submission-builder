param(
    [Parameter(Mandatory = $true)][string]$PayloadPath,
    [Parameter(Mandatory = $true)][string]$TemplateDirectory,
    [Parameter(Mandatory = $true)][string]$OutputRoot
)

$ErrorActionPreference = "Stop"
$wdCharacter = 1
$wdCollapseStart = 1
$wdAlignParagraphCenter = 1
$wdExportFormatPdf = 17
$wdFormatPdf = 17
$wdColorBlack = 0

function Set-RangeText {
    param($Range, [string]$Text, [switch]$Cell)
    $target = $Range.Duplicate
    if ($Cell) {
        $target.MoveEnd($wdCharacter, -1) | Out-Null
    }
    else {
        $target.MoveEnd($wdCharacter, -1) | Out-Null
    }
    $replacement = ($Text -replace "`r?`n", [char]11)
    $start = $target.Start
    try {
        # WPS inherits the existing placeholder style when text is assigned, so
        # normalize the target before and after replacement.
        $target.Font.Color = $wdColorBlack
        $target.Font.ColorIndex = 1
        $target.Font.Underline = 0
    }
    catch {}
    $target.Text = $replacement
    try {
        $target.SetRange($start, $start + $replacement.Length)
        $target.Font.Color = $wdColorBlack
        $target.Font.ColorIndex = 1
        $target.Font.Underline = 0
    }
    catch {}
}

function Set-ParagraphByPrefix {
    param($Document, [string]$Prefix, [string]$Text, [switch]$OutsideTable, [int]$Occurrence = 1)
    $seen = 0
    for ($index = 1; $index -le $Document.Paragraphs.Count; $index++) {
        $range = $Document.Paragraphs.Item($index).Range
        if ($OutsideTable) {
            try {
                if ($range.Information(12)) { continue }
            }
            catch {}
        }
        $value = ($range.Text -replace "`r|`a", "").Trim()
        if ($value.StartsWith($Prefix)) {
            $seen++
            if ($seen -eq $Occurrence) {
                Set-RangeText -Range $range -Text $Text
                return $true
            }
        }
    }
    return $false
}

function Delete-ParagraphContaining {
    param($Document, [string]$Needle)
    for ($index = $Document.Paragraphs.Count; $index -ge 1; $index--) {
        $range = $Document.Paragraphs.Item($index).Range
        $value = ($range.Text -replace "`r|`a", "").Trim()
        if ($value.Contains($Needle)) {
            $range.Delete() | Out-Null
        }
    }
}

function Set-CellText {
    param($Cell, [string]$Text)
    Set-RangeText -Range $Cell.Range -Text $Text -Cell
}

function Save-Document {
    param($Document)
    $Document.Save()
}

function Save-Pdf {
    param($Document, [string]$PdfPath)
    try {
        $Document.ExportAsFixedFormat($PdfPath, $wdExportFormatPdf)
    }
    catch {
        $Document.SaveAs([ref]$PdfPath, [ref]$wdFormatPdf)
    }
}

function Normalize-GeneratedColors {
    param([string]$DocumentPath)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $parent = [System.IO.Path]::GetDirectoryName($DocumentPath)
    $workDirectory = Join-Path $parent (".sampokai-docx-" + [guid]::NewGuid().ToString("N"))
    $replacementArchive = Join-Path $parent (".sampokai-docx-" + [guid]::NewGuid().ToString("N") + ".docx")
    try {
        [System.IO.Compression.ZipFile]::ExtractToDirectory($DocumentPath, $workDirectory)
        Get-ChildItem -LiteralPath (Join-Path $workDirectory "word") -Filter "*.xml" -Recurse | ForEach-Object {
            $xml = [System.IO.File]::ReadAllText($_.FullName, [System.Text.UTF8Encoding]::new($false))
            $normalized = $xml -replace 'w:val="00B0F0"', 'w:val="000000"' -replace 'w:val="0070C0"', 'w:val="000000"'
            if ($normalized -ne $xml) {
                [System.IO.File]::WriteAllText($_.FullName, $normalized, [System.Text.UTF8Encoding]::new($false))
            }
        }
        [System.IO.Compression.ZipFile]::CreateFromDirectory(
            $workDirectory,
            $replacementArchive,
            [System.IO.Compression.CompressionLevel]::Optimal,
            $false
        )
        [System.IO.File]::Copy($replacementArchive, $DocumentPath, $true)
    }
    finally {
        if (Test-Path -LiteralPath $workDirectory) { Remove-Item -LiteralPath $workDirectory -Recurse -Force }
        if (Test-Path -LiteralPath $replacementArchive) { Remove-Item -LiteralPath $replacementArchive -Force }
    }
}

function Get-JapaneseDay {
    param([datetime]$Date)
    return @("日", "月", "火", "水", "木", "金", "土")[[int]$Date.DayOfWeek]
}

function Get-ReiwaDate {
    param([datetime]$Date, [switch]$WithDay)
    $year = $Date.Year - 2018
    $value = "令和 $year 年 $($Date.Month) 月 $($Date.Day) 日"
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

function Open-Document {
    param($Word, [string]$Path)
    return $Word.Documents.Open($Path, $false, $false)
}

$payload = Get-Content -Raw -Encoding UTF8 -LiteralPath $PayloadPath | ConvertFrom-Json
$templateDirectory = (Resolve-Path -LiteralPath $TemplateDirectory).Path
$outputRoot = (Resolve-Path -LiteralPath $OutputRoot).Path
$eventDate = [datetime]::ParseExact([string]$payload.project.date, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
$submissionDate = [datetime]::ParseExact([string]$payload.project.submissionDate, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
$safeMountain = ([string]$payload.project.mountainName -replace '[<>:"/\\|?*]', '_' -replace '\s+', '')
if ([string]::IsNullOrWhiteSpace($safeMountain)) { throw "invalid mountain name" }
$folderName = "{0:yyyy-MM-dd}_{1}登山" -f $eventDate, $safeMountain
$outputDirectory = Get-UniqueOutputDirectory -Root $outputRoot -BaseName $folderName

$participantPath = Join-Path $outputDirectory "01_${safeMountain}登山企画参加者名簿.docx"
$planPath = Join-Path $outputDirectory "02_${safeMountain}登山計画書.docx"
$planPdfPath = Join-Path $outputDirectory "02_${safeMountain}登山計画書.pdf"
$noticePath = Join-Path $outputDirectory "03_${safeMountain}_登山等届.docx"

Copy-Item -LiteralPath (Join-Path $templateDirectory "participant-roster.docx") -Destination $participantPath
Copy-Item -LiteralPath (Join-Path $templateDirectory "hiking-plan.docx") -Destination $planPath
Copy-Item -LiteralPath (Join-Path $templateDirectory "hiking-notice.docx") -Destination $noticePath

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    # 参加者名簿
    $document = Open-Document -Word $word -Path $participantPath
    Set-ParagraphByPrefix -Document $document -Prefix "（山名）" -Text "$($payload.project.mountainName)登山企画　参加者名簿" | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "企画者：" -Text "企画者：$($payload.project.organizer.studentId) $($payload.project.organizer.name)" | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "年　月" -Text "$($eventDate.Year)年 $($eventDate.Month)月 $($eventDate.Day)日実施" | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "計　名" -Text "計$($payload.participants.Count)名" | Out-Null

    $facultyOrder = @("人文学部", "教育学部", "経法学部", "理学部", "医学部", "工学部", "農学部", "繊維学部", "その他")
    $table = $document.Tables.Item(1)
    try { $table.Rows.Item(1).HeadingFormat = -1 } catch {}
    for ($facultyIndex = 0; $facultyIndex -lt $facultyOrder.Count; $facultyIndex++) {
        $faculty = $facultyOrder[$facultyIndex]
        $members = @($payload.participants | Where-Object {
            if ($faculty -eq "その他") {
                $facultyOrder[0..7] -notcontains [string]$_.faculty
            }
            else { [string]$_.faculty -eq $faculty }
        })
        $row = $table.Rows.Item($facultyIndex + 2)
        try { $row.AllowBreakAcrossPages = -1 } catch {}
        Set-CellText -Cell $row.Cells.Item(2) -Text (($members | ForEach-Object { [string]$_.studentId }) -join [char]11)
        Set-CellText -Cell $row.Cells.Item(3) -Text (($members | ForEach-Object { [string]$_.name }) -join [char]11)
        $privacyMode = [string]$payload.privacyMode
        $addresses = if ($privacyMode -eq "full") { ($members | ForEach-Object { [string]$_.address }) -join [char]11 } else { "" }
        $phones = if ($privacyMode -eq "minimal") { "" } else { ($members | ForEach-Object { [string]$_.phone }) -join [char]11 }
        $emergency = if ($privacyMode -eq "full") { ($members | ForEach-Object { [string]$_.emergencyPhone }) -join [char]11 } else { "" }
        Set-CellText -Cell $row.Cells.Item(4) -Text $addresses
        Set-CellText -Cell $row.Cells.Item(5) -Text $phones
        Set-CellText -Cell $row.Cells.Item(6) -Text $emergency
    }
    Delete-ParagraphContaining -Document $document -Needle "※青字を消去"
    Delete-ParagraphContaining -Document $document -Needle "住所欄と緊急連絡先欄"
    Delete-ParagraphContaining -Document $document -Needle "提出は編集が出来るように"
    Save-Document -Document $document
    $document.Close($false)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
    $document = $null
    Normalize-GeneratedColors -DocumentPath $participantPath

    # 登山計画書
    $document = Open-Document -Word $word -Path $planPath
    Set-ParagraphByPrefix -Document $document -Prefix "山名登山計画書" -Text "$($payload.project.mountainName)登山計画書" | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "【企画者】" -Text "【企画者】：$($payload.project.organizer.studentId) $($payload.project.organizer.name)" | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "【入山エリア】" -Text "【入山エリア】：$($payload.project.area)" | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "【日時】" -Text "【日時】：$(Get-OfficeDate $eventDate) $($payload.project.weatherPolicy)" | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "【集合場所】" -Text "【集合場所】：$($payload.project.meetingPlace)" | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "【集合時間】" -Text "【集合時間】：$($payload.project.meetingTime)　※時間厳守" | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "入山予定時刻" -Text "入山予定時刻 $($payload.plan.entryTime)/下山予定時刻 $($payload.plan.exitTime)" | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "合計時間：" -Text "合計時間：約$($payload.plan.totalDurationText)　上り：$($payload.plan.ascent)m/下り：$($payload.plan.descent)m　距離：$($payload.plan.distance)km" | Out-Null

    for ($shapeIndex = 1; $shapeIndex -le $document.Shapes.Count; $shapeIndex++) {
        $shape = $document.Shapes.Item($shapeIndex)
        $shapeText = ""
        try { if ($shape.TextFrame.HasText -ne 0) { $shapeText = [string]$shape.TextFrame.TextRange.Text } } catch {}
        if ($shapeText.Contains("Ⓢ:Start") -or $shapeText.Contains("Ⓢ :⇒")) {
            try {
                $shape.TextFrame.TextRange.Font.ColorIndex = 1
                $shape.TextFrame.TextRange.Font.Underline = 0
            }
            catch {}
            $shape.TextFrame.TextRange.Text = ([string]$payload.plan.itineraryText -replace "`r?`n", "`r") + "`r`rⓈ:Start  Ⓟ:Peak  Ⓖ:Goal"
            try {
                $shape.TextFrame.TextRange.Font.Color = $wdColorBlack
                $shape.TextFrame.TextRange.Font.ColorIndex = 1
                $shape.TextFrame.TextRange.Font.Underline = 0
            }
            catch {}
        }
        elseif ($shapeText.Contains("天候の急変")) {
            try {
                $shape.TextFrame.TextRange.Font.ColorIndex = 1
                $shape.TextFrame.TextRange.Font.Underline = 0
            }
            catch {}
            $shape.TextFrame.TextRange.Text = [string]$payload.plan.escapePlan
            try {
                $shape.TextFrame.TextRange.Font.Color = $wdColorBlack
                $shape.TextFrame.TextRange.Font.ColorIndex = 1
                $shape.TextFrame.TextRange.Font.Underline = 0
            }
            catch {}
        }
        elseif ($shapeText.Contains("□ザック")) {
            try {
                $shape.TextFrame.TextRange.Font.ColorIndex = 1
                $shape.TextFrame.TextRange.Font.Underline = 0
            }
            catch {}
            $shape.TextFrame.TextRange.Text = ([string]$payload.plan.equipmentText -replace "`r?`n", "`r")
            try {
                $shape.TextFrame.TextRange.Font.Color = $wdColorBlack
                $shape.TextFrame.TextRange.Font.ColorIndex = 1
                $shape.TextFrame.TextRange.Font.Underline = 0
            }
            catch {}
        }
    }

    $routePlaceholder = $null
    for ($index = 1; $index -le $document.Paragraphs.Count; $index++) {
        $range = $document.Paragraphs.Item($index).Range
        if (([string]$range.Text).Contains("地図の画像を添付")) { $routePlaceholder = $range; break }
    }
    if ($null -eq $routePlaceholder) { throw "route placeholder missing" }
    $routeRange = $routePlaceholder.Duplicate
    $routeRange.MoveEnd($wdCharacter, -1) | Out-Null
    $routeRange.Text = ""
    $routeRange.Collapse($wdCollapseStart)
    $routeImage = (Resolve-Path -LiteralPath ([string]$payload.plan.routeImagePath)).Path
    $picture = $document.InlineShapes.AddPicture($routeImage, $false, $true, $routeRange)
    try { $picture.LockAspectRatio = -1 } catch {}
    if ($picture.Width -gt 430) { $picture.Width = 430 }
    if ($picture.Height -gt 400) { $picture.Height = 400 }
    try {
        # A floating picture uses the image area prepared on template page 2
        # without adding document flow that would create an extra page.
        $routeShape = $picture.ConvertToShape()
        $routeShape.WrapFormat.Type = 3
        $routeShape.RelativeHorizontalPosition = 1
        $routeShape.RelativeVerticalPosition = 1
        $routeShape.Left = -999995
        $routeShape.Top = 105
    }
    catch {
        try { $picture.Range.ParagraphFormat.Alignment = $wdAlignParagraphCenter } catch {}
    }

    $policeLines = @($payload.plan.policeContacts | ForEach-Object { "$($_.label)：$($_.phone)" })
    $lodgeLines = @($payload.plan.lodgeContacts | ForEach-Object { "$($_.label)：$($_.phone)" })
    Set-ParagraphByPrefix -Document $document -Prefix "警察署：" -Text ($policeLines -join [char]11) -Occurrence 1 | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "警察署：" -Text ($lodgeLines -join [char]11) -Occurrence 1 | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "企画者（" -Text "企画者（$($payload.project.organizer.name)）：$($payload.project.organizer.phone)" | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "留守本部（" -Text "留守本部（$($payload.plan.homeBaseName)）：$($payload.plan.homeBasePhone)" | Out-Null
    Delete-ParagraphContaining -Document $document -Needle "※青字を消去して必要事項"
    Save-Document -Document $document
    $document.Close($false)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
    $document = $null
    Normalize-GeneratedColors -DocumentPath $planPath
    $document = Open-Document -Word $word -Path $planPath
    Save-Pdf -Document $document -PdfPath $planPdfPath
    $document.Close($false)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
    $document = $null

    # 登山等届
    $document = Open-Document -Word $word -Path $noticePath
    Set-ParagraphByPrefix -Document $document -Prefix "令和" -Text (Get-ReiwaDate $submissionDate) -OutsideTable | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "学籍番号" -Text "学籍番号　$($payload.project.organizer.studentId)" -OutsideTable | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "学部" -Text "$($payload.project.organizer.faculty)　$($payload.project.organizer.department)" -OutsideTable | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "氏名" -Text "氏名　$($payload.project.organizer.name)　　　　　　　　　印" -OutsideTable | Out-Null
    Set-ParagraphByPrefix -Document $document -Prefix "下記のとおり" -Text "　下記のとおり登山したいのでお届けします。" -OutsideTable | Out-Null

    $noticeTable = $document.Tables.Item(2)
    Set-CellText -Cell $noticeTable.Range.Cells.Item(6) -Text ([string]$payload.project.noticePlace)
    $period = "$(Get-ReiwaDate $eventDate -WithDay)～$(Get-ReiwaDate $eventDate -WithDay)"
    if ([string]::IsNullOrWhiteSpace([string]$payload.project.reserveDate)) {
        $period += "`r(予備日) なし"
    }
    else {
        $reserveDate = [datetime]::ParseExact([string]$payload.project.reserveDate, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
        $period += "`r(予備日) $(Get-ReiwaDate $reserveDate -WithDay)～$(Get-ReiwaDate $reserveDate -WithDay)"
    }
    Set-CellText -Cell $noticeTable.Range.Cells.Item(8) -Text $period

    $noticeFaculties = @("人文学部", "教育学部", "経法学部", "理学部", "医学部", "工学部", "農学部", "繊維学部")
    $male = @(); $female = @(); $totals = @()
    foreach ($faculty in $noticeFaculties) {
        $facultyMembers = @($payload.participants | Where-Object { [string]$_.faculty -eq $faculty })
        $maleCount = @($facultyMembers | Where-Object { ([string]$_.gender).StartsWith("男") }).Count
        $femaleCount = @($facultyMembers | Where-Object { ([string]$_.gender).StartsWith("女") }).Count
        $male += $maleCount; $female += $femaleCount; $totals += $facultyMembers.Count
    }
    $male += ($male | Measure-Object -Sum).Sum
    $female += ($female | Measure-Object -Sum).Sum
    $totals += $payload.participants.Count
    for ($index = 0; $index -lt 9; $index++) {
        Set-CellText -Cell $noticeTable.Range.Cells.Item(21 + $index) -Text ([string]$male[$index])
        Set-CellText -Cell $noticeTable.Range.Cells.Item(31 + $index) -Text ([string]$female[$index])
        Set-CellText -Cell $noticeTable.Range.Cells.Item(41 + $index) -Text ([string]$totals[$index])
    }
    Save-Document -Document $document
    $document.Close($false)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
    $document = $null
    Normalize-GeneratedColors -DocumentPath $noticePath
}
finally {
    if ($null -ne $document) {
        try { $document.Close($false) } catch {}
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
    }
    if ($null -ne $word) {
        try { $word.Quit() } catch {}
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[pscustomobject]@{
    outputDir = $outputDirectory
    files = @($participantPath, $planPath, $planPdfPath, $noticePath)
} | ConvertTo-Json -Compress
