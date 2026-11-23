<#
.SYNOPSIS
  Assemble a new story-video episode project on Windows PowerShell (no WSL/rsync/Admin needed).
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\new_episode.ps1 D:\mmo\youtube\tap-moi
  powershell -ExecutionPolicy Bypass -File tools\new_episode.ps1 D:\mmo\youtube\tap-co-kich-ban -InPlace
#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Dest,
    [switch]$Demo,
    [switch]$InPlace,
    [string]$NodeModules = ""
)

$ErrorActionPreference = "Stop"
$SuiteTools = Split-Path -Parent $MyInvocation.MyCommand.Path
$PyScript = Join-Path $SuiteTools "new_episode.py"

$PyArgs = @($PyScript, $Dest)
if ($Demo) { $PyArgs += "--demo" }
if ($InPlace) { $PyArgs += "--in-place" }
if ($NodeModules -ne "") { $PyArgs += @("--node-modules", $NodeModules) }

& python @PyArgs
exit $LASTEXITCODE
