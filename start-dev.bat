@echo off
cd /d "%~dp0"
title GhostWire DEV MODE

if not exist "node_modules" (
  echo [X] Dependencies not installed. Run setup.bat first.
  pause
  exit /b 1
)

REM Dev-only env: enables auto-seeded default operator + one-click OTP-bypass login.
REM These override .env for this window only (dotenv does not clobber existing vars).
set "NODE_ENV=development"
set "DEV_MODE=true"

echo ==================================================
echo   GHOSTWIRE // DEV MODE  (auto-reload)
echo   App -> http://localhost:8080
echo   Default login: ghost / wire  (auto-login on load)
echo   OTP is bypassed via the DEV LOGIN button.
echo   DO NOT use this mode for production.
echo   (Press Ctrl+C to stop)
echo ==================================================
echo.
call npm run dev
pause
