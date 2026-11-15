@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install it from https://nodejs.org/
  pause
  exit /b 1
)
node scripts\build.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
echo Keep this window open while using Stellarium. Press Ctrl+C to stop.
node scripts\serve.mjs --open
if errorlevel 1 pause
