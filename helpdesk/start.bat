@echo off
setlocal
cd /d "%~dp0"
title Helpdesk launcher

echo.
echo ===== Helpdesk =====
echo.

rem --- 1. Node.js must be installed
where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Download it from https://nodejs.org ^(LTS version^), install it, then double-click start.bat again.
  pause
  exit /b 1
)

rem --- 2. MongoDB must be running
sc query MongoDB | find "RUNNING" >nul
if errorlevel 1 (
  echo MongoDB is not running. Trying to start it...
  net start MongoDB >nul 2>&1
  sc query MongoDB | find "RUNNING" >nul
  if errorlevel 1 (
    echo [ERROR] MongoDB is not running.
    echo Right-click start.bat and choose "Run as administrator", or start the MongoDB service from services.msc.
    pause
    exit /b 1
  )
)

rem --- 3. The ports must be free (an old Helpdesk may still be running)
netstat -ano | findstr /R /C:":5000 .*LISTENING" >nul
if not errorlevel 1 (
  echo [ERROR] Port 5000 is already used. A previous Helpdesk is still running.
  echo Double-click stop.bat, then start.bat again.
  pause
  exit /b 1
)
netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if not errorlevel 1 (
  echo [ERROR] Port 5173 is already used. A previous Helpdesk is still running.
  echo Double-click stop.bat, then start.bat again.
  pause
  exit /b 1
)

rem --- 4. Libraries (first time only, or when a new one was added)
if not exist "node_modules\chart.js" (
  echo Installing the frontend libraries. This can take a few minutes the first time...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed in the project folder.
    pause
    exit /b 1
  )
)
if not exist "server\node_modules" (
  echo Installing the backend libraries...
  call npm --prefix server install
  if errorlevel 1 (
    echo [ERROR] npm install failed in the server folder.
    pause
    exit /b 1
  )
)

rem --- 5. Test accounts (first time only)
if not exist "server\.seeded" (
  echo Creating the test accounts...
  call npm --prefix server run seed
  if errorlevel 1 (
    echo [ERROR] The seed failed. Check that MongoDB is running.
    pause
    exit /b 1
  )
  echo done> "server\.seeded"
)

rem --- 6. Start the backend and the frontend, each in its own window
echo Starting the backend and the frontend...
start "Helpdesk backend" /D "%CD%\server" cmd /k npm run dev
start "Helpdesk frontend" /D "%CD%" cmd /k npm run dev

rem --- 7. Wait until the site answers, then open the browser
set /a tries=0
:wait
netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if not errorlevel 1 goto ready
set /a tries+=1
if %tries% geq 40 goto ready
timeout /t 1 >nul
goto wait

:ready
start "" http://localhost:5173
echo.
echo Helpdesk is starting: http://localhost:5173
echo.
echo Test accounts: user@school.tn / user123, tech@school.tn / tech123, admin@school.tn / admin123
echo.
echo To stop everything: double-click stop.bat
echo.
pause
