@echo off
cd /d "%~dp0"
echo Starting StarLaunch...
echo.
call npm run dev
echo.
echo StarLaunch exited (code %errorlevel%).
pause
