@echo off
cd /d "%~dp0"
title GhostWire Frontend

if not exist "node_modules" (
  echo [X] Dependencies not installed. Run setup.bat first.
  pause
  exit /b 1
)

echo ==================================================
echo   GHOSTWIRE // FRONTEND (dev server)
echo   UI -> http://localhost:5173
echo   /api requests are proxied to the backend (:8080)
echo   NOTE: start-backend.bat must be running for the
echo         portal, OTP, and recon calls to work.
echo   (Press Ctrl+C to stop)
echo ==================================================
echo.
call npm run frontend
pause
