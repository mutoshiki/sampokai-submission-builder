param(
    [Parameter(Mandatory = $true)][string]$SourceTemplate,
    [Parameter(Mandatory = $true)][string]$OutputTemplate
)

$ErrorActionPreference = "Stop"
$wdAlignLeft = 0; $wdAlignCenter = 1; $wdPageBreak = 7; $wdAutoFitFixed = 0
$wdRowHeightAtLeast = 1; $wdPreferredWidthPoints = 3

function New-Paragraph {
    param($Document, [string]$Text, [int]$Alignment = 0, [int]$Size = 12, [switch]$Bold, [int]$Before = 0, [int]$After = 0)
    $range = $Document.Range($Document.Content.End - 1, $Document.Content.End - 1)
    $start = $range.Start
    $range.InsertAfter("$Text`r")
    $inserted = $Document.Range($start, $start + $Text.Length)
    $inserted.ParagraphFormat.Alignment = $Alignment
    $inserted.Font.NameFarEast = "MS 明朝"
    $inserted.Font.Name = "MS Mincho"
    $inserted.Font.Size = $Size
    $inserted.Font.Color = 0
    $inserted.Font.Bold = if ($Bold) { -1 } else { 0 }
    $inserted.ParagraphFormat.SpaceBefore = $Before
    $inserted.ParagraphFormat.SpaceAfter = $After
    $inserted.ParagraphFormat.LineSpacingRule = 0
    return $inserted.Paragraphs.Item(1)
}

# Populate Word's required final paragraph instead of appending a new empty
# paragraph after the last visible section. A trailing paragraph can paginate
# as a blank page in Word even when LibreOffice keeps it on page 3.
function Set-FinalParagraph {
    param($Document, [string]$Text, [int]$Alignment = 0, [int]$Size = 12, [switch]$Bold, [int]$Before = 0, [int]$After = 0)
    $range = $Document.Range($Document.Content.End - 1, $Document.Content.End - 1)
    $start = $range.Start
    $range.InsertAfter($Text)
    $inserted = $Document.Range($start, $start + $Text.Length)
    $inserted.ParagraphFormat.Alignment = $Alignment
    $inserted.Font.NameFarEast = "MS 明朝"
    $inserted.Font.Name = "MS Mincho"
    $inserted.Font.Size = $Size
    $inserted.Font.Color = 0
    $inserted.Font.Bold = if ($Bold) { -1 } else { 0 }
    $inserted.ParagraphFormat.SpaceBefore = $Before
    $inserted.ParagraphFormat.SpaceAfter = $After
    $inserted.ParagraphFormat.LineSpacingRule = 0
    return $inserted.Paragraphs.Item(1)
}

function New-Table {
    param($Document, [int]$Rows, [int]$Columns, [int]$Width)
    $range = $Document.Range($Document.Content.End - 1, $Document.Content.End - 1)
    $table = $Document.Tables.Add($range, $Rows, $Columns)
    $table.AllowAutoFit = $false
    $table.PreferredWidthType = $wdPreferredWidthPoints
    $table.PreferredWidth = $Width
    $table.Borders.Enable = 1
    foreach ($cell in $table.Range.Cells) {
        $cell.Range.Font.NameFarEast = "MS 明朝"; $cell.Range.Font.Name = "MS Mincho"; $cell.Range.Font.Size = 11; $cell.Range.Font.Color = 0
        $cell.TopPadding = 5; $cell.BottomPadding = 5; $cell.LeftPadding = 8; $cell.RightPadding = 8
        $cell.VerticalAlignment = 0
    }
    return $table
}

