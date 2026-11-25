<#
.SYNOPSIS
  Assemble a new v6.0 story-video episode project on Windows PowerShell (no WSL/rsync/Admin needed).
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\new_episode.ps1 C:\Work\tap-moi -Track short
  powershell -ExecutionPolicy Bypass -File tools\new_episode.ps1 C:\Work\tap-dai -Track long
#>
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Dest,
    [ValidateSet("short", "long")]
    [string]$Track = "short",
    [switch]$Demo,
    [switch]$InPlace,
    [string]$NodeModules = ""
)

$ErrorActionPreference = "Stop"
$SuiteTools = Split-Path -Parent $MyInvocation.MyCommand.Path
$PyScript = Join-Path $SuiteTools "new_episode.py"

$PyArgs = @($PyScript, $Dest, "--track", $Track)
if ($Demo) { $PyArgs += "--demo" }
if ($InPlace) { $PyArgs += "--in-place" }
if ($NodeModules -ne "") { $PyArgs += @("--node-modules", $NodeModules) }

& python @PyArgs
exit $LASTEXITCODE
