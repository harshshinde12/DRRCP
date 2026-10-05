@echo off
REM DRRCP one-command start (Windows): install -> migrate -> seed:demo -> dev
REM Backend :4000, frontend :5173. Press Ctrl+C to stop both.
setlocal

where node >nul 2>nul
if errorlevel 1 (
  echo [drrcp] ERROR: Node.js not found. Install Node 24+ from https://nodejs.org and retry.
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [drrcp] ERROR: npm not found. Reinstall Node.js and retry.
  exit /b 1
)

cd /d "%~dp0"

if not exist "node_modules" (
  echo [drrcp] Installing dependencies (first run, may take a few minutes)...
  call npm install
  if errorlevel 1 (
    echo [drrcp] ERROR: npm install failed.
    exit /b 1
  )
) else (
  echo [drrcp] Dependencies present, skipping install.
)

if not exist "backend\.env" (
  echo [drrcp] Creating backend\.env from example...
  copy /y "backend\.env.example" "backend\.env" >nul
)
if not exist "frontend\.env" (
  echo [drrcp] Creating frontend\.env from example...
  copy /y "frontend\.env.example" "frontend\.env" >nul
)

echo [drrcp] Applying database migrations...
call npm run prisma:deploy --workspace=backend
if errorlevel 1 (
  echo [drrcp] ERROR: migration failed. See output above.
  exit /b 1
)

echo [drrcp] Resetting demo database...
call npm run seed:demo
if errorlevel 1 (
  echo [drrcp] ERROR: seed failed. See output above.
  exit /b 1
)

echo.
echo [drrcp] Starting backend :4000 + frontend :5173 ...
echo [drrcp] App:      http://localhost:5173
echo [drrcp] API docs: http://localhost:4000/api/docs
echo [drrcp] Demo password for ALL accounts: Password@123 (see README + docs/DEMO_SCRIPT.md)
echo.
call npm run dev
