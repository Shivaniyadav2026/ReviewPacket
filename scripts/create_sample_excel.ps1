$root = Join-Path $PSScriptRoot '..\sample\_xlsx_tmp'
$root = [IO.Path]::GetFullPath($root)
if (Test-Path $root) { Remove-Item -Recurse -Force $root }
New-Item -ItemType Directory -Force -Path $root, (Join-Path $root '_rels'), (Join-Path $root 'xl'), (Join-Path $root 'xl\_rels'), (Join-Path $root 'xl\worksheets') | Out-Null

function Write-Text([string]$path, [string]$content) {
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $utf8)
}

$types = @"
<?xml version=""1.0"" encoding=""UTF-8""?>
<Types xmlns=""http://schemas.openxmlformats.org/package/2006/content-types"">
  <Default Extension=""rels"" ContentType=""application/vnd.openxmlformats-package.relationships+xml""/>
  <Default Extension=""xml"" ContentType=""application/xml""/>
  <Override PartName=""/xl/workbook.xml"" ContentType=""application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml""/>
  <Override PartName=""/xl/worksheets/sheet1.xml"" ContentType=""application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml""/>
</Types>
"@
$rels = @"
<?xml version=""1.0"" encoding=""UTF-8""?>
<Relationships xmlns=""http://schemas.openxmlformats.org/package/2006/relationships"">
  <Relationship Id=""rId1"" Type=""http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"" Target=""xl/workbook.xml""/>
</Relationships>
"@
$workbook = @"
<?xml version=""1.0"" encoding=""UTF-8""?>
<workbook xmlns=""http://schemas.openxmlformats.org/spreadsheetml/2006/main"" xmlns:r=""http://schemas.openxmlformats.org/officeDocument/2006/relationships"">
  <sheets>
    <sheet name=""Issues"" sheetId=""1"" r:id=""rId1""/>
  </sheets>
</workbook>
"@
$wbRels = @"
<?xml version=""1.0"" encoding=""UTF-8""?>
<Relationships xmlns=""http://schemas.openxmlformats.org/package/2006/relationships"">
  <Relationship Id=""rId1"" Type=""http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"" Target=""worksheets/sheet1.xml""/>
</Relationships>
"@

Write-Text (Join-Path $root '[Content_Types].xml') $types
Write-Text (Join-Path $root '_rels\.rels') $rels
Write-Text (Join-Path $root 'xl\workbook.xml') $workbook
Write-Text (Join-Path $root 'xl\_rels\workbook.xml.rels') $wbRels

$columns = @(
  'Issue Key','Summary','Affects Version/s','Components/s','Priority','Status','Fix Version/s','Labels','Description','Category of Task','Affected Subsystem/s','Epic Link','Acceptance Criteria','Solution','Review Info','Issue Links','Summary','Review Info'
)

$rows = @(
  @('RP-101','Login fails','1.0','Auth','High','Open','1.1','login,auth','User cannot login','Bug','Auth','EP-1','Must accept terms','','','REL-9','Alt summary','Extra review'),
  @('RP-102','Export CSV','1.0','UI','Medium','In Progress','1.1','export','Add export button','Feature','UI','EP-1','CSV format','Implemented','Reviewed','REL-8','',''),
  @('RP-103','Filter issue keys','1.1','API','High','Open','','filter','Allow key upload','Task','API','EP-2','','','','','', ''),
  @('RP-104','Blank review info','1.1','Core','Low','Done','1.2','review','Need review info','Bug','Core','EP-2','Provide text','Solution text','','REL-5','Alt summary 2',''),
  @('RP-105','Large file support','2.0','Core','High','Open','2.1','perf','Handle 1000+ rows','Task','Core','EP-3','Performance','','','REL-3','',''),
  @('RP-106','Duplicate headers','2.0','ETL','Medium','Open','2.0','headers','Merge dup headers','Bug','ETL','EP-3','Merge correctly','Done','Reviewed','REL-4','Dup summary','Dup review'),
  @('RP-107','Missing solution','2.1','API','Medium','In Review','2.2','solution','Add solution field','Bug','API','EP-4','Needs details','','','REL-1','',''),
  @('RP-108','Completed review','2.2','UI','Low','Done','2.3','review','Finalize review','Task','UI','EP-4','Ok','Done','Complete','REL-2','','')
)

function Get-CellRef([int]$colIndex, [int]$rowIndex) {
  $col = ''
  $n = $colIndex
  while ($n -gt 0) {
    $rem = ($n - 1) % 26
    $col = [char](65 + $rem) + $col
    $n = [math]::Floor(($n - 1) / 26)
  }
  return "$col$rowIndex"
}

$sheetData = New-Object System.Text.StringBuilder
$sheetData.AppendLine('<sheetData>') | Out-Null

$sheetData.AppendLine('<row r="1">') | Out-Null
for ($c = 0; $c -lt $columns.Count; $c++) {
  $ref = Get-CellRef ($c + 1) 1
  $value = [System.Security.SecurityElement]::Escape($columns[$c])
  $sheetData.AppendLine(('<c r="{0}" t="inlineStr"><is><t>{1}</t></is></c>' -f $ref, $value)) | Out-Null
}
$sheetData.AppendLine('</row>') | Out-Null

for ($r = 0; $r -lt $rows.Count; $r++) {
  $rowIndex = $r + 2
  $sheetData.AppendLine(('<row r="{0}">' -f $rowIndex)) | Out-Null
  for ($c = 0; $c -lt $columns.Count; $c++) {
    $ref = Get-CellRef ($c + 1) $rowIndex
    $value = [System.Security.SecurityElement]::Escape([string]$rows[$r][$c])
    $sheetData.AppendLine(('<c r="{0}" t="inlineStr"><is><t>{1}</t></is></c>' -f $ref, $value)) | Out-Null
  }
  $sheetData.AppendLine('</row>') | Out-Null
}

$sheetData.AppendLine('</sheetData>') | Out-Null

$sheet = @"
<?xml version=""1.0"" encoding=""UTF-8""?>
<worksheet xmlns=""http://schemas.openxmlformats.org/spreadsheetml/2006/main"">
$($sheetData.ToString())
</worksheet>
"@

Write-Text (Join-Path $root 'xl\worksheets\sheet1.xml') $sheet

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$zipPath = Join-Path $projectRoot 'sample\ReviewPackets_Sample.zip'
$xlsxPath = Join-Path $projectRoot 'sample\ReviewPackets_Sample.xlsx'
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
if (Test-Path $xlsxPath) { Remove-Item -Force $xlsxPath }
Compress-Archive -Path (Join-Path $root '*') -DestinationPath $zipPath
Rename-Item $zipPath $xlsxPath
Remove-Item -Recurse -Force $root
