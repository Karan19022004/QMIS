@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo === QMIS ERP backend — setup-local ===
echo.

REM ---- 1) Locate psql (PostgreSQL) ----
set "PSQL="
for /d %%D in ("C:\Program Files\PostgreSQL\*") do (
  if exist "%%D\bin\psql.exe" set "PSQL=%%D\bin\psql.exe"
)
if "%PSQL%"=="" (
  where psql >nul 2>&1
  if not errorlevel 1 for /f "delims=" %%P in ('where psql') do set "PSQL=%%P"
)
if "%PSQL%"=="" (
  echo ERROR: PostgreSQL is not installed or psql is not on PATH.
  echo Install PostgreSQL 16/17 and set the postgres user password to: root
  exit /b 1
)

REM ---- 2) Create database qmis_erp if missing ----
echo Creating database qmis_erp if needed...
set "PGPASSWORD=root"
"%PSQL%" -U postgres -h localhost -p 5432 -tc "SELECT 1 FROM pg_database WHERE datname = 'qmis_erp'" | findstr 1 >nul
if errorlevel 1 (
  "%PSQL%" -U postgres -h localhost -p 5432 -c "CREATE DATABASE qmis_erp"
  if errorlevel 1 (
    echo ERROR: Could not create database. Check Postgres is running and password is root.
    exit /b 1
  )
)
echo Database qmis_erp is ready.

REM ---- 3) Python venv ----
where python >nul 2>&1
if errorlevel 1 (
  where py >nul 2>&1
  if errorlevel 1 (
    echo ERROR: Python 3.11+ is not installed or not on PATH.
    exit /b 1
  )
  set "PY=py -3"
) else (
  set "PY=python"
)

if not exist ".venv\Scripts\python.exe" (
  echo Creating virtual environment .venv ...
  %PY% -m venv .venv
  if errorlevel 1 (
    echo ERROR: Failed to create .venv
    exit /b 1
  )
) else (
  echo Virtual environment .venv already exists.
)

REM ---- 4) Install dependencies ----
echo Installing requirements...
".venv\Scripts\python.exe" -m pip install --upgrade pip
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo ERROR: pip install failed.
  exit /b 1
)

REM ---- 5) .env from example ----
if not exist ".env" (
  copy /Y ".env.example" ".env" >nul
  echo Created .env from .env.example
) else (
  echo .env already present — left unchanged.
)

echo.
echo Setup complete.
echo Next: run-local.bat
echo Health: http://127.0.0.1:8000/api/v1/health
echo Swagger: http://127.0.0.1:8000/docs
echo.
exit /b 0
