@echo off
setlocal
cd /d "%~dp0"

echo === Setting up MSVC 2019 BuildTools environment ===
call "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64

set "NODE=C:\Program Files\nodejs\node.exe"
set "PATH=C:\Program Files\nodejs;%USERPROFILE%\.cargo\bin;%USERPROFILE%\AppData\Roaming\npm;%PATH%"

set WINSDK=C:\Program Files (x86)\Windows Kits\10
set WINSDK_VER=10.0.19041.0
set VSTOOLS=C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\14.29.30133

set "INCLUDE=%VSTOOLS%\include;%WINSDK%\Include\%WINSDK_VER%\ucrt;%WINSDK%\Include\%WINSDK_VER%\um;%WINSDK%\Include\%WINSDK_VER%\shared;%INCLUDE%"
set "LIB=%VSTOOLS%\lib\x64;%WINSDK%\Lib\%WINSDK_VER%\ucrt\x64;%WINSDK%\Lib\%WINSDK_VER%\um\x64;%LIB%"

echo Node: %NODE%
"%NODE%" --version

echo === Building frontend (TypeScript check) ===
"%NODE%" node_modules\typescript\bin\tsc --noEmit
if errorlevel 1 (echo TypeScript check FAILED & exit /b 1)

echo === Building frontend (Vite) ===
"%NODE%" node_modules\vite\bin\vite.js build
if errorlevel 1 (echo Vite build FAILED & exit /b 1)

echo === Patching tauri.conf.json to skip frontend rebuild ===
powershell -Command "(Get-Content 'src-tauri\tauri.conf.json' -Raw) -replace '\"beforeBuildCommand\": \"npm run build\"', '\"beforeBuildCommand\": \"echo skip\"' | Set-Content 'src-tauri\tauri.conf.json' -Encoding UTF8NoBOM"

echo === Running Tauri build ===
"%NODE%" node_modules\@tauri-apps\cli\tauri.js build
set TAURI_EXIT=%ERRORLEVEL%

echo === Restoring tauri.conf.json ===
powershell -Command "(Get-Content 'src-tauri\tauri.conf.json' -Raw) -replace '\"beforeBuildCommand\": \"echo skip\"', '\"beforeBuildCommand\": \"npm run build\"' | Set-Content 'src-tauri\tauri.conf.json' -Encoding UTF8NoBOM"

if %TAURI_EXIT% neq 0 (
  echo Tauri build FAILED with exit code %TAURI_EXIT%
  exit /b %TAURI_EXIT%
)

echo.
echo === Build complete! ===
echo Installer in: src-tauri\target\release\bundle\nsis\
dir "src-tauri\target\release\bundle\nsis\*.exe" 2>nul
