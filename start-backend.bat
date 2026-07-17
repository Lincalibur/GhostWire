@echo off
cd /d "%~dp0"
title GhostWire Backend

if not exist "node_modules" (
  echo [X] Dependencies not installed. Run setup.bat first.
  pause
  exit /b 1
)

echo ==================================================
echo   GHOSTWIRE // BACKEND
echo   API + static app -> http://localhost:8080
echo   (Press Ctrl+C to stop)
echo ==================================================
echo.
call npm start
pause
