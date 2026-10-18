@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo === QMIS ERP backend — run-local ===
echo.

REM Ensure DB + venv + deps + .env
call "%~dp0setup-local.bat"
if errorlevel 1 exit /b 1

if not exist ".venv\Scripts\python.exe" (
  echo ERROR: .venv missing after setup. Run setup-local.bat manually.
  exit /b 1
)

if not exist ".env" copy /Y ".env.example" ".env" >nul

echo Starting API on http://127.0.0.1:8000 ...
echo Press Ctrl+C to stop.
echo.
".venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
exit /b %ERRORLEVEL%
