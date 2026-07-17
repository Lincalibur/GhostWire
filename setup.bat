@echo off
setlocal
cd /d "%~dp0"

echo ==================================================
echo   GHOSTWIRE // ENVIRONMENT SETUP
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js was not found on PATH.
  echo     Install Node.js 18+ from https://nodejs.org and re-run this script.
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set "NODEV=%%v"
echo [i] Detected Node.js %NODEV%
echo.

echo [i] Installing dependencies (npm install)...
call npm install
if errorlevel 1 (
  echo [X] npm install failed. See output above.
  pause
  exit /b 1
)
echo.

if exist ".env" (
  echo [i] .env already exists - leaving it untouched.
) else (
  echo [i] Creating .env from .env.example and generating a JWT secret...
  copy /y ".env.example" ".env" >nul
  node -e "const fs=require('fs'),c=require('crypto');const p='.env';let t=fs.readFileSync(p,'utf8');t=t.replace(/JWT_SECRET=.*/,'JWT_SECRET='+c.randomBytes(48).toString('hex'));fs.writeFileSync(p,t);console.log('    -> JWT_SECRET generated.');"
)
echo.

echo [i] Applying database migrations...
call npm run migrate
if errorlevel 1 (
  echo [X] Migration failed. See output above.
  pause
  exit /b 1
)
echo.

echo [i] Seeding demo operator (handle: ghost / passphrase: wire)...
call npm run seed
echo.

echo ==================================================
echo   [OK] Setup complete.
echo   - start-all.bat        launch backend + frontend
echo   - start-backend.bat    backend only (serves app on :8080)
echo   - start-frontend.bat   frontend dev server on :5173
echo ==================================================
echo.
pause
