@echo off
cd /d "%~dp0"

if not exist "node_modules" (
  echo [X] Dependencies not installed. Run setup.bat first.
  pause
  exit /b 1
)

echo ==================================================
echo   GHOSTWIRE // LAUNCHING BACKEND + FRONTEND
echo   Backend:  http://localhost:8080
echo   Frontend: http://localhost:5173
echo   Each runs in its own window; close them to stop.
echo ==================================================

start "GhostWire Backend" cmd /k npm start

REM Give the backend a moment to boot before the frontend proxy starts.
timeout /t 3 /nobreak >nul

start "GhostWire Frontend" cmd /k npm run frontend

echo.
echo [i] Two windows launched. Open http://localhost:5173 (or :8080).
