@echo off
rem Stops the Helpdesk backend (port 5000) and frontend (port 5173)
for %%P in (5000 5173) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    taskkill /PID %%A /F >nul 2>&1
  )
)
echo Helpdesk stopped. You can close the two black windows.
pause
