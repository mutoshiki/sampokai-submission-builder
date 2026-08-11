$ErrorActionPreference = "Stop"
$word = $null
try {
    $word = New-Object -ComObject Word.Application
    $name = "Word互換ソフト"
    try {
        if ($word.Name) { $name = [string]$word.Name }
    }
    catch {}
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    [pscustomobject]@{
        available = $true
        applicationName = $name
        message = "$name を使用してWord・PDFを生成できます。"
    } | ConvertTo-Json -Compress
}
catch {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    [pscustomobject]@{
        available = $false
        applicationName = $null
        message = "Microsoft WordまたはWPS Officeが必要です。インストール後に再確認してください。"
    } | ConvertTo-Json -Compress
}
finally {
    if ($null -ne $word) {
        try { $word.Quit() } catch {}
        [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
