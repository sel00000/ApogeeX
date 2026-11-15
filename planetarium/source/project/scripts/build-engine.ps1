param(
    [string]$ToolchainRoot = '',
    [string]$BootstrapPython = 'python',
    [ValidateRange(1, 16)][int]$Jobs = 4,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $projectRoot 'vendor\stellarium-web-engine'
if (-not $ToolchainRoot) {
    $ToolchainRoot = Join-Path (Split-Path -Parent $projectRoot) 'stellarium-web-toolchain'
}
$ToolchainRoot = [IO.Path]::GetFullPath($ToolchainRoot)
$sdkRoot = Join-Path $ToolchainRoot 'emsdk'
$packagesRoot = Join-Path $ToolchainRoot 'python-packages'
$sdkManagerCommit = '708dcbcc9ee23bc7d2dad44fc90db377e38b771c'
$engineCommit = '2103935134e09ba1715171241769fce03cebebe4'

function Invoke-Checked {
    param([string]$Executable, [string[]]$CommandArgs)
    & $Executable @CommandArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code ${LASTEXITCODE}: $Executable"
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot 'SConstruct'))) {
    throw 'The complete vendored Stellarium Web Engine source is required.'
}
if (-not $SkipInstall) {
    New-Item -ItemType Directory -Path $ToolchainRoot -Force | Out-Null
    if (-not (Test-Path -LiteralPath $sdkRoot)) {
        Invoke-Checked 'git' @('init', $sdkRoot)
        Invoke-Checked 'git' @('-C', $sdkRoot, 'remote', 'add', 'origin', 'https://github.com/emscripten-core/emsdk.git')
        Invoke-Checked 'git' @('-C', $sdkRoot, 'fetch', '--depth', '1', 'origin', $sdkManagerCommit)
        Invoke-Checked 'git' @('-C', $sdkRoot, 'checkout', '--detach', 'FETCH_HEAD')
    }
    $actualSdkCommit = & git -C $sdkRoot rev-parse HEAD
    if ($LASTEXITCODE -ne 0 -or $actualSdkCommit.Trim() -ne $sdkManagerCommit) {
        throw 'This toolchain directory has a different SDK manager. Choose a new -ToolchainRoot.'
    }
    Push-Location $sdkRoot
    try {
        Invoke-Checked $BootstrapPython @('emsdk.py', 'install', '1.39.17')
        Invoke-Checked $BootstrapPython @('emsdk.py', 'install', 'python-3.9.2-nuget-64bit')
    } finally { Pop-Location }
    Invoke-Checked $BootstrapPython @('-m', 'pip', 'install', '--disable-pip-version-check', '--upgrade', '--target', $packagesRoot, 'scons==4.8.1', 'setuptools==75.8.0')
}

$buildPython = Join-Path $sdkRoot 'python\3.9.2-nuget_64bit\python.exe'
$emcc = Join-Path $sdkRoot 'upstream\emscripten\emcc.py'
foreach ($required in @($buildPython, $emcc, (Join-Path $packagesRoot 'SCons\__init__.py'))) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "Missing build dependency: $required. Run without -SkipInstall first."
    }
}
$sdkVersion = Get-Content -LiteralPath (Join-Path $sdkRoot 'upstream\emscripten\emscripten-version.txt') -Raw
if ($sdkVersion.Trim().Trim('"') -ne '1.39.17') { throw 'Expected Emscripten 1.39.17.' }

