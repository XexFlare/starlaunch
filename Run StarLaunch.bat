@echo off
cd /d "%~dp0"
call "%~dp0scripts\console-banner.cmd" "StarLaunch - keep this window open" "StarLaunch is starting..."
call npm run dev
echo.
echo     %ESC%[38;2;100;116;139mStarLaunch has closed (exit code %errorlevel%).%ESC%[0m
echo     %ESC%[38;2;100;116;139mPress any key to close this window.%ESC%[0m
pause >nul
