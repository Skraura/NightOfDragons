#!/usr/bin/env bash
# DoD Tracker — one-click dev setup
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DoD Tracker — Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Node
if ! command -v node &> /dev/null; then
  echo "✗ Node.js not found. Install from https://nodejs.org (v18+)"
  exit 1
fi

NODE_VER=$(node -e "process.stdout.write(process.version.slice(1).split('.')[0])")
if [ "$NODE_VER" -lt 18 ]; then
  echo "✗ Node.js $NODE_VER found, need 18+. Upgrade at https://nodejs.org"
  exit 1
fi

echo "✓ Node.js $(node --version)"

# Install
echo ""
echo "Installing dependencies..."
npm install

# ── Download Tesseract language data ─────────────────────────────────────────
TESSDATA="electron/tessdata/eng.traineddata"
if [ ! -f "$TESSDATA" ]; then
  echo ""
  echo "Downloading OCR language data (eng.traineddata, ~4 MB)..."
  mkdir -p electron/tessdata
  if command -v curl &> /dev/null; then
    curl -L "https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/eng.traineddata.gz"       | gunzip > "$TESSDATA"
  elif command -v wget &> /dev/null; then
    wget -qO- "https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/eng.traineddata.gz"       | gunzip > "$TESSDATA"
  else
    echo "✗ Neither curl nor wget found."
    echo "  Download manually and save to: $TESSDATA"
    echo "  URL: https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_best/eng.traineddata.gz"
    exit 1
  fi
  echo "✓ eng.traineddata downloaded"
else
  echo "✓ eng.traineddata already present"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Setup complete!"
echo ""
echo "  Run:  npm run dev"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
