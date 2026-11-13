@echo off
setlocal
title Bridge Assessment Launcher

set "APP_DIR=%~dp0"
set "APP_URL=http://localhost:3000"

if not exist "%APP_DIR%server.js" goto missing_server
where node >nul 2>nul
if errorlevel 1 goto missing_node

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri '%APP_URL%/api/templates' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 goto open_browser

if exist "%APP_DIR%node_modules" goto start_server
echo Installing dependencies. Please wait...
pushd "%APP_DIR%"
call npm install
if errorlevel 1 goto install_failed
popd

:start_server
echo Starting Bridge Assessment System...
start "Bridge Assessment Server" /D "%APP_DIR%" cmd.exe /k node server.js
echo Waiting for the server...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$url='%APP_URL%'; for ($i=0; $i -lt 30; $i++) { try { Invoke-WebRequest -UseBasicParsing -Uri ($url + '/api/templates') -TimeoutSec 2 | Out-Null; Start-Process $url; exit 0 } catch { Start-Sleep -Seconds 1 } }; exit 1"
if errorlevel 1 goto startup_failed
exit /b 0

:open_browser
echo The server is already running. Opening browser...
start "" "%APP_URL%"
exit /b 0

:missing_server
echo ERROR: server.js was not found in:
echo %APP_DIR%
goto failed

:missing_node
echo ERROR: Node.js was not found. Install Node.js 22 or later.
goto failed

:install_failed
popd
echo ERROR: npm install failed.
goto failed

:startup_failed
echo ERROR: The server did not respond within 30 seconds.
echo Check the Bridge Assessment Server window for details.
goto failed

:failed
echo.
pause
exit /b 1