# A local config avoids modifying PATH, system Python, or ~/.emscripten.
$configPath = Join-Path $sdkRoot '.emscripten-stellarium'
$config = @'
import os
sdk = os.path.dirname(os.environ['EM_CONFIG']).replace('\\', '/')
NODE_JS = sdk + '/node/24.19.0_64bit/node.exe'
PYTHON = sdk + '/python/3.9.2-nuget_64bit/python.exe'
LLVM_ROOT = sdk + '/upstream/bin'
BINARYEN_ROOT = sdk + '/upstream'
EMSCRIPTEN_ROOT = sdk + '/upstream/emscripten'
'@
[IO.File]::WriteAllText($configPath, $config, [Text.UTF8Encoding]::new($false))
# Keep linker scratch files inside this build. Windows sandbox TEMP paths can
# be inaccessible to the legacy wasm-ld subprocess even when C compilation
# succeeds; these variables are restored with the other process settings.
$buildTemp = Join-Path $sourceRoot 'build\.tmp'
New-Item -ItemType Directory -Path $buildTemp -Force | Out-Null
$environmentValues = @{
    EM_CONFIG = $configPath
    EMSCRIPTEN_TOOL_PATH = Join-Path $sdkRoot 'upstream\emscripten\tools\scons\site_scons\site_tools\emscripten'
    PYTHONPATH = $packagesRoot
    EMCC_CORES = [string]$Jobs
    TEMP = $buildTemp
    TMP = $buildTemp
}
$savedEnvironment = @{}
foreach ($name in $environmentValues.Keys) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $environmentValues[$name], 'Process')
}
Push-Location $sourceRoot
try {
    Invoke-Checked $buildPython @($emcc, '--version')
    Invoke-Checked $buildPython @('-m', 'SCons', "-j$Jobs", 'mode=release', 'build/stellarium-web-engine.js')
} finally {
    Pop-Location
    foreach ($name in $savedEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
    }
}

$wasmPath = Join-Path $sourceRoot 'build\stellarium-web-engine.wasm'
$wasmBytes = [IO.File]::ReadAllBytes($wasmPath)
if ($wasmBytes.Length -lt 8 -or [BitConverter]::ToString($wasmBytes[0..7]) -ne '00-61-73-6D-01-00-00-00') {
    throw 'The output is not a valid WebAssembly version 1 file.'
}
$engineOutput = Join-Path $projectRoot 'engine'
New-Item -ItemType Directory -Path $engineOutput -Force | Out-Null
$artifactInfo = @()
foreach ($name in @('stellarium-web-engine.js', 'stellarium-web-engine.wasm')) {
    $inputFile = Join-Path $sourceRoot "build\$name"
    $outputFile = Join-Path $engineOutput $name
    Copy-Item -LiteralPath $inputFile -Destination $outputFile -Force
    $artifactInfo += [ordered]@{ file = $name; bytes = (Get-Item -LiteralPath $outputFile).Length; sha256 = (Get-FileHash -LiteralPath $outputFile -Algorithm SHA256).Hash.ToLowerInvariant() }
}
$buildInfo = [ordered]@{
    upstream = 'https://github.com/Stellarium/stellarium-web-engine'
    upstreamCommit = $engineCommit
    license = 'AGPL-3.0'
    emscripten = '1.39.17'
    emscriptenRelease = '9bc968c0e49b1c795ecddb87391b265911e2adcb'
    emsdkManagerCommit = $sdkManagerCommit
    python = '3.9.2'
    scons = '4.8.1'
    node = '24.19.0'
    build = 'python -m SCons -j4 mode=release build/stellarium-web-engine.js'
    patches = @('SConstruct: Windows drivers and response-file linking', 'tools/make-assets.py: Windows paths, Python invocation and CRLF normalization', 'src/js/canvas.js: physical-pixel resize comparison, maxPixelRatio, render lifecycle and cancelled-contact cleanup', 'src/modules/movements.c: cancellation without synthetic clicks and projection-safe pinch bounds', 'src/js/pre.js: high-performance WebGL preference', 'src/modules/lines.c: bounded grid-label intersection at projection seams and astrometric ICRS equatorial grid', 'src/eph-file.c: backward-compatible float64 catalog astrometry and double-precision unit conversion', 'src/modules/stars.c: preserve calibrated small parallaxes and angular proper motion when distance is unavailable', 'src/projections/proj_mollweide.c: convergent polar projection matching the browser inverse', 'src/core.c: expose actual renderer projection for independent WASM regression tests')
    artifacts = $artifactInfo
}
[IO.File]::WriteAllText((Join-Path $engineOutput 'build-info.json'), ($buildInfo | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
Write-Host "Built and verified engine artifacts in $engineOutput"