$source = (Resolve-Path -LiteralPath $SourceTemplate).Path
$output = [IO.Path]::GetFullPath($OutputTemplate)
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($output)) | Out-Null
Copy-Item -LiteralPath $source -Destination $output -Force
$word = $null; $document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false; $word.DisplayAlerts = 0
    $document = $word.Documents.Open($output, $false, $false)
    for ($i = $document.Shapes.Count; $i -ge 1; $i--) { $document.Shapes.Item($i).Delete() }
    $document.Content.Text = ""
    $section = $document.Sections.Item(1)
    $setup = $section.PageSetup
    $setup.PageWidth = 595.3; $setup.PageHeight = 841.9
    $setup.TopMargin = 38; $setup.BottomMargin = 38; $setup.LeftMargin = 52; $setup.RightMargin = 52
    $setup.HeaderDistance = 20; $setup.FooterDistance = 20

    New-Paragraph $document "[[MOUNTAIN]]登山計画書" $wdAlignCenter 24 -Bold -After 24 | Out-Null
    New-Paragraph $document "≪概要≫" $wdAlignCenter 14 -Bold -After 16 | Out-Null
    New-Paragraph $document "【団体名】：信州大学 山歩会（長野県松本市旭3-1-1）" $wdAlignLeft 14 -Bold -After 8 | Out-Null
    New-Paragraph $document "【企画者】：[[ORGANIZER]]" $wdAlignLeft 14 -After 8 | Out-Null
    New-Paragraph $document "【入山エリア】：[[AREA]]" $wdAlignLeft 14 -After 8 | Out-Null
    New-Paragraph $document "【日時】：[[DATE]]" $wdAlignLeft 14 -After 8 | Out-Null
    New-Paragraph $document "【集合場所】：[[MEETING_PLACE]]" $wdAlignLeft 14 -After 8 | Out-Null
    New-Paragraph $document "【集合時間】：[[MEETING_TIME]]　※時間厳守" $wdAlignLeft 14 -After 20 | Out-Null
    New-Paragraph $document "≪行程≫" $wdAlignCenter 14 -Bold -After 10 | Out-Null
    New-Paragraph $document "[[ENTRY_EXIT]]" $wdAlignCenter 12 -After 6 | Out-Null
    New-Paragraph $document "[[TOTALS]]" $wdAlignCenter 12 -After 8 | Out-Null
    $itineraryTable = New-Table $document 2 1 490
    # Leave renderer headroom for the legend. Older LibreOffice versions can
    # otherwise push only the table's final row to a blank intermediate page.
    $itineraryTable.Rows.Item(1).HeightRule = $wdRowHeightAtLeast; $itineraryTable.Rows.Item(1).Height = 150
    $itineraryTable.Cell(1, 1).Range.Text = "[[ITINERARY]]`r"
    $itineraryTable.Cell(1, 1).Range.ParagraphFormat.SpaceAfter = 0
    $itineraryTable.Cell(1, 1).Range.Font.Size = 13
    $itineraryTable.Cell(2, 1).Range.Text = "Ⓢ:Start　Ⓟ:Peak　Ⓖ:Goal`r"
    $itineraryTable.Cell(2, 1).Range.ParagraphFormat.Alignment = $wdAlignCenter
    $itineraryTable.Cell(2, 1).Range.Font.Size = 13
    # Page breaks belong to actual section headings, never to trailing empty
    # paragraphs. This is stable in both Word and LibreOffice.
    $routeHeading = New-Paragraph $document "≪ルート≫" $wdAlignCenter 14 -Bold -After 10
    $routeHeading.Range.ParagraphFormat.PageBreakBefore = -1
    $routeTable = New-Table $document 1 1 490
    $routeTable.Cell(1, 1).Range.Text = "[[ROUTE_IMAGE]]`r[[ESCAPE_PLAN]]`r"
    $routeTable.Cell(1, 1).Range.ParagraphFormat.SpaceAfter = 8
    $equipmentHeading = New-Paragraph $document "≪持参物≫" $wdAlignCenter 16 -Bold -Before 60 -After 14
    $equipmentHeading.Range.ParagraphFormat.PageBreakBefore = -1
    $equipmentTable = New-Table $document 1 1 490
    $equipmentTable.Rows.Item(1).HeightRule = $wdRowHeightAtLeast; $equipmentTable.Rows.Item(1).Height = 310
    $equipmentTable.Cell(1, 1).TopPadding = 14; $equipmentTable.Cell(1, 1).BottomPadding = 14
    $equipmentTable.Cell(1, 1).Range.Text = "[[EQUIPMENT]]`r"
    $equipmentTable.Cell(1, 1).Range.Font.Size = 13
    $equipmentTable.Cell(1, 1).Range.ParagraphFormat.LineSpacing = 22
    $equipmentTable.Cell(1, 1).Range.ParagraphFormat.SpaceAfter = 5
    New-Paragraph $document "≪緊急連絡先≫" $wdAlignCenter 16 -Bold -Before 14 -After 14 | Out-Null
    $contacts = Set-FinalParagraph $document "[[CONTACTS]]" $wdAlignLeft 13 -After 0
    $contacts.Range.ParagraphFormat.LineSpacing = 24
    $document.Content.Font.Color = 0
    $document.Content.Font.ColorIndex = 1
    $document.Save()
}
finally {
    if ($null -ne $document) { $document.Close($false); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document) }
    if ($null -ne $word) { $word.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
