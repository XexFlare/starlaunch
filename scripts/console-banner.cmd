@echo off
rem Shared look for every console window StarLaunch keeps open.
rem Usage: call "%~dp0console-banner.cmd" "Window title" "What this window is doing"
chcp 65001 >nul
for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
title %~1
cls
echo.
echo     %ESC%[38;2;100;116;139m  ·        ✦          ˚        ·      %ESC%[38;2;226;232;240m✧%ESC%[38;2;100;116;139m        ·          ˚      ✦       ·%ESC%[0m
echo.
echo     %ESC%[1m%ESC%[38;2;168;85;247m███████╗████████╗ █████╗ ██████╗ ██╗      █████╗ ██╗   ██╗███╗   ██╗ ██████╗██╗  ██╗%ESC%[0m
echo     %ESC%[1m%ESC%[38;2;150;98;248m██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██║     ██╔══██╗██║   ██║████╗  ██║██╔════╝██║  ██║%ESC%[0m
echo     %ESC%[1m%ESC%[38;2;129;112;249m███████╗   ██║   ███████║██████╔╝██║     ███████║██║   ██║██╔██╗ ██║██║     ███████║%ESC%[0m
echo     %ESC%[1m%ESC%[38;2;108;126;250m╚════██║   ██║   ██╔══██║██╔══██╗██║     ██╔══██║██║   ██║██║╚██╗██║██║     ██╔══██║%ESC%[0m
echo     %ESC%[1m%ESC%[38;2;90;140;250m███████║   ██║   ██║  ██║██║  ██║███████╗██║  ██║╚██████╔╝██║ ╚████║╚██████╗██║  ██║%ESC%[0m
echo     %ESC%[1m%ESC%[38;2;72;154;251m╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝%ESC%[0m
echo.
echo     %ESC%[38;2;226;232;240mL o c a l   D e v e l o p m e n t   C o m m a n d   C e n t e r%ESC%[0m
echo     %ESC%[38;2;100;116;139m˚      ·          %ESC%[38;2;226;232;240m✦%ESC%[38;2;100;116;139m         ·        ˚           ·        %ESC%[38;2;226;232;240m✧%ESC%[38;2;100;116;139m      ·       ˚%ESC%[0m
echo.
echo     %ESC%[38;2;52;211;153m●%ESC%[0m  %~2
echo.
echo     %ESC%[38;2;251;191;36mKeep this window open.%ESC%[0m %ESC%[38;2;226;232;240mClosing it closes StarLaunch.%ESC%[0m
echo     %ESC%[38;2;100;116;139mMinimise it if it's in the way. The app's own output appears below.%ESC%[0m
echo.
echo     %ESC%[38;2;100;116;139m────────────────────────────────────────────────────────────────────────────────────%ESC%[0m
echo.
