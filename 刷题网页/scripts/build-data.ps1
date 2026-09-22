param(
  [Parameter(Mandatory = $true)][string]$SourceDirectory,
  [Parameter(Mandatory = $true)][string]$OutputFile
)

$ErrorActionPreference = 'Stop'
$names = [ordered]@{}
$papers = [System.Collections.Generic.List[object]]::new()

Get-ChildItem -LiteralPath $SourceDirectory -Directory | Sort-Object Name | ForEach-Object {
  $nameFile = Join-Path $_.FullName 'names.csv'
  $questionFile = Join-Path $_.FullName 'questions.csv'
  if (-not (Test-Path -LiteralPath $nameFile) -or -not (Test-Path -LiteralPath $questionFile)) { return }

  $nameRow = Import-Csv -LiteralPath $nameFile | Select-Object -First 1
  $names[$nameRow.series_key] = $nameRow.display_name

  Import-Csv -LiteralPath $questionFile | ForEach-Object {
    $papers.Add([ordered]@{
      year = [int]$_.year
      subject = $_.subject
      series_key = $_.series_key
      paper_no = [int]$_.paper_no
      questions = @($_.questions_json | ConvertFrom-Json)
    })
  }
}

$payload = [ordered]@{ names = $names; papers = $papers }
$json = $payload | ConvertTo-Json -Depth 30 -Compress
[System.IO.File]::WriteAllText($OutputFile, "window.PAPER_DATA=$json;", [System.Text.UTF8Encoding]::new($false))
Write-Output "Generated $($papers.Count) papers at $OutputFile"
