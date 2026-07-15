[CmdletBinding()]
param(
  [string]$DeployPath = 'C:\WORK\bis2203_obgc',
  [switch]$InstallSourceDependencies,
  [switch]$SkipRuntimeDependencies,
  [switch]$AllowDirtySource
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory)] [string]$Command,
    [Parameter(Mandatory)] [string[]]$Arguments,
    [Parameter(Mandatory)] [string]$WorkingDirectory
  )

  Push-Location -LiteralPath $WorkingDirectory
  try {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Command failed ($LASTEXITCODE): $Command $($Arguments -join ' ')"
    }
  }
  finally {
    Pop-Location
  }
}

function Assert-DeploymentChildPath {
  param([Parameter(Mandatory)] [string]$Path)

  $fullPath = [IO.Path]::GetFullPath($Path)
  $deployPrefix = $script:DeployRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar

  if (-not $fullPath.StartsWith($deployPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to modify a path outside the deployment repository: $fullPath"
  }

  return $fullPath
}

function Sync-BuildDirectory {
  param(
    [Parameter(Mandatory)] [string]$Source,
    [Parameter(Mandatory)] [string]$Destination
  )

  if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
    throw "Build output was not found: $Source"
  }

  $sourcePath = (Resolve-Path -LiteralPath $Source).Path
  $destinationPath = Assert-DeploymentChildPath $Destination

  if (Test-Path -LiteralPath $destinationPath) {
    Remove-Item -LiteralPath $destinationPath -Recurse -Force
  }

  New-Item -ItemType Directory -Path $destinationPath | Out-Null
  Get-ChildItem -LiteralPath $sourcePath -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $destinationPath -Recurse -Force
  }
}

$ProjectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ClientRoot = Join-Path $ProjectRoot 'client'
$ServerRoot = Join-Path $ProjectRoot 'server'
$script:DeployRoot = [IO.Path]::GetFullPath($DeployPath)

if (-not (Test-Path -LiteralPath $script:DeployRoot -PathType Container)) {
  throw "Deployment repository was not found: $script:DeployRoot"
}

if (-not (Test-Path -LiteralPath (Join-Path $script:DeployRoot '.git'))) {
  throw "The deployment path is not a Git repository: $script:DeployRoot"
}

$projectPrefix = $ProjectRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
if (
  $script:DeployRoot.Equals($ProjectRoot, [StringComparison]::OrdinalIgnoreCase) -or
  $script:DeployRoot.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)
) {
  throw 'The deployment repository must be outside the source repository.'
}

$sourceStatus = (& git -C $ProjectRoot status --porcelain) -join "`n"
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to read the source repository status.'
}
if ($sourceStatus -and -not $AllowDirtySource) {
  throw 'The source repository has uncommitted changes. Commit them or use -AllowDirtySource.'
}

$deployStatus = (& git -C $script:DeployRoot status --porcelain) -join "`n"
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to read the deployment repository status.'
}
if ($deployStatus) {
  throw 'The deployment repository has uncommitted changes. Commit or discard them first.'
}

if ($InstallSourceDependencies -or -not (Test-Path (Join-Path $ClientRoot 'node_modules'))) {
  Write-Host 'Installing client dependencies...'
  Invoke-CheckedCommand 'npm.cmd' @('ci') $ClientRoot
}

if ($InstallSourceDependencies -or -not (Test-Path (Join-Path $ServerRoot 'node_modules'))) {
  Write-Host 'Installing server dependencies...'
  Invoke-CheckedCommand 'npm.cmd' @('ci') $ServerRoot
}

Write-Host 'Building the Vue client...'
Invoke-CheckedCommand 'npm.cmd' @('run', 'build') $ClientRoot

Write-Host 'Building the NestJS server...'
Invoke-CheckedCommand 'npm.cmd' @('run', 'build') $ServerRoot

$legacyClientPath = Assert-DeploymentChildPath (Join-Path $script:DeployRoot 'clinet-dist')
if (Test-Path -LiteralPath $legacyClientPath) {
  Write-Host 'Removing the legacy clinet-dist directory...'
  Remove-Item -LiteralPath $legacyClientPath -Recurse -Force
}

Write-Host 'Synchronizing build outputs...'
Sync-BuildDirectory (Join-Path $ClientRoot 'dist') (Join-Path $script:DeployRoot 'client-dist')
Sync-BuildDirectory (Join-Path $ServerRoot 'dist') (Join-Path $script:DeployRoot 'dist')

foreach ($fileName in @('web.js', 'package.json', 'package-lock.json')) {
  $sourceFile = Join-Path $ServerRoot $fileName
  if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) {
    throw "Required deployment file was not found: $sourceFile"
  }
  Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $script:DeployRoot $fileName) -Force
}

if (-not $SkipRuntimeDependencies) {
  Write-Host 'Installing production runtime dependencies...'
  Invoke-CheckedCommand 'npm.cmd' @('ci', '--omit=dev') $script:DeployRoot
}

$sourceCommit = (& git -C $ProjectRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to read the source commit.'
}
if ($sourceStatus) {
  $sourceCommit = "$sourceCommit-dirty"
}

[IO.File]::WriteAllText(
  (Join-Path $script:DeployRoot 'SOURCE_COMMIT'),
  $sourceCommit + [Environment]::NewLine,
  [Text.Encoding]::ASCII
)

Write-Host ''
Write-Host "Cafe24 deployment artifacts are ready: $script:DeployRoot"
Write-Host "Source revision: $sourceCommit"
Write-Host 'Review the following changes before committing or pushing:'
& git -C $script:DeployRoot status --short
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to read the prepared deployment status.'
}
