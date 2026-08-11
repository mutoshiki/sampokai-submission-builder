param([Parameter(Mandatory = $true)][string]$InputPath)

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open((Resolve-Path -LiteralPath $InputPath).Path, $false, $true)
    "Paragraphs=$($document.Paragraphs.Count) Tables=$($document.Tables.Count) Shapes=$($document.Shapes.Count) InlineShapes=$($document.InlineShapes.Count)"
    for ($index = 1; $index -le $document.Paragraphs.Count; $index++) {
        $range = $document.Paragraphs.Item($index).Range
        $value = ($range.Text -replace "`r|`a", "").Trim()
        if ($value) {
            "P$index page=$($range.Information(3)) text=$value"
        }
    }
    for ($index = 1; $index -le $document.Shapes.Count; $index++) {
        $shape = $document.Shapes.Item($index)
        $value = ""
        try {
            if ($shape.TextFrame.HasText -ne 0) {
                $value = ($shape.TextFrame.TextRange.Text -replace "`r|`a", " ").Trim()
            }
        }
        catch {}
        "S$index type=$($shape.Type) page=$($shape.Anchor.Information(3)) left=$($shape.Left) top=$($shape.Top) width=$($shape.Width) height=$($shape.Height) text=$value"
    }
}
finally {
    if ($null -ne $document) {
        $document.Close($false)
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
    }
    if ($null -ne $word) {
        $word.Quit()
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
