@echo off
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   DoD Tracker — Setup
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  Node.js not found. Install from https://nodejs.org
  pause
  exit /b 1
)

echo  Node.js found: 
node --version

echo.
echo Installing dependencies...
npm install

:: ── Download Tesseract language data ──────────────────────────────────────
set TESSDATA=electron\tessdata\eng.traineddata
if not exist "%TESSDATA%" (
  echo.
  echo Downloading OCR language data (eng.traineddata, ~4 MB^)...
  if not exist "electron\tessdata" mkdir electron\tessdata
  powershell -NoProfile -Command "& { $url='https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/eng.traineddata.gz'; $gz=$env:TEMP+'\eng.traineddata.gz'; Invoke-WebRequest $url -OutFile $gz; $in=[IO.File]::OpenRead($gz); $out=[IO.File]::Create('%TESSDATA%'); $gz2=New-Object IO.Compression.GZipStream($in,'Decompress'); $gz2.CopyTo($out); $gz2.Close(); $out.Close(); $in.Close(); Remove-Item $gz }"
  if exist "%TESSDATA%" (
    echo   OK eng.traineddata downloaded
  ) else (
    echo   FAILED to download eng.traineddata
    echo   Download manually from:
    echo   https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/eng.traineddata.gz
    echo   Decompress and save to: %TESSDATA%
  )
) else (
  echo   OK eng.traineddata already present
)

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   Setup complete!
echo.
echo   Run:  npm run dev
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
pause
